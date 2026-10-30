(function () {
  'use strict';

  const scene = document.querySelector('[data-comparison-scene]');
  if (!scene || scene.dataset.enhanced === 'true') return;
  const find = selector => scene.querySelector(selector);
  const form = find('[data-compare-search]');
  const query = find('[data-compare-query]');
  const clear = find('[data-compare-clear]');
  const empty = find('[data-compare-empty]');
  const selection = find('[data-compare-selection]');
  const range = find('[data-compare-range]');
  const filmstrip = find('[data-compare-filmstrip]');
  const status = find('[data-compare-status]');
  const cards = [...scene.querySelectorAll('[data-compare-result]')];
  if (!form || !query || !clear || !empty || !selection || !range || !filmstrip || !status || cards.length !== 2) return;
  if (cards.some(card => !card.dataset.keywords || !card.dataset.title || !card.dataset.range || !card.dataset.compareResult)) return;

  function select(card, moveFocus) {
    cards.forEach(item => {
      const active = item === card && !item.hidden;
      item.setAttribute('aria-pressed', String(active));
      item.tabIndex = active ? 0 : -1;
    });
    selection.hidden = !card;
    if (!card) return;
    range.textContent = card.dataset.range;
    filmstrip.dataset.selected = card.dataset.compareResult;
    filmstrip.setAttribute('aria-label', '示例分镜时间条，当前选中 ' + card.dataset.range);
    status.textContent = '已选择：' + card.dataset.title + '，' + card.dataset.range;
    if (moveFocus) card.focus({ preventScroll: true });
  }

  function search() {
    // This is an explicitly labelled, fixed-sample illustration, not an AI index.
    const phrase = query.value.trim().toLocaleLowerCase('zh-CN');
    cards.forEach(card => {
      card.hidden = Boolean(phrase) && !card.dataset.keywords.split(' ').some(word => phrase.includes(word));
    });
    const visible = cards.filter(card => !card.hidden);
    empty.hidden = visible.length > 0;
    const selected = visible.find(card => card.getAttribute('aria-pressed') === 'true') || visible[0];
    select(selected, false);
    status.textContent = visible.length ? '示例匹配 ' + visible.length + ' 项。' + status.textContent : '示例中暂无匹配画面，可前往在线体验查看更多素材。';
    clear.hidden = !query.value;
  }

  form.addEventListener('submit', event => { event.preventDefault(); search(); });
  query.addEventListener('input', () => { clear.hidden = !query.value; });
  clear.addEventListener('click', () => {
    query.value = '';
    search();
    query.focus({ preventScroll: true });
  });
  cards.forEach(card => {
    card.disabled = false;
    card.addEventListener('click', () => select(card, false));
    card.addEventListener('keydown', event => {
      const visible = cards.filter(item => !item.hidden);
      const index = visible.indexOf(card);
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % visible.length;
      else if (event.key === 'ArrowLeft') next = (index + visible.length - 1) % visible.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = visible.length - 1;
      else return;
      event.preventDefault();
      select(visible[next], true);
    });
  });
  clear.hidden = !query.value;
  select(cards.find(card => card.getAttribute('aria-pressed') === 'true') || cards[0], false);
  scene.dataset.enhanced = 'true';

  const section = document.getElementById('compare');
  if (section && 'IntersectionObserver' in window) {
    const links = [...document.querySelectorAll('.site-header a[href="#compare"]')];
    const observer = new window.IntersectionObserver(entries => {
      const active = entries.some(entry => entry.isIntersecting);
      links.forEach(link => {
        if (active) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    }, { rootMargin:'-64px 0px -45% 0px', threshold:0 });
    observer.observe(section);
    window.addEventListener('pagehide', () => observer.disconnect());
    window.addEventListener('pageshow', event => { if (event.persisted) observer.observe(section); });
  }

  const audio = find('[data-compare-audio]');
  const play = find('[data-compare-play]');
  const player = find('[data-compare-player]');
  const error = find('[data-compare-audio-error]');
  if (!audio || !play || !player || !error) return;
  let request = 0;
  let pending = false;

  function showPlayback(playing) {
    player.dataset.state = playing ? 'playing' : 'idle';
    play.setAttribute('aria-pressed', String(playing));
    play.setAttribute('aria-label', playing ? '暂停示例旁白' : '播放示例旁白');
  }

  function stop() {
    request += 1;
    pending = false;
    audio.pause();
    showPlayback(false);
  }

  function showFailure() {
    stop();
    error.textContent = '示例旁白暂时无法播放，请重试。';
    error.hidden = false;
  }

  play.disabled = false;
  play.addEventListener('click', async () => {
    if (pending || !audio.paused) { stop(); return; }
    const current = ++request;
    pending = true;
    error.hidden = true;
    play.setAttribute('aria-label', '取消播放示例旁白');
    try {
      if (audio.error) audio.load();
      await audio.play();
      if (current !== request) return;
      pending = false;
      showPlayback(true);
    } catch {
      if (current === request) showFailure();
    }
  });
  audio.addEventListener('ended', () => { pending = false; showPlayback(false); });
  audio.addEventListener('pause', () => showPlayback(false));
  audio.addEventListener('error', showFailure);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
})();
