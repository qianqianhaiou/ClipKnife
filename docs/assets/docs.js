(function () {
  'use strict';

  const headingCounts = new Map();

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function slugify(text) {
    const base = text
      .trim()
      .toLowerCase()
      .replace(/[`*_~()[\]{}:：，。、“”‘’!?！？]/g, '')
      .replace(/\s+/g, '-');
    const slug = base || 'section';
    const count = (headingCounts.get(slug) || 0) + 1;
    headingCounts.set(slug, count);
    return count === 1 ? slug : `${slug}-${count}`;
  }

  function renderInline(text) {
    return escapeHtml(text)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, href) {
        const safeHref = href.replace(/"/g, '&quot;');
        return `<a href="${safeHref}">${label}</a>`;
      });
  }

  function closeList(state, html) {
    if (state.listType) {
      html.push(`</${state.listType}>`);
      state.listType = '';
    }
  }

  function renderMarkdown(markdown) {
    headingCounts.clear();
    const html = [];
    const toc = [];
    const state = { listType: '' };
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');

    lines.forEach(function (line) {
      const trimmed = line.trim();

      if (!trimmed) {
        closeList(state, html);
        return;
      }

      const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
      if (heading) {
        closeList(state, html);
        const level = heading[1].length;
        const text = heading[2].trim();
        const id = slugify(text);
        html.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
        toc.push({ level, text, id });
        return;
      }

      const image = /^!\[([^\]]*)\]\(([^)]+)\)$/.exec(trimmed);
      if (image) {
        closeList(state, html);
        const alt = escapeHtml(image[1] || '文档图片');
        const src = image[2].replace(/"/g, '&quot;');
        html.push(`<figure class="doc-image"><img src="${src}" alt="${alt}" loading="lazy" data-placeholder="${src}"><figcaption>${alt}</figcaption></figure>`);
        return;
      }

      if (/^[-*]\s+/.test(trimmed)) {
        if (state.listType !== 'ul') {
          closeList(state, html);
          html.push('<ul>');
          state.listType = 'ul';
        }
        html.push(`<li>${renderInline(trimmed.replace(/^[-*]\s+/, ''))}</li>`);
        return;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        if (state.listType !== 'ol') {
          closeList(state, html);
          html.push('<ol>');
          state.listType = 'ol';
        }
        html.push(`<li>${renderInline(trimmed.replace(/^\d+\.\s+/, ''))}</li>`);
        return;
      }

      if (/^>\s?/.test(trimmed)) {
        closeList(state, html);
        html.push(`<blockquote>${renderInline(trimmed.replace(/^>\s?/, ''))}</blockquote>`);
        return;
      }

      closeList(state, html);
      html.push(`<p>${renderInline(trimmed)}</p>`);
    });

    closeList(state, html);
    return { html: html.join('\n'), toc };
  }

  function renderToc(toc) {
    const tocEl = document.getElementById('docToc');
    if (!tocEl) return;
    const items = toc.filter(function (entry) {
      return entry.level === 2 || entry.level === 3;
    });
    if (!items.length) {
      tocEl.innerHTML = '<p class="doc-muted">暂无目录</p>';
      return;
    }
    tocEl.innerHTML = items.map(function (entry) {
      return `<a class="toc-link toc-level-${entry.level}" href="#${entry.id}">${escapeHtml(entry.text)}</a>`;
    }).join('');
  }

  function prepareImageFallbacks(root) {
    root.querySelectorAll('img[data-placeholder]').forEach(function (img) {
      img.addEventListener('error', function () {
        const figure = img.closest('.doc-image');
        if (!figure || figure.querySelector('.doc-image-placeholder')) return;
        img.hidden = true;
        const placeholder = document.createElement('div');
        placeholder.className = 'doc-image-placeholder';
        placeholder.textContent = `请放置图片：${img.getAttribute('data-placeholder')}`;
        figure.insertBefore(placeholder, figure.firstChild);
      });
    });
  }

  function setTitleFromContent(root) {
    const title = root.querySelector('h1');
    if (title) {
      document.title = `${title.textContent} - ClipKnife`;
    }
  }

  function loadDocument() {
    const mount = document.querySelector('[data-doc-src]');
    if (!mount) return;
    const src = mount.getAttribute('data-doc-src');
    const status = document.getElementById('docStatus');

    fetch(src)
      .then(function (response) {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.text();
      })
      .then(function (markdown) {
        const rendered = renderMarkdown(markdown);
        mount.innerHTML = rendered.html;
        renderToc(rendered.toc);
        prepareImageFallbacks(mount);
        setTitleFromContent(mount);
        if (status) status.hidden = true;
      })
      .catch(function (error) {
        if (status) {
          status.hidden = false;
          status.innerHTML = `文档加载失败：${escapeHtml(error.message)}。<a href="${src}">打开 Markdown 源文件</a>`;
        }
      });
  }

  window.renderMarkdown = renderMarkdown;
  loadDocument();
})();
