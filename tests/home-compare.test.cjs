const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '../docs/assets/compare.js'), 'utf8');

function setup({ missing, invalidCard = false, playImpl } = {}) {
  let focused = null;
  function element(attributes = {}) {
    const listeners = new Map();
    return {
      attributes, listeners, dataset: {}, hidden: false, disabled: true,
      textContent: '', value: '', tabIndex: -1,
      getAttribute(name) { return attributes[name] ?? null; },
      setAttribute(name, value) { attributes[name] = String(value); },
      removeAttribute(name) { delete attributes[name]; },
      addEventListener(name, callback) {
        if (!listeners.has(name)) listeners.set(name, []);
        listeners.get(name).push(callback);
      },
      fire(name, event = {}) {
        return Promise.all((listeners.get(name) || []).map(callback => callback(event)));
      },
      focus(options) { focused = this; this.focusOptions = options; },
    };
  }
  const names = ['search', 'query', 'clear', 'empty', 'selection', 'range', 'filmstrip', 'status', 'audio', 'play', 'player', 'audio-error'];
  const nodes = Object.fromEntries(names.map(name => [name, element()]));
  nodes.query.value = '海边日落，人物沿着海岸行走';
  nodes.empty.hidden = nodes['audio-error'].hidden = true;
  nodes.player.dataset.state = 'idle';
  nodes.play.setAttribute('aria-pressed', 'false');
  const cards = [
    { compareResult: 'traveler', keywords: '海边 海岸 日落 人物 行走 人 旅行 旅人', title: '人物沿着海岸行走', range: '00:10 — 00:18' },
    { compareResult: 'sunset', keywords: '海边 海岸 日落 海浪 夕阳 礁石 落日 海面 海水', title: '日落时海浪拍打礁石', range: '00:18 — 00:26' },
  ].map((data, index) => Object.assign(element({ 'aria-pressed': String(index === 1) }), { dataset: data }));
  if (invalidCard) delete cards[0].dataset.range;
  const scene = element();
  scene.querySelector = selector => {
    const name = selector.match(/^\[data-compare-(.+)\]$/)?.[1];
    return name === missing ? null : nodes[name] || null;
  };
  scene.querySelectorAll = () => cards;
  const document = element();
  document.querySelector = () => missing === 'scene' ? null : scene;
  document.getElementById = () => scene;
  const links = [element(), element()];
  document.querySelectorAll = () => links;
  const window = element();
  let observer;
  window.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; this.observed = []; this.disconnected = false; observer = this; }
    observe(target) { this.observed.push(target); this.disconnected = false; }
    disconnect() { this.disconnected = true; }
  };
  const audio = nodes.audio;
  audio.paused = true;
  audio.error = null;
  audio.playCount = audio.pauseCount = audio.loadCount = 0;
  audio.play = () => {
    audio.playCount += 1;
    audio.paused = false;
    return playImpl ? playImpl(audio) : Promise.resolve();
  };
  audio.pause = () => { audio.pauseCount += 1; audio.paused = true; void audio.fire('pause'); };
  audio.load = () => { audio.loadCount += 1; audio.error = null; };
  const context = { document, window };
  const run = () => vm.runInNewContext(script, context);
  run();
  async function search(value) {
    nodes.query.value = value;
    await nodes.query.fire('input');
    let prevented = false;
    await nodes.search.fire('submit', { preventDefault() { prevented = true; } });
    assert.ok(prevented);
  }
  return { ...nodes, form: nodes.search, cards, scene, document, window, links, observer, run, search, focused: () => focused };
}

test('comparison starts with the selected clip accessible, without autoplay', () => {
  const s = setup();
  assert.equal(s.scene.dataset.enhanced, 'true');
  assert.deepEqual(s.cards.map(card => card.tabIndex), [-1, 0]);
  assert.deepEqual(s.cards.map(card => card.disabled), [false, false]);
  assert.equal(s.range.textContent, '00:18 — 00:26');
  assert.equal(s.filmstrip.dataset.selected, 'sunset');
  assert.equal(s.play.disabled, false);
  assert.equal(s.audio.playCount, 0);
});

