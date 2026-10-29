(function () {
  'use strict';
  const scenario = new URLSearchParams(location.search).get('qa');
  const errors = [];
  const interactions = [];
  if (scenario === 'storage-denied') {
    Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Local QA storage denial', 'SecurityError'); } });
  }
  if (scenario === 'corrupt-session') sessionStorage.setItem('clipknife:website-demo:v1', '{broken');
  window.addEventListener('error', event => { if (event.message) errors.push(event.message); });
  window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
  const originalError = console.error;
  console.error = function (...args) { errors.push(args.map(String).join(' ')); originalError.apply(console, args); };
  const pause = (ms = 100) => new Promise(resolve => setTimeout(resolve, ms));
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const check = (name, passed) => { interactions.push({ name, passed: Boolean(passed) }); if (!passed) throw new Error(name); };
  async function until(test, description, timeout = 12000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if (test()) return; await pause(50); }
    throw new Error('Timeout: ' + description);
  }
  async function click(selector, root = document) {
    const node = $(selector, root);
    if (!node) throw new Error('Missing control: ' + selector);
    node.focus(); node.click(); await pause(); return node;
  }
  async function textInput(selector, value) {
    const node = $(selector);
    if (!node) throw new Error('Missing input: ' + selector);
    node.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true })); await pause();
  }
  async function key(key, target = document.activeElement, extra = {}) {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true, ...extra }));
    await pause(220);
  }
  async function search(query) {
    if (!$('.search-command')) await click('.desktop-nav-link:nth-child(2)');
    await textInput('[aria-label="描述你想找的画面"]', query);
    await click('.search-submit');
    await until(() => $('.gallery-scroll[aria-busy="false"]'), 'search settled');
  }
  const state = () => JSON.parse(sessionStorage.getItem('clipknife:website-demo:v1'));

  async function run() {
    if (scenario.startsWith('homepage-')) {
      await until(() => $('.home-page'), 'homepage content');
      // Capture a stable section after exercising focus, independently of smooth scrolling.
      document.documentElement.style.scrollBehavior = 'auto';
      check('creative assistant section is removed', !$('#assistantTitle') && !$('#creationTitle'));
      const screenshots = $$('img[src^="assets/screenshots/"]');
      check('four current interface screenshots', screenshots.length === 4);
      await Promise.all(screenshots.map(async image => { image.loading = 'eager'; await image.decode(); }));
      check('screenshots have full source dimensions', screenshots.every(image => image.naturalWidth === Number(image.getAttribute('width')) && image.naturalHeight === Number(image.getAttribute('height'))));
      check('homepage anchors resolve', $$('a[href^="#"]').every(link => link.hash === '' || link.hash === '#' || document.getElementById(link.hash.slice(1))));
      check('original-image links resolve to the displayed images', $$('.screenshot-link').every(link => link.href === $('img', link).src));
      if (getComputedStyle($('#menuBtn')).display !== 'none') {
        await click('#menuBtn');
        check('mobile navigation opens', $('#menuBtn').getAttribute('aria-expanded') === 'true' && getComputedStyle($('#mobileMenu')).display !== 'none');
        await key('Escape', $('#menuBtn'));
        check('mobile navigation closes on Escape', $('#menuBtn').getAttribute('aria-expanded') === 'false');
      }
      await until(() => $('[data-hero-reel][data-enhanced]'), 'hero scene controls');
      await Promise.all($$('[data-hero-photo] img').map(image => image.decode()));
      check('hero uses three local sample images', $$('[data-hero-photo] img').length === 3 && $$('[data-hero-photo] img').every(image => image.naturalWidth === 1280 && image.naturalHeight === 720));
      await click('[data-hero-scene][aria-controls="heroStreet"]');
      check('scene selection brings the matching photo forward', $('#heroStreet').dataset.position === 'front' && $('[data-hero-description]').textContent.includes('雨后'));
      await key('ArrowRight');
      check('scene arrow navigation changes photo and focus', document.activeElement.getAttribute('aria-controls') === 'heroForest' && $('#heroForest').dataset.position === 'front');
      await key('Home');
      check('scene Home key restores the first sample', $('#heroSunset').dataset.position === 'front' && $$('[data-hero-scene][aria-pressed="true"]').length === 1);
      await until(() => $('[data-home-showcase][data-enhanced]'), 'screenshot tabs');
      check('search panel is the initial selection', !$('#searchPanel').hidden && $('#storyboardPanel').hidden && $('#searchTab').getAttribute('aria-selected') === 'true');
      await click('#storyboardTab');
      check('click selects the storyboard panel', $('#searchPanel').hidden && !$('#storyboardPanel').hidden && $('#storyboardTab').tabIndex === 0);
      await key('ArrowLeft', $('#storyboardTab'));
      check('arrow key selects search and moves focus', document.activeElement === $('#searchTab') && !$('#searchPanel').hidden && $('#storyboardPanel').hidden);
      await key('End', $('#searchTab'));
      check('End selects the last screenshot', document.activeElement === $('#storyboardTab') && !$('#storyboardPanel').hidden);
      await key('Home', $('#storyboardTab'));
      check('Home restores the first screenshot', document.activeElement === $('#searchTab') && !$('#searchPanel').hidden);
      if (scenario === 'homepage-scene') await click('[data-hero-scene][aria-controls="heroStreet"]');
      if (scenario === 'homepage-video') await click('#storyboardTab');
      if (scenario === 'homepage-reduced') {
        check('reduced-motion preference applied', matchMedia('(prefers-reduced-motion: reduce)').matches);
        check('hero and screenshot animations are disabled', ['.hero-copy', '.hero-visual', '.site-demo', '#searchPanel'].every(selector => getComputedStyle($(selector)).animationName === 'none'));
      }
      if (scenario === 'homepage-download' || scenario === 'homepage-modal') {
        await click('#otherDownloadBtn');
        check('offline download dialog opens', !$('#downloadModal').classList.contains('hidden') && document.body.style.overflow === 'hidden');
        await key('Escape');
        await pause(250);
        check('Escape closes the dialog and restores scrolling', $('#downloadModal').classList.contains('hidden') && document.body.style.overflow === '');
      }
      if (scenario === 'homepage-faq') {
        await click('.faq-item summary');
        check('FAQ answer can be expanded', $('.faq-item').open);
      }
      const target = {
        'homepage-top': '.home-hero',
        'homepage-scene': '.home-hero',
        'homepage-reduced': '.home-hero',
        'homepage-faq': '#faq',
        'homepage-values': '.home-values',
        'homepage-workflow': '#workflow',
        'homepage-search': '.home-showcase',
        'homepage-video': '.home-showcase',
        'homepage-tools': '#creation',
        'homepage-download': '#download',
        'homepage-modal': '#download'
      }[scenario];
      if (!target) throw new Error('Unknown homepage screenshot scenario: ' + scenario);
      const top = ['homepage-top', 'homepage-reduced', 'homepage-scene'].includes(scenario) ? 0 : $(target).getBoundingClientRect().top + scrollY - 84;
      window.scrollTo({ top, behavior: 'instant' });
      document.activeElement?.blur();
      await pause(650);
      if (!['homepage-top', 'homepage-reduced', 'homepage-scene'].includes(scenario)) {
        window.scrollTo({ top: $(target).getBoundingClientRect().top + scrollY - 84, behavior: 'instant' });
        await pause(200);
        check('captured section begins below the fixed header', Math.abs($(target).getBoundingClientRect().top - 84) < 3 || scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
      }
      check('screenshot sections fit the viewport width', screenshots.every(image => image.getBoundingClientRect().right <= innerWidth + 1));
      check('hero actions fit inside the first viewport', $('.hero-actions').getBoundingClientRect().bottom + scrollY < innerHeight);
      check('hero frames remain inside the viewport', $$('[data-hero-photo]').every(photo => { const bounds = photo.getBoundingClientRect(); return bounds.left >= 0 && bounds.right <= innerWidth; }));
      check('scene controls do not overlap the front photo', $('.hero-scene-controls').getBoundingClientRect().top >= $('[data-hero-photo][data-position="front"]').getBoundingClientRect().bottom);
      check('page uses a compact vertical rhythm', $$('.home-section').every(section => parseFloat(getComputedStyle(section).paddingTop) <= 56));
      if (scenario === 'homepage-modal') {
        await click('#otherDownloadBtn');
        await pause(300);
        const panel = $('#downloadModal [data-modal-panel]').getBoundingClientRect();
        check('download dialog fits the viewport', panel.left >= 0 && panel.right <= innerWidth && panel.top >= 0 && panel.bottom <= innerHeight);
      }
      return;
    }

    if (scenario === 'document') {
      await until(() => !$('.doc-content') || $('.doc-content').textContent.length > 200, 'document markdown');
      await pause(600);
      check('document loaded over HTTP', document.body.textContent.length > 500);
      return;
    }
    if (scenario === 'home' || scenario === 'home-mobile' || scenario === 'home-video') {
      await until(() => $('[data-demo-host]'), 'homepage');
      $('#demo').scrollIntoView({ block: 'start' });
      if (innerWidth < 1200) {
        check('narrow homepage uses compact navigation', getComputedStyle($('.site-header nav>ul')).display === 'none');
        await click('#menuBtn');
        check('compact menu opens', $('#menuBtn').getAttribute('aria-expanded') === 'true' && getComputedStyle($('#mobileMenu')).display !== 'none');
        await click('#menuBtn');
        check('compact menu closes', $('#menuBtn').getAttribute('aria-expanded') === 'false');
      }
      if (scenario === 'home-mobile') { await pause(600); check('mobile has no iframe', !$('[data-demo-live] iframe')); return; }
      await until(() => $('[data-demo-host][data-ready="true"]'), 'embedded ready');
      const frame = $('[data-demo-live] iframe');
      if (location.protocol === 'file:') {
        // Chromium isolates local documents; never bypass origin protections.
        // App sends readiness only after React commits; its interactions run in
        // the separate file:// workflow scenario, within that document's origin.
        check('local iframe targets an explicit HTML document', /\/demo\/index\.html\?embed=1$/.test(frame.src));
        await until(() => getComputedStyle($('[data-demo-live]')).opacity === '1', 'embedded fade-in complete');
        check('local iframe is visible after readiness', getComputedStyle($('[data-demo-live]')).opacity === '1');
        await pause(400); return;
      }
      check('embedded demo mounted', $('.demo-app', frame.contentDocument));
      if (scenario === 'home-video') {
        const inside = frame.contentDocument;
        await click('[data-asset="coast-film"] .preview-button', inside);
        await until(() => $('.video-preview', inside)?.dataset.playing === 'true', 'embedded playback');
        const before = Number($('.video-progress', inside).value);
        await until(() => Number($('.video-progress', inside).value) > before, 'embedded timeline advances', 3000);
        check('embedded player advances', Number($('.video-progress', inside).value) > before);
        check('embedded player keeps footer reachable', $('.preview-footer', inside).getBoundingClientRect().bottom <= frame.clientHeight);
        await click('.playback-toggle', inside);
        check('embedded player pauses', $('.video-preview', inside).dataset.playing === 'false');
        return;
      }
      await click('.desktop-nav-link:nth-child(2)', frame.contentDocument);
      check('embedded search responds', $('.search-intro', frame.contentDocument));
      await click('.desktop-nav-link:first-child', frame.contentDocument);
      await pause(400); return;
    }
    if (scenario === 'mobile') {
      await pause(500);
      check('static mobile preview', $('.demo-fallback') && !$('.demo-app'));
      check('React chunk not fetched on mobile', !performance.getEntriesByType('resource').some(entry => /\/main\.js/.test(entry.name)));
      return;
    }
    if (scenario === 'module-error') {
      await until(() => document.documentElement.dataset.demoError === 'true', 'module failure');
      check('module error offers retry', !$('.fallback-retry').hidden);
      check('retry is visible without scrolling', $('.fallback-retry').getBoundingClientRect().bottom < innerHeight);
      check('module error keeps preview', $('.fallback-visual img').complete);
      const expected = errors.filter(error => error.includes('Demo module failed to load'));
      check('module failure was observed', expected.length === 1);
      errors.splice(errors.indexOf(expected[0]), 1);
      return;
    }
    await until(() => $('.demo-app') && document.documentElement.dataset.demoReady, 'React app');
    if (scenario === 'session' && new URLSearchParams(location.search).get('restored')) {
      check('import survives a real reload', state().imported);
      check('custom group survives a real reload', state().groups.some(group => group.name === '跨刷新分组'));
      check('selected group restored', $('.group-header h1')?.textContent === '跨刷新分组');
      return;
    }
    await until(() => $$('.media-card img').slice(0, 4).every(image => image.complete), 'visible images');
    check('initial library has 24 fixtures', $$('.media-card').length === 24);
    check('type labels stay on one line', $$('.type-grid button>span').every(node => node.getBoundingClientRect().height < 25));
    check('summary has no conditional zero', !$('.library-summary') || !/0\s*共/.test($('.library-summary').textContent));
    if (scenario === 'storage-denied' || scenario === 'corrupt-session') {
      await search('海边日落');
      check('search survives unavailable or corrupt storage', $$('.media-card').length > 0);
      return;
    }
    if (scenario === 'reduced-motion') {
      check('system reduced motion is enabled', matchMedia('(prefers-reduced-motion: reduce)').matches);
      check('card animation disabled', getComputedStyle($('.media-card')).animationName === 'none');
      await click('[data-asset="coast-film"] .preview-button');
      check('dialog animation disabled', getComputedStyle($('.preview-dialog')).animationName === 'none');
      return;
    }
    if (scenario === 'library') return;
    if (scenario === 'session') {
      await click('.import-trigger'); await click('.dialog-actions .primary');
      await click('[role="tab"]:nth-child(3)'); await click('.new-group-link');
      await textInput('.group-form input', '跨刷新分组'); await click('.group-form button');
      const url = new URL(location.href); url.searchParams.set('restored', '1');
      location.replace(url.href);
      await new Promise(() => {});
    }
    if (scenario === 'search-landing') { await click('.desktop-nav-link:nth-child(2)'); return; }
    if (scenario === 'search') { await search('海边日落'); return; }
    if (scenario === 'empty') { await search('深空飞船9837'); check('empty state visible', $('.empty-state')); return; }
    if (scenario === 'groups') { await click('[role="tab"]:nth-child(3)'); return; }
    if (scenario === 'advanced') { await search('海边日落'); await click('.advanced-button'); await key('ArrowDown', $('[aria-label="素材来源"]')); return; }
    if (scenario === 'detail') { await click('[data-asset="coast-film"] .tile-hit'); return; }
    if (scenario === 'image-preview') {
      await click('[data-asset="mountain"] .preview-button');
      check('image preview stays separate from video controls', !$('.video-preview') && $('.preview-stage img'));
      await click('.preview-controls .text-button');
      check('image zoom still works', $('.preview-stage.zoomed'));
      await key('Escape');
      await click('[data-asset="voice"] .preview-button');
      check('audio stays metadata-only', $('.audio-dialog') && !$('.video-preview'));
      return;
    }
    if (['video-playback', 'video-reduced', 'video-portrait', 'video-snapshot'].includes(scenario)) {
      const portrait = scenario === 'video-portrait';
      await click(`[data-asset="${portrait ? 'coast-walk' : 'coast-film'}"] .preview-button`);
      await until(() => $('.playback-toggle') && !$('.playback-toggle').disabled, 'video frame ready');
      const head = () => Number($('.video-progress').value);
      const moving = () => $('.video-preview').dataset.playing === 'true';
      const transform = () => getComputedStyle($('.video-frame')).transform;
      if (portrait) {
        check('portrait video keeps a portrait canvas', $('.video-canvas').clientHeight > $('.video-canvas').clientWidth);
        check('portrait video plays', moving());
        return;
      }
      if (scenario === 'video-reduced') {
        check('reduced motion starts paused', matchMedia('(prefers-reduced-motion: reduce)').matches && !moving());
        check('reduced motion disables camera transforms', transform() === 'none');
        await click('.playback-toggle'); const before = head(); await pause(350);
        check('explicit play still advances time', head() > before);
        check('explicit play keeps camera still', transform() === 'none');
        check('reduced motion removes shot fade', getComputedStyle($('.video-frame')).animationName === 'none');
        return;
      }
      if (scenario === 'video-snapshot') {
        await click('.playback-toggle'); await textInput('.video-progress', '8'); return;
      }
      check('video opens playing after the frame loads', moving());
      const before = head(), firstTransform = transform(); await pause(450);
      check('play advances the timeline', head() > before);
      check('play moves the still image', transform() !== firstTransform);
      await click('.playback-toggle'); const paused = head(), pausedTransform = transform(); await pause(300);
      check('pause freezes time and camera', head() === paused && transform() === pausedTransform && !moving());
      await textInput('.video-progress', '11.8'); await click('.playback-toggle');
      await until(() => $('.preview-shots>button:nth-of-type(2)').getAttribute('aria-pressed') === 'true', 'automatic shot cut');
      check('play automatically advances the shot', head() >= 12);
      await until(moving, 'next frame ready');
      const panStart = transform(); await pause(250);
      check('second shot pans across the image', transform() !== panStart);
      await click('.preview-footer .primary'); const nestedTime = head(); await pause(220);
      check('group dialog pauses playback', !moving() && head() === nestedTime);
      await click('.group-picker button:first-child');
      check('group receives the visible shot', state().groups[0].members.some(ref => ref.assetId === 'coast-film' && ref.shotId === 'coast-film-shot-2'));
      await key('Escape');
      check('closing nested dialog restores focus and stays paused', document.activeElement === $('.preview-footer .primary') && !moving());
      await click('.playback-toggle');
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange')); await pause();
      check('hidden page pauses the player', !moving());
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
      await textInput('.video-progress', '47.8');
      await until(() => !$('.playback-toggle').disabled, 'last frame ready'); await click('.playback-toggle');
      await until(() => $('.playback-toggle').getAttribute('aria-label') === '重播演示', 'playback end');
      check('end stops exactly at duration', head() === 48 && !moving());
      await click('.playback-toggle');
      await until(moving, 'replay ready'); check('replay starts at the first shot', head() < 2);
      await key('Escape'); check('close removes the playback surface', !$('.video-preview'));
      await click('[data-asset="coast-film"] .preview-button');
      await until(() => !$('.playback-toggle').disabled, 'reopened frame ready');
      check('reopening starts a fresh preview', head() < 2);
      return;
    }
    if (scenario === 'preview' || scenario === 'nested' || scenario === 'image-error') {
      await click('[data-asset="coast-film"] .preview-button');
      await click('[aria-label="下一分镜"]');
      check('second shot selected', $('.preview-controls').textContent.includes('分镜 2 / 4'));
      if (scenario === 'nested') {
        await click('.preview-footer .primary');
        check('nested group picker opens', $('.group-picker'));
        await key('Escape');
        check('Escape closes top dialog only', !$('.group-picker') && $('.preview-dialog'));
        check('focus restored inside preview', document.activeElement === $('.preview-footer .primary'));
        await click('.preview-footer .primary');
      }
      if (scenario === 'image-error') {
        $('.preview-stage img').dispatchEvent(new Event('error')); await pause();
        check('image failure shows fallback', $('.preview-stage .photo-error'));
        check('failed video frame pauses playback', $('.video-preview').dataset.playing === 'false');
        await click('.preview-stage .photo-error button');
        await until(() => $('.preview-stage img')?.complete, 'image retry');
        check('image retry recovers', !$('.preview-stage .photo-error'));
      }
      return;
    }
    if (scenario !== 'workflow') throw new Error('Unknown scenario: ' + scenario);

    // Drive DOM controls, not React internals. Includes cancellation, invalid input,
    // idempotency, nested dialogs, Radix selection and session persistence.
    const opener = await click('[data-asset="coast-film"] .tile-hit');
    check('detail opens', $('.inspector') || $('.compact-inspector-dialog'));
    await key('Escape');
    check('Escape closes detail', !$('.inspector') && !$('.compact-inspector-dialog'));
    check('detail restores focus', document.activeElement === opener);
    await click('[data-asset="coast-film"] .preview-button');
    await click('[aria-label="下一分镜"]');
    check('preview advances still frame', $('.preview-controls').textContent.includes('分镜 2 / 4'));
    await click('.preview-footer .primary');
    const pickerLast = $('.new-group-picker');
    pickerLast.focus(); await key('Tab', pickerLast);
    check('dialog traps forward Tab', document.activeElement === $$('.dialog [aria-label="关闭弹窗"]').at(-1));
    const initialCount = state().groups[0].members.length;
    await click('.group-picker button:first-child');
    await click('.group-picker button:first-child');
    check('repeated add is idempotent', state().groups[0].members.length === initialCount + 1);
    await key('Escape');
    check('nested focus restoration', document.activeElement === $('.preview-footer .primary'));
    await key('Escape');
    check('preview closed', !$('.preview-dialog'));

    await search('海边日落');
    check('relevant results', $$('.media-card').length > 0 && $('[data-asset="coast-film"]'));
    await click('.advanced-button');
    await key('ArrowDown', $('[aria-label="画面方向"]'));
    await until(() => $('[role="option"]'), 'Radix options');
    const portrait = $$('[role="option"]').find(option => option.textContent.includes('竖屏'));
    portrait.focus(); await key('Enter', portrait);
    check('Radix select updates state', state().search.orientation === 'portrait');
    await click('.advanced-dialog .dialog-actions .primary');
    check('portrait filter intersects query', $$('.media-card').length === 1 && $('[data-asset="coast-walk"]'));
    await click('.active-filters button:last-child');
    await search('深空飞船9837');
    check('unmatched query is recoverable', $('.empty-state'));
    await click('.empty-state button');
    await until(() => $('.gallery-scroll[aria-busy="false"]'), 'recovered search');
    check('empty state recovery', $$('.media-card').length > 0);

    await click('.desktop-nav-link:first-child');
    await click('[role="tab"]:nth-child(3)');
    await click('.new-group-link');
    check('blank group cannot submit', $('.group-form button').disabled);
    await textInput('.group-form input', '长名称分组'.repeat(10));
    await click('.group-form button');
    check('new group is selected and empty', $('.group-header h1').textContent.length === 50 && $('.empty-state'));
    await click('.empty-state button');
    await click('.import-trigger');
    await click('.dialog-actions .primary');
    check('sample import adds exactly three', state().imported && $$('.media-card').length === 3);
    await click('.import-trigger');
    check('repeat import disabled', $('.dialog-actions .primary').disabled);
    await key('Escape');
    await click('.experience-bar button');
    await click('.dialog-actions .primary');
    check('reset restores fixture data', !state().imported && state().groups.length === 2 && $$('.media-card').length === 24);
  }

  window.addEventListener('DOMContentLoaded', async () => {
    try { await run(); }
    catch (error) { errors.push(String(error)); }
    await pause(500);
    const overflow = document.documentElement.scrollWidth > innerWidth + 1;
    interactions.push({ name: 'no horizontal page overflow', passed: !overflow });
    const report = { scenario, width: innerWidth, height: innerHeight, dpr: devicePixelRatio, errors, interactions,
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
      imageCount: $$('img').length, imageFailures: $$('img').filter(img => img.complete && !img.naturalWidth).map(img => img.getAttribute('src')) };
    // Wry 0.55's IPC URI parser rejects file URLs. The isolated file host reads
    // the title instead; this does not change the page's origin or security flags.
    if (location.protocol === 'file:') document.title = 'demo-qa:' + JSON.stringify(report);
    else if (window.ipc) window.ipc.postMessage(JSON.stringify(report));
  });
})();
