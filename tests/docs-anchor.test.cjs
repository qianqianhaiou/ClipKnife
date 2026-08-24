const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const docsScript = fs.readFileSync(
  path.join(__dirname, '..', 'docs', 'assets', 'docs.js'),
  'utf8',
);

function createPage(hash, markdown, options = {}) {
  let requestedId = '';
  let scrollCount = 0;
  let finishFontLoading;

  const target = {
    scrollIntoView() {
      scrollCount += 1;
    },
  };
  const imageListeners = new Map();
  const image = {
    complete: !options.pendingImage,
    addEventListener(type, listener) {
      imageListeners.set(type, listener);
    },
    compareDocumentPosition(node) {
      return node === target ? 4 : 0;
    },
    removeEventListener(type) {
      imageListeners.delete(type);
    },
  };
  const mount = {
    innerHTML: '',
    contains(node) {
      return node === target;
    },
    getAttribute(name) {
      return name === 'data-doc-src' ? '../content/faq.md' : null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return options.pendingImage ? [image] : [];
    },
  };
  const toc = { innerHTML: '' };
  const status = { hidden: false, innerHTML: '' };
  const fontsReady = options.pendingFonts
    ? new Promise((resolve) => {
      finishFontLoading = resolve;
    })
    : Promise.resolve();
  const document = {
    fonts: {
      ready: fontsReady,
      status: options.pendingFonts ? 'loading' : 'loaded',
    },
    title: '',
    getElementById(id) {
      if (id === 'docToc') return toc;
      if (id === 'docStatus') return status;
      requestedId = id;
      return id === '剪映草稿导出为什么不能取消' ? target : null;
    },
    querySelector(selector) {
      return selector === '[data-doc-src]' ? mount : null;
    },
  };
  const window = {
    clearTimeout,
    location: { hash },
    requestAnimationFrame(callback) {
      callback();
    },
    setTimeout,
  };
  const context = {
    decodeURIComponent,
    document,
    fetch: async () => ({
      ok: true,
      text: async () => markdown,
    }),
    Map,
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    window,
  };

  vm.runInNewContext(docsScript, context);

  return {
    finishFontLoading() {
      document.fonts.status = 'loaded';
      if (finishFontLoading) finishFontLoading();
    },
    finishImageLoading() {
      image.complete = true;
      const listener = imageListeners.get('load');
      if (listener) listener();
    },
    mount,
    requestedId: () => requestedId,
    scrollCount: () => scrollCount,
    status,
    window,
  };
}

test('scrolls to a percent-encoded Chinese heading after Markdown is rendered', async () => {
  const page = createPage(
    '#%E5%89%AA%E6%98%A0%E8%8D%89%E7%A8%BF%E5%AF%BC%E5%87%BA%E4%B8%BA%E4%BB%80%E4%B9%88%E4%B8%8D%E8%83%BD%E5%8F%96%E6%B6%88',
    '## 剪映草稿导出为什么不能取消？\n\n说明',
  );

  await new Promise((resolve) => setImmediate(resolve));

  assert.match(page.mount.innerHTML, /id="剪映草稿导出为什么不能取消"/);
  assert.equal(page.requestedId(), '剪映草稿导出为什么不能取消');
  assert.equal(page.scrollCount(), 1);
  assert.equal(page.status.hidden, true);
});

test('scrolls immediately, then corrects after preceding images and fonts load', async () => {
  const page = createPage(
    '#%E5%89%AA%E6%98%A0%E8%8D%89%E7%A8%BF%E5%AF%BC%E5%87%BA%E4%B8%BA%E4%BB%80%E4%B9%88%E4%B8%8D%E8%83%BD%E5%8F%96%E6%B6%88',
    '![截图](image.png)\n\n## 剪映草稿导出为什么不能取消？',
    { pendingFonts: true, pendingImage: true },
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.scrollCount(), 1);

  page.finishImageLoading();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.scrollCount(), 1);

  page.finishFontLoading();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(page.scrollCount(), 2);
});

test('ignores empty and unknown hashes without throwing', async () => {
  const page = createPage('', '## 其他问题');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(page.window.scrollToLocationHash(page.mount), false);
  page.window.location.hash = '#missing';
  assert.equal(page.window.scrollToLocationHash(page.mount), false);
  assert.equal(page.scrollCount(), 0);
});

test('falls back to a literal malformed fragment', async () => {
  const page = createPage('#bad%fragment', '## 其他问题');
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(page.requestedId(), 'bad%fragment');
  assert.equal(page.scrollCount(), 0);
});
