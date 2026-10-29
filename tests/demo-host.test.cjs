const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../docs/assets/demo-host.js'), 'utf8');

function fixture({ wide = true, observer = true, local = false } = {}) {
  const timers = new Map();
  let timerId = 0;
  const events = new Map();
  function element() {
    const listeners = new Map();
    const attributes = new Map();
    return { listeners, attributes, disabled: false, textContent: '',
      addEventListener: (name, callback) => listeners.set(name, callback),
      setAttribute: (name, value) => attributes.set(name, value),
      removeAttribute: name => attributes.delete(name) };
  }
  const host = element(), live = element(), start = element(), message = element();
  const frames = [];
  live.appendChild = frame => frames.push(frame);
  const media = { matches: wide, addEventListener: (_, callback) => { media.change = callback; } };
  const intersection = { active: false };
  class IntersectionObserver {
    constructor(callback) { intersection.emit = callback; }
    observe() { intersection.active = true; }
    disconnect() { intersection.active = false; }
  }
  const window = { location: { origin: local ? 'null' : 'https://clipknife.test', protocol: local ? 'file:' : 'https:' }, matchMedia: () => media,
    addEventListener: (name, callback) => events.set(name, callback),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; },
    clearTimeout: id => timers.delete(id), ...(observer ? { IntersectionObserver } : {}) };
  const document = {
    querySelector: selector => ({ '[data-demo-host]': host, '[data-demo-live]': live, '[data-demo-start]': start, '[data-demo-message]': message })[selector],
    createElement: () => {
      const frame = { ...element(), contentWindow: {}, remove() { frames.splice(frames.indexOf(frame), 1); } };
      return frame;
    },
  };
  vm.runInNewContext(script, { window, document, IntersectionObserver });
  return { host, start, message, frames, media, intersection, timers,
    enter: () => intersection.emit([{ isIntersecting: true }]),
    click: () => start.listeners.get('click')(),
    emit: (name, event) => events.get(name)(event),
    ready: overrides => events.get('message')({ origin: window.location.origin, source: frames[0]?.contentWindow, data: { type: 'clipknife-demo-ready' }, ...overrides }) };
}

test('demo iframe loads lazily once and accepts only its own ready message', () => {
  const f = fixture();
  assert.equal(f.frames.length, 0);
  f.enter(); f.enter(); f.click();
  assert.equal(f.frames.length, 1);
  assert.equal(f.frames[0].src, 'demo/index.html?embed=1');
  f.ready({ origin: 'https://foreign.test' });
  f.ready({ origin: 'null' });
  f.ready({ source: {} });
  f.ready({ data: { type: 'unrelated' } });
  assert.equal(f.host.attributes.has('data-ready'), false);
  f.ready();
  assert.equal(f.host.attributes.get('data-ready'), 'true');
  assert.equal(f.timers.size, 0);
});

test('file preview accepts opaque origin only from the current demo frame', () => {
  const f = fixture({ local: true }); f.enter();
  f.ready({ origin: 'https://foreign.test' });
  f.ready({ origin: 'null', source: {} });
  assert.equal(f.host.attributes.has('data-ready'), false);
  const oldFrame = f.frames[0].contentWindow;
  [...f.timers.values()][0](); f.click();
  f.ready({ source: oldFrame });
  assert.equal(f.host.attributes.has('data-ready'), false);
  f.ready();
  assert.equal(f.host.attributes.get('data-ready'), 'true');
  assert.equal(f.timers.size, 0);
});

test('mobile never creates a runtime iframe, including clicks and visibility changes', () => {
  const f = fixture({ wide: false });
  f.enter(); f.click();
  assert.equal(f.frames.length, 0);
  f.media.matches = true; f.media.change();
  assert.equal(f.frames.length, 1);
  f.ready();
  f.media.matches = false; f.media.change();
  assert.equal(f.frames.length, 0);
  assert.equal(f.timers.size, 0);
  assert.equal(f.host.attributes.has('data-ready'), false);
  f.media.matches = true; f.media.change();
  assert.equal(f.frames.length, 1);
});

test('timeout removes the failed iframe and provides a working retry', () => {
  const f = fixture(); f.enter();
  [...f.timers.values()][0]();
  assert.equal(f.frames.length, 0);
  assert.equal(f.start.disabled, false);
  assert.match(f.message.textContent, /重试/);
  f.click(); f.ready();
  assert.equal(f.host.attributes.get('data-ready'), 'true');
});

test('iframe error follows the same recoverable path', () => {
  const f = fixture(); f.click();
  f.frames[0].listeners.get('error')();
  assert.equal(f.frames.length, 0);
  assert.equal(f.timers.size, 0);
  f.click(); assert.equal(f.frames.length, 1);
});

test('manual start works without IntersectionObserver', () => {
  const f = fixture({ observer: false });
  f.click(); f.ready();
  assert.equal(f.host.attributes.get('data-ready'), 'true');
});

test('history restoration resumes observation and the unfinished load timeout', () => {
  const f = fixture(); f.enter();
  f.emit('pagehide', {});
  assert.equal(f.intersection.active, false);
  assert.equal(f.timers.size, 0);
  f.emit('pageshow', { persisted: true });
  assert.equal(f.intersection.active, true);
  assert.equal(f.timers.size, 1);
  f.ready();
  f.emit('pagehide', {}); f.emit('pageshow', { persisted: true });
  assert.equal(f.timers.size, 0);
  assert.equal(f.frames.length, 1);
});
