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

test('homepage anchor navigation respects the reduced-motion preference', () => {
  const anchor = element();
  anchor.getAttribute = () => '#download';
  const calls = [];
  const document = {
    body: { style: {} },
    getElementById: () => null,
    querySelector: () => ({ getBoundingClientRect: () => ({ top: 600 }) }),
    querySelectorAll: selector => selector === 'a[href^="#"]' ? [anchor] : [],
    addEventListener() {},
  };
  const window = {
    pageYOffset: 0,
    matchMedia: () => ({ matches: true }),
    scrollTo: options => calls.push(options),
  };
  vm.runInNewContext(script, { document, window, setTimeout });
  anchor.listeners.get('click')({ preventDefault() {} });
  assert.equal(calls[0].behavior, 'auto');
  assert.equal(calls[0].top, 520);
  anchor.getAttribute = () => '#';
  anchor.listeners.get('click')({ preventDefault() {} });
  assert.equal(calls[1].behavior, 'auto');
  assert.equal(calls[1].top, 0);
});

function setupReveals({ reduced = false, supported = true } = {}) {
  const nodes = [-200, 240, 850, 1400, 2200].map(top => {
    const node = element(['reveal']);
    node.getBoundingClientRect = () => ({ top, bottom: top + 120 });
    return node;
  });
  const observed = new Set();
  const events = new Map();
  const preferenceEvents = new Map();
  let notify;
  let disconnected = false;
  let observerCount = 0;
  const motion = { matches: reduced, addEventListener: (name, callback) => preferenceEvents.set(name, callback) };
  class Observer {
    constructor(callback) { notify = callback; observerCount++; }
    observe(node) { observed.add(node); }
    unobserve(node) { observed.delete(node); }
    disconnect() { disconnected = true; observed.clear(); }
  }
  const document = {
    body: { style: {} },
    documentElement: { clientHeight: 800 },
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: selector => selector === '.reveal' ? nodes : [],
    addEventListener: (name, callback) => events.set(name, callback),
  };
  const window = {
    innerHeight: 800,
    matchMedia: () => motion,
    addEventListener: (name, callback) => events.set(name, callback),
  };
  if (supported) window.IntersectionObserver = Observer;
  vm.runInNewContext(script, { document, window, IntersectionObserver: Observer, setTimeout });
  return { nodes, observed, events, preferenceEvents, notify, get disconnected() { return disconnected; }, get observerCount() { return observerCount; } };
}

test('scroll entrance never re-hides content already visible or near the viewport', () => {
  const context = setupReveals();
  for (const node of context.nodes.slice(0, 3)) {
    assert.equal(node.classList.contains('is-visible'), true);
    assert.equal(node.classList.contains('reveal-motion'), false);
    assert.equal(context.observed.has(node), false);
  }
  for (const node of context.nodes.slice(3)) {
    assert.equal(node.classList.contains('reveal-motion'), true);
    assert.equal(node.classList.contains('is-visible'), false);
    assert.equal(context.observed.has(node), true);
  }
});

test('offscreen sections enter once and are released from observation', () => {
  const context = setupReveals();
  const node = context.nodes[3];
  context.notify([{ target: node, isIntersecting: false }]);
  assert.equal(node.classList.contains('is-visible'), false);
  context.notify([{ target: node, isIntersecting: true }]);
  assert.equal(node.classList.contains('is-visible'), true);
  assert.equal(context.observed.has(node), false);
  context.notify([{ target: node, isIntersecting: false }]);
  assert.equal(node.classList.contains('is-visible'), true);
});

test('reduced motion and unavailable observers keep all content immediately readable', () => {
  for (const options of [{ reduced: true }, { supported: false }]) {
    const context = setupReveals(options);
    assert.equal(context.observerCount, 0);
    assert.ok(context.nodes.every(node => node.classList.contains('is-visible') && !node.classList.contains('reveal-motion')));
  }
});

test('enabling reduced motion during scrolling finishes every pending entrance', () => {
  const context = setupReveals();
  context.preferenceEvents.get('change')({ matches: true });
  assert.equal(context.disconnected, true);
  assert.ok(context.nodes.every(node => node.classList.contains('is-visible') && !node.classList.contains('reveal-motion')));
});

test('keyboard focus makes an offscreen target visible without an entrance delay', () => {
  const context = setupReveals();
  const node = context.nodes[3];
  context.events.get('focusin')({ target: { closest: () => node } });
  assert.equal(node.classList.contains('is-visible'), true);
  assert.equal(node.classList.contains('reveal-motion'), false);
  assert.equal(context.observed.has(node), false);
});

test('history restoration releases observers and never replays section entrances', () => {
  const context = setupReveals();
  context.events.get('pagehide')();
  assert.equal(context.disconnected, true);
  context.events.get('pageshow')({ persisted: true });
  assert.ok(context.nodes.every(node => node.classList.contains('is-visible') && !node.classList.contains('reveal-motion')));
});
