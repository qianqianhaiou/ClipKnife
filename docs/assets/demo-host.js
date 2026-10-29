(function () {
  'use strict';
  const host = document.querySelector('[data-demo-host]');
  const live = document.querySelector('[data-demo-live]');
  const start = document.querySelector('[data-demo-start]');
  const message = document.querySelector('[data-demo-message]');
  if (!host || !live || !start || !message) return;
  const wide = window.matchMedia('(min-width: 1024px)');
  let frame = null;
  let timeout = null;
  let ready = false;
  let inView = false;
  let observer;

  function fail() {
    if (ready) return;
    if (frame) frame.remove();
    frame = null;
    start.disabled = false;
    start.textContent = '重新加载演示 →';
    message.textContent = '演示暂未加载成功，请重试，或展开独立体验页。';
    if (timeout) window.clearTimeout(timeout);
    timeout = null;
  }
  function load() {
    if (!wide.matches || frame) return;
    ready = false;
    start.disabled = true;
    message.textContent = '正在准备示例素材…';
    frame = document.createElement('iframe');
    frame.title = '素刀可交互示例：素材浏览、智能搜索与分组';
    frame.src = 'demo/index.html?embed=1';
    frame.setAttribute('referrerpolicy', 'same-origin');
    frame.addEventListener('error', fail, { once: true });
    live.appendChild(frame);
    timeout = window.setTimeout(fail, 20000);
  }
  window.addEventListener('message', function (event) {
    const expectedOrigin = window.location.protocol === 'file:' ? 'null' : window.location.origin;
    if (!frame || event.origin !== expectedOrigin || event.source !== frame.contentWindow
      || !event.data || event.data.type !== 'clipknife-demo-ready') return;
    ready = true;
    host.setAttribute('data-ready', 'true');
    start.disabled = false;
    if (timeout) window.clearTimeout(timeout);
    timeout = null;
  });
  start.addEventListener('click', load);
  wide.addEventListener('change', function () {
    if (wide.matches && inView) load();
    else if (!wide.matches) {
      if (timeout) window.clearTimeout(timeout);
      timeout = null;
      if (frame) frame.remove();
      frame = null;
      ready = false;
      host.removeAttribute('data-ready');
      start.disabled = false;
    }
  });
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(function (entries) {
      inView = entries.some(function (entry) { return entry.isIntersecting; });
      if (inView) load();
    }, { rootMargin: '240px 0px' });
    observer.observe(host);
  }
  window.addEventListener('pagehide', function () {
    if (timeout) window.clearTimeout(timeout);
    timeout = null;
    if (observer) observer.disconnect();
  });
  window.addEventListener('pageshow', function (event) {
    if (!event.persisted) return;
    if (observer) observer.observe(host);
    if (frame && !ready) timeout = window.setTimeout(fail, 20000);
    if (inView) load();
  });
})();