test('picture selection and keyboard navigation keep focus, range and state together', async () => {
  const s = setup();
  await s.cards[0].fire('click');
  assert.equal(s.range.textContent, '00:10 — 00:18');
  assert.deepEqual(s.cards.map(card => card.getAttribute('aria-pressed')), ['true', 'false']);
  for (const [from, key, to] of [[0, 'ArrowLeft', 1], [1, 'ArrowRight', 0], [0, 'End', 1], [1, 'Home', 0]]) {
    let prevented = false;
    await s.cards[from].fire('keydown', { key, preventDefault() { prevented = true; } });
    assert.ok(prevented);
    assert.equal(s.focused(), s.cards[to]);
    assert.equal(s.cards[to].focusOptions.preventScroll, true);
    assert.equal(s.range.textContent, s.cards[to].dataset.range);
    assert.equal(s.cards[1 - to].tabIndex, -1);
  }
  let prevented = false;
  await s.cards[0].fire('keydown', { key: 'Tab', preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});

test('fixed-sample search filters results and excludes hidden pictures from keyboard selection', async () => {
  const s = setup();
  await s.search('海浪');
  assert.deepEqual(s.cards.map(card => card.hidden), [true, false]);
  await s.cards[1].fire('keydown', { key: 'ArrowRight', preventDefault() {} });
  assert.equal(s.focused(), s.cards[1]);
  assert.equal(s.range.textContent, '00:18 — 00:26');
  await s.search('人物');
  assert.deepEqual(s.cards.map(card => card.hidden), [false, true]);
  assert.equal(s.range.textContent, '00:10 — 00:18');
  assert.match(s.status.textContent, /示例匹配 1 项/);
});

test('unknown search shows an empty state; clear and whitespace restore both examples', async () => {
  const s = setup();
  await s.search('<script>alert(1)</script>');
  assert.deepEqual(s.cards.map(card => card.hidden), [true, true]);
  assert.equal(s.empty.hidden, false);
  assert.equal(s.selection.hidden, true);
  assert.deepEqual(s.cards.map(card => card.tabIndex), [-1, -1]);
  assert.match(s.status.textContent, /暂无匹配画面/);
  await s.clear.fire('click');
  assert.equal(s.query.value, '');
  assert.equal(s.clear.hidden, true);
  assert.equal(s.focused(), s.query);
  assert.equal(s.empty.hidden, true);
  assert.equal(s.selection.hidden, false);
  assert.deepEqual(s.cards.map(card => card.hidden), [false, false]);
  await s.search('   ');
  assert.deepEqual(s.cards.map(card => card.hidden), [false, false]);
});

test('incomplete markup retains static content, and repeated initialization does not duplicate listeners', () => {
  for (const options of [{ missing: 'scene' }, { missing: 'range' }, { invalidCard: true }]) {
    const s = setup(options);
    assert.equal(s.scene.dataset.enhanced, undefined);
    assert.deepEqual(s.cards.map(card => card.disabled), [true, true]);
    assert.equal(s.audio.playCount, 0);
  }
  const s = setup();
  s.run();
  assert.equal(s.form.listeners.get('submit').length, 1);
  assert.equal(s.play.listeners.get('click').length, 1);
  const withoutAudio = setup({ missing: 'audio' });
  assert.equal(withoutAudio.scene.dataset.enhanced, 'true');
  assert.equal(withoutAudio.play.disabled, true);
});

test('audio playback, pause and completion expose the actual state', async () => {
  const s = setup();
  await s.play.fire('click');
  assert.equal(s.audio.paused, false);
  assert.equal(s.player.dataset.state, 'playing');
  assert.equal(s.play.getAttribute('aria-label'), '暂停示例旁白');
  assert.equal(s.play.getAttribute('aria-pressed'), 'true');
  await s.play.fire('click');
  assert.equal(s.audio.paused, true);
  assert.equal(s.player.dataset.state, 'idle');
  await s.play.fire('click');
  s.audio.paused = true;
  await s.audio.fire('ended');
  assert.equal(s.play.getAttribute('aria-pressed'), 'false');
  assert.equal(s.play.getAttribute('aria-label'), '播放示例旁白');
});

test('failed media playback exposes an error and allows reloading and retrying', async () => {
  const s = setup({ playImpl: audio => audio.playCount === 1 ? Promise.reject(new Error('unavailable')) : Promise.resolve() });
  await s.play.fire('click');
  assert.equal(s.player.dataset.state, 'idle');
  assert.equal(s['audio-error'].hidden, false);
  assert.match(s['audio-error'].textContent, /无法播放.*重试/);
  s.audio.error = { code: 3 };
  await s.audio.fire('error');
  await s.play.fire('click');
  assert.equal(s.audio.loadCount, 1);
  assert.equal(s['audio-error'].hidden, true);
  assert.equal(s.player.dataset.state, 'playing');
});

test('cancelling a pending play ignores its stale result without reporting a failure', async () => {
  let resolvePlay;
  const s = setup({ playImpl: () => new Promise(resolve => { resolvePlay = resolve; }) });
  const starting = s.play.fire('click');
  assert.match(s.play.getAttribute('aria-label'), /取消播放/);
  await s.play.fire('click');
  resolvePlay();
  await starting;
  assert.equal(s.audio.paused, true);
  assert.equal(s.player.dataset.state, 'idle');
  assert.equal(s.play.getAttribute('aria-pressed'), 'false');
  assert.equal(s['audio-error'].hidden, true);
});

test('hidden or departed pages stop audio; restored pages resume navigation observation only', async () => {
  const s = setup();
  s.observer.callback([{ isIntersecting: true }]);
  assert.deepEqual(s.links.map(link => link.getAttribute('aria-current')), ['location', 'location']);
  s.observer.callback([{ isIntersecting: false }]);
  assert.deepEqual(s.links.map(link => link.getAttribute('aria-current')), [null, null]);
  await s.play.fire('click');
  s.document.hidden = true;
  await s.document.fire('visibilitychange');
  assert.equal(s.audio.paused, true);
  s.document.hidden = false;
  await s.document.fire('visibilitychange');
  assert.equal(s.audio.playCount, 1);
  await s.play.fire('click');
  await s.window.fire('pagehide');
  assert.equal(s.audio.paused, true);
  assert.equal(s.observer.disconnected, true);
  await s.window.fire('pageshow', { persisted: true });
  assert.equal(s.observer.disconnected, false);
  assert.equal(s.audio.playCount, 2);
});
