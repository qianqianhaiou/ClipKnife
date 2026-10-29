const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../docs/assets/demo/entry.js'), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture({ url = 'file:///demo%20preview/assets/demo/entry.js', wide = true, embed = false } = {}) {
  class HTMLScriptElement {}
  const entry = Object.assign(new HTMLScriptElement(), { src: url });
  const resources = [], mounted = [], errors = [], before = [];
  const retry = { hidden: true, addEventListener(_, callback) { this.click = callback; } };
  const status = { textContent: '' };
  const media = { matches: wide, addEventListener(_, callback) { this.change = callback; } };
  const location = { search: embed ? '?embed=1' : '', reload() { location.reloaded = true; } };
  const window = { location, matchMedia(query) { media.query = query; return media; } };
  const document = {
    currentScript: entry, documentElement: { dataset: {} },
    head: { appendChild(node) { node.connected = true; resources.push(node); } },
    createElement(tag) { return { tagName: tag.toUpperCase(), remove() { this.connected = false; } }; },
    querySelector(selector) { return { '.fallback-retry': retry, '.fallback-loading': status,
      '.fallback-visual': { before(node) { before.push(node); } } }[selector]; },
  };
  vm.runInNewContext(source, { window, document, HTMLScriptElement, URL, URLSearchParams,
    console: { error(...args) { errors.push(args); } } });
  function expose(mountDemo = embed => mounted.push(embed)) { window.ClipKnifeDemo = { mountDemo }; }
  return { document, window, media, resources, mounted, retry, status, before, errors, expose,
    script: () => resources.find(node => node.tagName === 'SCRIPT'),
    style: () => resources.find(node => node.tagName === 'LINK') };
}

for (const url of ['file:///demo%20preview/assets/demo/entry.js', 'https://example.test/project/assets/demo/entry.js']) {
  test(`classic entry resolves its resources and waits for CSS: ${url}`, async () => {
    const f = fixture({ url, embed: true });
    assert.equal(f.script().src, new URL('./main.js', url).href);
    assert.equal(f.style().href, new URL('./main.css', url).href);
    assert.equal(f.style().rel, 'stylesheet');
    assert.equal(f.script().type, undefined);
    assert.equal(f.script().crossOrigin, undefined);
    assert.equal(f.media.query, '(min-width: 960px)');
    f.expose(); f.script().onload(); await settle();
    assert.deepEqual(f.mounted, []);
    f.style().onload(); await settle();
    assert.deepEqual(f.mounted, [true]);
    assert.equal(f.retry.hidden, true);
    assert.equal(f.errors.length, 0);
    assert.ok(f.resources.every(node => node.onload === null && node.onerror === null));
  });
}

test('mobile does not request runtime or CSS and mounts only once after widening', async () => {
  const f = fixture({ wide: false });
  assert.equal(f.media.query, '(min-width: 1024px)');
  f.media.change(); assert.equal(f.resources.length, 0);
  f.media.matches = true; f.media.change(); f.media.change();
  assert.equal(f.resources.length, 2);
  f.expose(); f.style().onload(); f.script().onload(); await settle();
  f.media.change(); await settle();
  assert.deepEqual(f.mounted, [false]);
});

for (const resource of ['script', 'style']) {
  test(`${resource} failure cleans up resources and exposes a working reload`, async () => {
    const f = fixture(); f[resource]().onerror(); await settle();
    assert.equal(f.document.documentElement.dataset.demoError, 'true');
    assert.equal(f.retry.hidden, false);
    assert.match(f.status.textContent, /重试/);
    assert.deepEqual(f.before, [f.status, f.retry]);
    assert.ok(f.resources.every(node => !node.connected && node.onload === null && node.onerror === null));
    f.media.change(); assert.equal(f.resources.length, 2);
    f.retry.click(); assert.equal(f.window.location.reloaded, true);
    assert.equal(f.mounted.length, 0);
    assert.equal(f.errors.length, 1);
  });
}

for (const mode of ['missing', 'invalid', 'throws']) {
  test(`invalid runtime is recoverable: ${mode}`, async () => {
    const f = fixture();
    if (mode === 'invalid') f.expose('not a function');
    if (mode === 'throws') f.expose(() => { throw new Error('mount failed'); });
    f.script().onload(); f.style().onload(); await settle();
    assert.equal(f.retry.hidden, false);
    assert.equal(f.document.documentElement.dataset.demoError, 'true');
    assert.equal(f.errors.length, 1);
  });
}

test('published runtime is a standalone classic script exposing its mount function', () => {
  const runtime = fs.readFileSync(path.join(__dirname, '../docs/assets/demo/main.js'), 'utf8');
  assert.doesNotThrow(() => new vm.Script(runtime));
  assert.match(runtime, /var ClipKnifeDemo=/);
  assert.match(runtime, /\.mountDemo=/);
  assert.doesNotMatch(runtime, /import\(|import\.meta/);
});
