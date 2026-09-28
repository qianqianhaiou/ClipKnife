const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'docs', 'assets', 'app.js'), 'utf8');

function element(classes = []) {
  const values = new Set(classes);
  const listeners = new Map();
  return {
    classList: {
      add: (...names) => names.forEach((name) => values.add(name)),
      remove: (...names) => names.forEach((name) => values.delete(name)),
      contains: (name) => values.has(name),
    },
    listeners,
    style: {},
    addEventListener: (name, callback) => listeners.set(name, callback),
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

test('homepage download navigation and modal work with ordinary page scrolling', () => {
  const modal = element(['hidden']);
  const downloadButton = element();
  const anchor = element();
  anchor.getAttribute = () => '#download';
  const scrollCalls = [];
  const downloadSection = { getBoundingClientRect: () => ({ top: 600 }) };
  const document = {
    body: { style: {} },
    getElementById(id) {
      return { downloadModal: modal, otherDownloadBtn: downloadButton }[id] || null;
    },
    querySelector(selector) {
      return selector === '#download' ? downloadSection : null;
    },
    querySelectorAll(selector) {
      return selector === 'a[href^="#"]' ? [anchor] : [];
    },
    addEventListener() {},
  };
  const window = {
    pageYOffset: 500,
    scrollTo: (options) => scrollCalls.push(options),
  };

  vm.runInNewContext(script, { document, window, setTimeout });

  let prevented = false;
  anchor.listeners.get('click')({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(scrollCalls.length, 1);
  assert.equal(scrollCalls[0].top, 1020);

  downloadButton.listeners.get('click')();
  assert.equal(modal.classList.contains('hidden'), false);
  assert.equal(document.body.style.overflow, 'hidden');
});
