(function () {
  'use strict';

  // Current year in footer
  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear().toString();
  }

  // Mobile menu toggle
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  function toggleMenu(open) {
    if (!mobileMenu || !menuBtn) return;
    if (open) {
      mobileMenu.classList.remove('hidden');
      menuBtn.setAttribute('aria-expanded', 'true');
    } else {
      mobileMenu.classList.add('hidden');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  }

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener('click', function () {
      const isOpen = menuBtn.getAttribute('aria-expanded') === 'true';
      toggleMenu(!isOpen);
    });

    // Close mobile menu when a link is clicked
    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        toggleMenu(false);
      });
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
        toggleMenu(false);
      }
    });
  }

  // Other download links modal
  const downloadModal = document.getElementById('downloadModal');
  const otherDownloadBtn = document.getElementById('otherDownloadBtn');
  const modalBackdrop = downloadModal ? downloadModal.querySelector('[data-modal-backdrop]') : null;
  const modalPanel = downloadModal ? downloadModal.querySelector('[data-modal-panel]') : null;
  const modalCloseBtns = downloadModal ? downloadModal.querySelectorAll('[data-modal-close]') : [];

  function setModalOpen(open) {
    if (!downloadModal) return;
    if (open) {
      downloadModal.classList.remove('hidden');
      // Force reflow to enable the enter transition
      void downloadModal.offsetWidth;
      if (modalBackdrop) modalBackdrop.classList.remove('opacity-0');
      if (modalPanel) {
        modalPanel.classList.remove('scale-95', 'opacity-0');
        modalPanel.classList.add('scale-100', 'opacity-100');
      }
      document.body.style.overflow = 'hidden';
    } else {
      if (modalBackdrop) modalBackdrop.classList.add('opacity-0');
      if (modalPanel) {
        modalPanel.classList.remove('scale-100', 'opacity-100');
        modalPanel.classList.add('scale-95', 'opacity-0');
      }
      setTimeout(function () {
        downloadModal.classList.add('hidden');
        document.body.style.overflow = '';
      }, 200);
    }
  }

  if (otherDownloadBtn) {
    otherDownloadBtn.addEventListener('click', function () {
      setModalOpen(true);
    });
  }

  if (modalCloseBtns.length) {
    modalCloseBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setModalOpen(false);
      });
    });
  }

  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', function () {
      setModalOpen(false);
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && downloadModal && !downloadModal.classList.contains('hidden')) {
      setModalOpen(false);
    }
  });

  // Smooth scroll with offset for fixed header
  function scrollBehavior() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = anchor.getAttribute('href');
      if (!href) return;
      if (href === '#') {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: scrollBehavior() });
        return;
      }
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const headerOffset = 80;
      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: scrollBehavior()
      });
    });
  });

  // Prepare only offscreen sections; visible content must never fade back out.
  const revealElements = document.querySelectorAll('.reveal');
  const reducedMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  function showWithoutMotion(el) {
    el.classList.remove('reveal-motion');
    el.classList.add('is-visible');
  }

  if ('IntersectionObserver' in window && revealElements.length && !(reducedMotion && reducedMotion.matches)) {
    const lead = 120;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px ' + lead + 'px 0px',
        threshold: 0
      }
    );
    revealElements.forEach(function (el) {
      if (el.getBoundingClientRect().top <= viewportHeight + lead) {
        showWithoutMotion(el);
      } else {
        el.classList.add('reveal-motion');
        observer.observe(el);
      }
    });

    function finishReveals() {
      observer.disconnect();
      revealElements.forEach(showWithoutMotion);
    }

    document.addEventListener('focusin', function (event) {
      const target = event.target.closest ? event.target.closest('.reveal') : null;
      if (!target || !target.classList.contains('reveal-motion')) return;
      showWithoutMotion(target);
      observer.unobserve(target);
    });
    if (reducedMotion && reducedMotion.addEventListener) {
      reducedMotion.addEventListener('change', function (event) {
        if (event.matches) finishReveals();
      });
    }
    window.addEventListener('pagehide', function () { observer.disconnect(); });
    window.addEventListener('pageshow', function (event) {
      if (event.persisted) finishReveals();
    });
  } else {
    revealElements.forEach(showWithoutMotion);
  }
})();
