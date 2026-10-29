(function () {
  'use strict';

  function initHeroScenes() {
    const reel = document.querySelector('[data-hero-reel]');
    if (!reel) return;
    const controls = reel.querySelector('.hero-scene-controls');
    const description = reel.querySelector('[data-hero-description]');
    const buttons = [...reel.querySelectorAll('[data-hero-scene]')];
    const photos = buttons.map(button => document.getElementById(button.getAttribute('aria-controls')));
    // The first sample remains a static illustration when enhancement is unavailable.
    if (!controls || !description || buttons.length !== 3 || photos.some(photo => !photo)) return;

    function selectScene(index, moveFocus) {
      photos.forEach((photo, position) => {
        const offset = (position - index + photos.length) % photos.length;
        photo.dataset.position = ['front', 'left', 'right'][offset];
        photo.setAttribute('aria-hidden', String(offset !== 0));
        buttons[position].setAttribute('aria-pressed', String(offset === 0));
      });
      description.textContent = buttons[index].getAttribute('data-description');
      if (moveFocus) buttons[index].focus({ preventScroll: true });
    }

    buttons.forEach((button, index) => {
      button.addEventListener('click', () => selectScene(index, false));
      button.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        else if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault();
        selectScene(next, true);
      });
    });
    controls.hidden = false;
    reel.dataset.enhanced = 'true';
  }

  initHeroScenes();

  const showcase = document.querySelector('[data-home-showcase]');
  if (!showcase) return;
  const tablist = showcase.querySelector('[role="tablist"]');
  const tabs = [...showcase.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  // Leave both figures readable if the enhancement cannot be initialized.
  if (!tablist || !tabs.length || panels.some(panel => !panel)) return;

  function selectTab(index, moveFocus) {
    tabs.forEach((tab, position) => {
      const selected = position === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[position].hidden = !selected;
    });
    if (moveFocus) tabs[index].focus({ preventScroll: true });
  }

  tabs.forEach((tab, index) => {
    panels[index].setAttribute('role', 'tabpanel');
    panels[index].setAttribute('aria-labelledby', tab.id);
    tab.addEventListener('click', () => selectTab(index, false));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(next, true);
    });
  });

  selectTab(0, false);
  tablist.hidden = false;
  showcase.dataset.enhanced = 'true';
  document.body.dataset.homeReady = 'true';
})();
