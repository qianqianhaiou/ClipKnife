const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const test = require('node:test');
const docs = path.join(__dirname, '../docs');

test('published demo manifest has complete, bounded and byte-matching output', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(docs, 'assets/demo/build-manifest.json'), 'utf8'));
  assert.ok(manifest['demo/index.html']);
  assert.ok(manifest['assets/demo/main.js']);
  assert.ok(manifest['assets/demo/third-party-notices.txt']);
  for (const [file, digest] of Object.entries(manifest)) {
    assert.ok(file === 'demo/index.html' || /^assets\/demo\/\w[\w.-]*$/.test(file), file);
    const content = fs.readFileSync(path.join(docs, file));
    assert.equal(createHash('sha256').update(content).digest('hex'), digest, file);
  }
  const actual = fs.readdirSync(path.join(docs, 'assets/demo')).filter(name => name !== 'build-manifest.json').map(name => 'assets/demo/' + name).sort();
  assert.deepEqual(actual, Object.keys(manifest).filter(name => name.startsWith('assets/')).sort());
});

test('homepage and nested demo resources resolve under the published root', () => {
  for (const route of ['index.html', 'demo/index.html']) {
    const html = fs.readFileSync(path.join(docs, route), 'utf8');
    for (const [, attr, raw] of html.matchAll(/\b(src|href)="([^"]+)"/g)) {
      if (/^(?:https?:|mailto:|tel:|data:|#)/.test(raw)) continue;
      const clean = raw.split(/[?#]/)[0];
      if (!clean) continue;
      const file = path.resolve(docs, path.dirname(route), decodeURIComponent(clean));
      assert.ok(file.startsWith(docs + path.sep) || file === docs, `${route}: ${raw}`);
      assert.ok(fs.existsSync(file), `${route}: ${attr}=${raw}`);
    }
    // The existing homepage uses a CDN stylesheet runtime. This change adds no
    // remote dependencies; the new standalone demo must remain self-contained.
    if (route === 'demo/index.html') assert.doesNotMatch(html, /src="https?:\/\//);
  }
});

test('mobile entry stays small and only loads React after the viewport gate', () => {
  const entry = fs.readFileSync(path.join(docs, 'assets/demo/entry.js'), 'utf8');
  assert.ok(Buffer.byteLength(entry) < 10000);
  assert.match(entry, /matchMedia/);
  assert.match(entry, /import\(/);
  const html = fs.readFileSync(path.join(docs, 'demo/index.html'), 'utf8');
  assert.doesNotMatch(html, /modulepreload[^>]+main\.js/);
  assert.match(html, /noscript/);
  assert.match(html, /canonical[^>]+https:\/\/clipknife.cn\/demo\//);
});

test('published demonstration has no native API, analytics or QA injection', () => {
  const content = fs.readFileSync(path.join(docs, 'assets/demo/main.js'), 'utf8');
  assert.doesNotMatch(content, /__TAURI__|127\.0\.0\.1|localhost:|\/api\/|__demo-qa|googletagmanager/);
  assert.ok(fs.statSync(path.join(docs, 'assets/demo/main.js')).size < 500000);
  assert.ok(fs.statSync(path.join(docs, 'assets/demo/preview.webp')).size < 250000);
});
