const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname, '..', 'docs/assets/home.js'), 'utf8');

function setup({ missingPanel = false, missingShowcase = false } = {}) {
  let focused = null;
  function element(id, attributes = {}) {
    const listeners = new Map();
    return {
      id, hidden: false, tabIndex: 0, dataset: {}, attributes, listeners,
      getAttribute: name => attributes[name],
      setAttribute: (name, value) => { attributes[name] = value; },
      addEventListener: (name, callback) => listeners.set(name, callback),
      focus(options) { focused = this; this.focusOptions = options; },
    };
  }
  const tablist = element('tabs');
  tablist.hidden = true;
  const panels = [element('searchPanel'), element('storyboardPanel')];
  const tabs = panels.map((panel, i) => element('tab' + i, { 'aria-controls': panel.id }));
  const showcase = element('showcase');
  showcase.querySelector = () => tablist;
  showcase.querySelectorAll = () => tabs;
  const document = {
    body: { dataset: {} },
    querySelector: selector => selector === '[data-home-showcase]' && !missingShowcase ? showcase : null,
    getElementById: id => missingPanel && id === 'storyboardPanel' ? null : panels.find(panel => panel.id === id),
  };
  vm.runInNewContext(script, { document });
  return { tabs, panels, tablist, showcase, focused: () => focused };
}

test('screenshot tabs switch the visible figure and keep one keyboard stop', () => {
  const { tabs, panels, tablist } = setup();
  assert.equal(tablist.hidden, false);
  assert.deepEqual(panels.map(panel => panel.hidden), [false, true]);
  assert.equal(panels[0].attributes['role'], 'tabpanel');
  assert.equal(panels[0].attributes['aria-labelledby'], tabs[0].id);

  tabs[1].listeners.get('click')();
  assert.deepEqual(panels.map(panel => panel.hidden), [true, false]);
  assert.deepEqual(tabs.map(tab => tab.tabIndex), [-1, 0]);
  assert.deepEqual(tabs.map(tab => tab.attributes['aria-selected']), ['false', 'true']);
  tabs[0].listeners.get('click')();
  assert.deepEqual(panels.map(panel => panel.hidden), [false, true]);
});

test('arrow, Home and End keys select screenshots without scrolling the page', () => {
  const { tabs, panels, focused } = setup();
  function press(index, key, expected) {
    let prevented = false;
    tabs[index].listeners.get('keydown')({ key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(focused(), tabs[expected]);
    assert.equal(tabs[expected].focusOptions.preventScroll, true);
    assert.equal(panels[expected].hidden, false);
    assert.equal(tabs[1 - expected].tabIndex, -1);
  }
  press(0, 'ArrowLeft', 1);
  press(1, 'ArrowRight', 0);
  press(0, 'End', 1);
  press(1, 'Home', 0);
  let prevented = false;
  tabs[0].listeners.get('keydown')({ key: 'Tab', preventDefault() { prevented = true; } });
  assert.equal(prevented, false, 'ordinary Tab navigation must remain native');
});

test('incomplete or absent enhancement leaves the static figures readable', () => {
  for (const options of [{ missingPanel: true }, { missingShowcase: true }]) {
    const { panels, tablist, showcase } = setup(options);
    assert.equal(tablist.hidden, true);
    assert.deepEqual(panels.map(panel => panel.hidden), [false, false]);
    assert.equal(showcase.dataset.enhanced, undefined);
  }
});

function setupHero({ missingPhoto = false, missingDescription = false } = {}) {
  let focused = null;
  function node(id, attributes = {}) {
    const listeners = new Map();
    return {
      id, attributes, listeners, dataset: {},
      getAttribute: name => attributes[name],
      setAttribute: (name, value) => { attributes[name] = value; },
      addEventListener: (name, callback) => listeners.set(name, callback),
      focus(options) { focused = this; this.focusOptions = options; },
    };
  }
  const controls = { hidden: true };
  const description = { textContent: 'Sunset sample' };
  const photos = ['sunset', 'street', 'forest'].map(id => node(id));
  photos.forEach((photo, index) => { photo.dataset.position = ['front', 'left', 'right'][index]; });
  const buttons = photos.map((photo, index) => node('scene' + index, {
    'aria-controls': photo.id,
    'aria-pressed': String(index === 0),
    'data-description': ['Sunset sample', 'Rainy street sample', 'Forest sample'][index],
  }));
  const reel = node('reel');
  reel.querySelector = selector => selector === '.hero-scene-controls' ? controls : missingDescription ? null : description;
  reel.querySelectorAll = () => buttons;
  const document = {
    querySelector: selector => selector === '[data-hero-reel]' ? reel : null,
    getElementById: id => missingPhoto && id === 'forest' ? null : photos.find(photo => photo.id === id),
  };
  vm.runInNewContext(script, { document });
  return { controls, description, photos, buttons, reel, focused: () => focused };
}

test('hero scene selection changes the front image and its description together', () => {
  const { controls, photos, buttons, description } = setupHero();
  assert.equal(controls.hidden, false);
  buttons[1].listeners.get('click')();
  assert.equal(photos[1].dataset.position, 'front');
  assert.equal(photos[1].attributes['aria-hidden'], 'false');
  assert.equal(photos[0].attributes['aria-hidden'], 'true');
  assert.equal(description.textContent, 'Rainy street sample');
  assert.equal(buttons.filter(button => button.attributes['aria-pressed'] === 'true').length, 1);
  buttons[1].listeners.get('click')();
  assert.equal(photos.filter(photo => photo.dataset.position === 'front').length, 1);
});

test('hero scene keys wrap, preserve normal Tab and keep focus from scrolling', () => {
  const { photos, buttons, focused } = setupHero();
  for (const [from, key, to] of [[0, 'ArrowLeft', 2], [2, 'ArrowRight', 0], [0, 'End', 2], [2, 'Home', 0]]) {
    let prevented = false;
    buttons[from].listeners.get('keydown')({ key, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(focused(), buttons[to]);
    assert.equal(buttons[to].focusOptions.preventScroll, true);
    assert.equal(photos[to].dataset.position, 'front');
  }
  let prevented = false;
  buttons[0].listeners.get('keydown')({ key: 'Tab', preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});

test('incomplete hero markup retains the static scene without exposing inactive controls', () => {
  for (const options of [{ missingPhoto: true }, { missingDescription: true }]) {
    const { controls, photos, reel } = setupHero(options);
    assert.equal(controls.hidden, true);
    assert.equal(photos[0].dataset.position, 'front');
    assert.equal(reel.dataset.enhanced, undefined);
  }
});
