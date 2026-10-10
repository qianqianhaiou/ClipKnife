const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const os = require('node:os');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const generatorPath = path.join(__dirname, '..', 'scripts', 'prerender-docs.cjs');
const generatorRequire = createRequire(generatorPath);
const fixtureTemplate = (version) => `<html><head></head><body><nav id="docToc"></nav><div class="doc-content" data-doc-src="../../content/changelog/${version}.md"></div></body></html>`;

function createGeneratorFixture(t, entries = [{ version: 'v2.2.1', markdown: '# v2.2.1\n\n## 更新\n\n来源 A。' }]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-prerender-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pages = entries.map((entry) => {
    const { version, markdown } = entry;
    const page = `docs/changelog/${version}/index.html`;
    const source = `docs/content/changelog/${version}.md`;
    const pagePath = path.join(root, page);
    const sourcePath = path.join(root, source);
    fs.mkdirSync(path.dirname(pagePath), { recursive: true });
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    const template = fixtureTemplate(version);
    const original = entry.prerendered ? require(generatorPath).renderPage(template, markdown, `https://clipknife.cn/changelog/${version}/`) : template;
    fs.writeFileSync(pagePath, original);
    fs.writeFileSync(sourcePath, markdown);
    return { ...entry, page, source, pagePath, sourcePath, original };
  });
  const sitemapFile = path.join(root, 'docs', 'sitemap.xml');
  const sitemapOriginal = `<urlset>${pages.map(({ version }) => `<url><loc>https://clipknife.cn/changelog/${version}/</loc><lastmod>2020-01-01</lastmod></url>`).join('')}</urlset>`;
  fs.writeFileSync(sitemapFile, sitemapOriginal);
  const auditFile = path.join(root, 'audit.json');
  fs.writeFileSync(auditFile, JSON.stringify({
    eligible_pages: pages.map(({ page }) => page),
    rows: pages.map(({ page, source, markdown, auditMarkdown }) => ({
      page, source, status: 200, text_public_local: true, source_dirty: false,
      local_sha256: crypto.createHash('sha256').update(auditMarkdown ?? markdown).digest('hex'),
    })),
  }));
  const writes = [];
  return {
    pages, sitemapFile, writes,
    assertNoOutputWrites() {
      assert.equal(writes.length, 0, 'No page or sitemap may be written on rejection');
      for (const { pagePath, original } of pages) assert.deepEqual(fs.readFileSync(pagePath), Buffer.from(original));
      assert.deepEqual(fs.readFileSync(sitemapFile), Buffer.from(sitemapOriginal));
    },
    run(onRead = () => {}, date = '2020-01-02') {
      const fixtureFs = {
        ...fs,
        readFileSync(file, encoding) {
          const data = fs.readFileSync(file, encoding);
          onRead({ file: path.resolve(file), encoding, data });
          return data;
        },
        writeFileSync(file, ...args) {
          writes.push(path.resolve(file));
          return fs.writeFileSync(file, ...args);
        },
      };
      const context = {
        module: { exports: {} }, __dirname: path.join(root, 'scripts'),
        require: (name) => name === 'node:fs' ? fixtureFs : generatorRequire(name),
        Date: class extends Date {
          constructor(...args) { super(...(args.length ? args : [2026, 9, 10, 12, 0, 0])); }
          static now() { return new Date(2026, 9, 10, 12, 0, 0).getTime(); }
        },
        console: { log() {} },
      };
      vm.runInNewContext(fs.readFileSync(generatorPath, 'utf8'), context, { filename: generatorPath });
      return context.module.exports.run(['--write', '--date', date, '--source-audit', auditFile]);
    },
  };
}

test('generation renders only the same audited source snapshot', (t) => {
  const sourceA = '# v2.2.1\n\n## 更新\n\n来源 A。';
  const sourceB = sourceA.replace('来源 A', '来源 B');
  const fixture = createGeneratorFixture(t, [{ version: 'v2.2.1', markdown: sourceA, auditMarkdown: sourceB }]);
  let sourceReads = 0;
  assert.throws(() => fixture.run(({ file }) => {
    if (file === fixture.pages[0].sourcePath && ++sourceReads === 1) fs.writeFileSync(file, sourceB);
  }), /Unaudited or changed source/);
  fixture.assertNoOutputWrites();
});

test('generation rejects concurrent raw-byte changes in unchanged sources before any output', async (t) => {
  for (const kind of ['body', 'line endings']) {
    await t.test(kind, (t) => {
      const fixture = createGeneratorFixture(t, [
        { version: 'v2.2.0', markdown: '# v2.2.0\n\n## 更新\n\n待生成页面。' },
        { version: 'v2.2.1', markdown: '# v2.2.1\n\n## 更新\n\n已生成页面。', prerendered: true },
      ]);
      let changed = false;
      assert.throws(() => fixture.run(({ file }) => {
        if (file === fixture.sitemapFile && !changed) {
          changed = true;
          const markdown = fixture.pages[1].markdown;
          fs.writeFileSync(fixture.pages[1].sourcePath, kind === 'body' ? markdown.replace('已生成页面', '并发变更来源') : markdown.replace(/\n/g, '\r\n'));
        }
      }), /Source changed during generation: docs\/content\/changelog\/v2\.2\.1\.md/);
      assert.equal(changed, true, 'The change must happen after audit and before the output preflight');
      fixture.assertNoOutputWrites();
    });
  }
});

test('audited raw bytes produce the normalized body and fingerprint without modifying the source', (t) => {
  const markdown = '\uFEFF# v2.2.1\r\n\r\n## 更新\r\n\r\n保留原始字节。';
  const fixture = createGeneratorFixture(t, [{ version: 'v2.2.1', markdown }]);
  const reads = [];
  fixture.run(({ file, encoding, data }) => {
    if (file === fixture.pages[0].sourcePath) reads.push({ encoding, data });
    if (file === fixture.sitemapFile && reads.length === 1) assert.equal(Buffer.isBuffer(reads[0].data), true);
  });
  assert.equal(reads.length, 2, 'Read once for audit/render, then once for the final byte preflight');
  assert.ok(reads.every(({ encoding, data }) => encoding === undefined && Buffer.isBuffer(data)));
  const html = fs.readFileSync(fixture.pages[0].pagePath, 'utf8');
  assert.equal(html, require(generatorPath).renderPage(fixtureTemplate('v2.2.1'), markdown, 'https://clipknife.cn/changelog/v2.2.1/'));
  const expectedHash = crypto.createHash('sha256').update(markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')).digest('hex');
  assert.ok(html.includes(`data-doc-source-sha256="${expectedHash}"`));
  assert.deepEqual(fs.readFileSync(fixture.pages[0].sourcePath), Buffer.from(markdown));
  assert.deepEqual(fixture.writes, [fixture.pages[0].pagePath, fixture.sitemapFile]);
});

test('generation refuses invalid and future dates using a fixed local clock', (t) => {
  const fixture = createGeneratorFixture(t);
  for (const date of ['2026-02-30', '2026-10-11', '9999-01-01']) {
    assert.throws(() => fixture.run(undefined, date), /Date must be valid and not in the future/);
  }
  fixture.assertNoOutputWrites();
});

function assertCanonicalOutsideText(nonElement, realLink = '') {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('</head>', `${nonElement}${realLink}</head>`);
  const result = renderPage(template, source, url);
  assert.ok(result.includes(nonElement), 'Non-element text must remain verbatim');
  // Remove only the known fixture text, not tags discovered by the generator.
  const head = result.match(/<head>([\s\S]*?)<\/head>/)[1].replace(nonElement, '');
  const links = [...head.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/g)];
  assert.equal(links.length, 1, 'The real head must contain exactly one canonical element');
  assert.equal(links[0][1], url);
  assert.equal(renderPage(result, source, url), result, 'Repeated generation must preserve one canonical');
}

test('canonical insertion refuses templates without a real head closing tag', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('</head>', '<!-- missing real head close -->');
  assert.throws(() => renderPage(template, source, url), /Missing real head closing tag/);
});

test('canonical rejects a matching URL link in body', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('</body>', `<link rel="canonical" href="${url}" /></body>`);
  assert.throws(() => renderPage(template, source, url), /Canonical outside valid head/);
});

test('canonical rejects a matching URL link in template content', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('</head>', `<template><link rel="canonical" href="${url}" /></template></head>`);
  assert.throws(() => renderPage(template, source, url), /Canonical outside valid head/);
});

test('canonical rejects a matching URL link in SVG content', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('</head>', `<svg><link rel="canonical" href="${url}" /></svg></head>`);
  assert.throws(() => renderPage(template, source, url), /Canonical outside valid head/);
});

test('canonical rejects a matching URL link in MathML content', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('</head>', `<math><link rel="canonical" href="${url}" /></math></head>`);
  assert.throws(() => renderPage(template, source, url), /Canonical outside valid head/);
});

test('canonical validation rejects a matching URL when real head close is missing', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('</head>', `<link rel="canonical" href="${url}" />`);
  assert.throws(() => renderPage(template, source, url), /Missing real head closing tag/);
});

test('canonical validation rejects a matching URL when two real head closes exist', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('</head>', `<link rel="canonical" href="${url}" /></head></head>`);
  assert.throws(() => renderPage(template, source, url), /Missing real head closing tag/);
});

test('canonical validation rejects a matching URL when real head opening is missing', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('<head>', '').replace('</head>', `<link rel="canonical" href="${url}" /></head>`);
  assert.throws(() => renderPage(template, source, url), /Missing real head closing tag/);
});

test('canonical validation rejects a matching URL when two real head openings exist', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('<head>', '<head><head>').replace('</head>', `<link rel="canonical" href="${url}" /></head>`);
  assert.throws(() => renderPage(template, source, url), /Missing real head closing tag/);
});

test('canonical validation rejects reversed real head boundaries', () => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const template = fixtureTemplate('v2.2.1').replace('<head></head>', `</head><link rel="canonical" href="${url}" /><head>`);
  assert.throws(() => renderPage(template, source, url), /Missing real head closing tag/);
});

test('canonical insertion skips non-element head-close text', async (t) => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const cases = [
    ['comment', '<!-- Example: </head> -->'],
    ['JSON script', '<script type="application/json">{"sample":"</head>"}</script>'],
    ['quoted attribute', '<meta name="sample" content="</head>" />'],
  ];
  for (const [name, nonElement] of cases) {
    await t.test(name, () => {
      const template = fixtureTemplate('v2.2.1').replace('</head>', `${nonElement}</head>`);
      const result = renderPage(template, source, url);
      assert.ok(result.includes(nonElement), 'Non-element head-close text must remain verbatim');
      const withoutFixture = result.replace(nonElement, '');
      const head = withoutFixture.match(/<head>([\s\S]*?)<\/head>/)[1];
      const links = [...head.matchAll(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/g)];
      assert.equal(links.length, 1, 'The real head must contain exactly one canonical element');
      assert.equal(links[0][1], url);
      assert.equal(renderPage(result, source, url), result, 'Repeated generation must be idempotent');
    });
  }
});

test('canonical ignores a same-URL link in an HTML comment', () => {
  assertCanonicalOutsideText("<!-- <link rel='canonical' href='https://clipknife.cn/changelog/v2.2.1/' /> -->");
});

test('canonical ignores links in raw-text elements including JSON script', async (t) => {
  for (const name of ['script', 'style', 'title', 'textarea', 'xmp', 'iframe', 'noembed', 'noframes']) {
    await t.test(name, () => {
      const attributes = name === 'script' ? ' type="application/json"' : '';
      assertCanonicalOutsideText(`<${name}${attributes}>{"sample":"<link rel='canonical' href='https://clipknife.cn/changelog/v2.2.1/' />"}</${name.toUpperCase()} >`);
    });
  }
});

test('canonical ignores a link inside quoted meta content', () => {
  assertCanonicalOutsideText(`<meta name="sample" content="<link rel='canonical' href='https://clipknife.cn/changelog/v2.2.1/' />" />`);
});

test('canonical preserves the correct real link beside an old-URL comment', () => {
  assertCanonicalOutsideText(
    "<!-- <link rel='canonical' href='https://clipknife.cn/changelog/v2.2.0/' /> -->",
    '<link rel="canonical" href="https://clipknife.cn/changelog/v2.2.1/" />',
  );
});

test('canonical validation uses independent HTML attributes with safe quote boundaries', async (t) => {
  const { renderPage } = require(generatorPath);
  const url = 'https://clipknife.cn/changelog/v2.2.1/';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const cases = [
    { name: 'single-quoted canonical remains the only link', link: `<link rel='canonical' href='${url}' />`, links: 1 },
    { name: 'data-href cannot hide a conflicting real href', link: `<link rel="canonical" data-href="${url}" href="https://example.test/wrong/" />`, error: /Conflicting canonical/ },
    { name: 'data-rel is not a canonical relation', link: `<link data-rel="canonical" href="${url}" />`, links: 2 },
    { name: 'case-insensitive attributes allow whitespace around equals', link: `<LINK HREF = '${url}' REL = 'CANONICAL' />`, links: 1 },
    { name: 'quoted greater-than and apparent attributes are not boundaries', link: `<link data-note='> rel="canonical" href="${url}"' rel="stylesheet" href="site.css" />`, links: 2 },
    { name: 'mixed quote styles still expose duplicate canonicals', link: `<link rel="canonical" href="${url}" /><link rel='canonical' href='${url}' />`, error: /Conflicting canonical/ },
    { name: 'an unterminated quoted link fails closed', link: `<link rel='canonical href='${url}' />`, error: /Malformed link attributes/ },
    { name: 'encoded canonical relations fail closed instead of being duplicated', link: `<link rel="c&#97;nonical" href="${url}" />`, error: /Malformed link attributes/ },
    { name: 'unquoted values and canonical relation tokens remain idempotent', link: `<link href=${url} rel='alternate canonical' />`, links: 1 },
    { name: 'data-href alone does not supply the required href', link: `<link rel="canonical" data-href="${url}" />`, error: /Conflicting canonical/ },
    { name: 'duplicate real attributes fail closed', link: `<link rel="canonical" href="${url}" HREF="https://example.test/wrong/" />`, error: /Malformed link attributes/ },
  ];
  for (const scenario of cases) {
    await t.test(scenario.name, () => {
      const template = fixtureTemplate('v2.2.1').replace('</head>', `${scenario.link}</head>`);
      if (scenario.error) {
        assert.throws(() => renderPage(template, source, url), scenario.error);
        return;
      }
      const result = renderPage(template, source, url);
      assert.equal([...result.matchAll(/<link(?=\s)/gi)].length, scenario.links);
      assert.ok(result.includes(scenario.link), 'Existing valid links must be preserved verbatim');
      assert.equal(renderPage(result, source, url), result, 'Repeated generation cannot add another canonical');
    });
  }
});

const scriptPath = path.join(__dirname, '..', 'docs', 'assets', 'docs.js');
const docsRoot = path.join(__dirname, '..', 'docs');
test('document text has a local dark background even when JavaScript and Tailwind are disabled', () => {
  const css = fs.readFileSync(path.join(docsRoot, 'assets', 'styles.css'), 'utf8');
  assert.match(css, /body\s*\{[^}]*background-color:\s*var\(--color-bg\)/);
  assert.match(css, /body\s*\{[^}]*color:\s*#fff/);
});
const versions = fs.readdirSync(path.join(docsRoot, 'changelog')).filter((name) => /^v\d+\.\d+\.\d+$/.test(name)).sort();
test('long component hashes wrap within the document instead of overflowing a narrow viewport', () => {
  const css = fs.readFileSync(path.join(docsRoot, 'assets', 'styles.css'), 'utf8');
  const rule = css.match(/\.doc-content \{([^}]*)\}/)[1];
  assert.equal(rule.includes('overflow-wrap: anywhere;'), true);
});

for (const version of versions) {
  test(`${version} has a complete static body, directory, one canonical and current source fingerprint`, () => {
    const { renderPage } = require('../scripts/prerender-docs.cjs');
    const html = fs.readFileSync(path.join(docsRoot, 'changelog', version, 'index.html'), 'utf8');
    const markdown = fs.readFileSync(path.join(docsRoot, 'content', 'changelog', `${version}.md`), 'utf8');
    assert.match(html, /data-doc-prerendered="true"/);
    assert.equal(html.replace(/\r\n/g, '\n'), renderPage(html, markdown, `https://clipknife.cn/changelog/${version}/`));
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
  });
}

test('the document renderer can run in Node without a window or DOM', () => {
  const context = { module: { exports: {} } };
  assert.doesNotThrow(() => vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), context));
  assert.equal(typeof context.module.exports.renderMarkdown, 'function');
  const rendered = context.module.exports.renderMarkdown('# v2.2.1\n\n## 更新\n\n- 保留本地素材');
  assert.match(rendered.html, /<h1 id="v2\.2\.1">v2\.2\.1<\/h1>/);
  assert.match(rendered.html, /<li>保留本地素材<\/li>/);
  assert.equal(rendered.toc[1].id, '更新');
});

test('rendered heading IDs cannot break out of the id attribute', () => {
  const { renderMarkdown } = require(scriptPath);
  const rendered = renderMarkdown('## x"><img/src=x/onerror=throw\'XSS\'>');
  assert.equal(rendered.toc[0].id, 'x"><img/src=x/onerror=throw\'xss\'>');
  assert.equal(rendered.html, '<h2 id="x&quot;&gt;&lt;img/src=x/onerror=throw\'xss\'&gt;">x&quot;&gt;&lt;img/src=x/onerror=throw\'XSS\'&gt;</h2>');
  assert.doesNotMatch(rendered.html, /<img\b/i);
});

test('rendered document URLs reject executable schemes while preserving ordinary links', () => {
  const { renderMarkdown } = require(scriptPath);
  const html = renderMarkdown('[危险](javascript:alert)\n\n![图片](data:image/svg+xml;base64,PHN2Zz4=)\n\n[手册](../../manual/#搜索)\n\n[官网](https://clipknife.cn/)').html;
  assert.doesNotMatch(html, /(?:href|src)="(?:javascript|data):/i);
  assert.match(html, /href="\.\.\/\.\.\/manual\/#搜索"/);
  assert.match(html, /href="https:\/\/clipknife\.cn\/"/);
});

test('a prerendered article is enhanced without fetching or replacing its static body', async () => {
  let fetches = 0;
  const heading = { tagName: 'H1', textContent: 'v2.2.1', id: 'v2.2.1' };
  const subheading = { tagName: 'H2', textContent: '更新', id: '更新' };
  const mount = {
    innerHTML: '<h1 id="v2.2.1">v2.2.1</h1>',
    getAttribute: (name) => name === 'data-doc-prerendered' ? 'true' : '../../content/changelog/v2.2.1.md',
    querySelector: () => heading,
    querySelectorAll: (selector) => selector === 'h1, h2, h3' ? [heading, subheading] : [],
  };
  const status = { hidden: true };
  const toc = { innerHTML: '' };
  const document = {
    querySelector: () => mount,
    getElementById: (id) => id === 'docStatus' ? status : id === 'docToc' ? toc : null,
  };
  vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), {
    document, window: { location: { hash: '' } },
    fetch: async () => { fetches++; return { ok: true, text: async () => '# 替换内容' }; },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fetches, 0);
  assert.equal(mount.innerHTML, '<h1 id="v2.2.1">v2.2.1</h1>');
  assert.match(toc.innerHTML, /更新/);
  assert.equal(status.hidden, true);
});

test('a prerendered article encodes heading IDs before writing TOC links', async () => {
  const unsafeId = 'x"><img/src=x/onerror=throw\'XSS\'>';
  const heading = { tagName: 'H1', textContent: 'v2.2.1', id: 'v2.2.1' };
  const subheading = { tagName: 'H2', textContent: unsafeId, id: unsafeId };
  const mount = {
    getAttribute: (name) => name === 'data-doc-prerendered' ? 'true' : '../../content/changelog/v2.2.1.md',
    querySelector: () => heading,
    querySelectorAll: (selector) => selector === 'h1, h2, h3' ? [heading, subheading] : [],
  };
  const toc = { innerHTML: '' };
  const document = {
    title: '',
    querySelector: () => mount,
    getElementById: (id) => id === 'docToc' ? toc : id === 'docStatus' ? { hidden: true } : null,
  };
  vm.runInNewContext(fs.readFileSync(scriptPath, 'utf8'), {
    document,
    window: { location: { hash: '' } },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(toc.innerHTML, `<a class="toc-link toc-level-2" href="#${encodeURIComponent(unsafeId)}">x&quot;&gt;&lt;img/src=x/onerror=throw'XSS'&gt;</a>`);
  assert.doesNotMatch(toc.innerHTML, /<img\b/i);
});

test('the page generator places the real Markdown body and directory in static HTML', () => {
  const generatorPath = path.join(__dirname, '..', 'scripts', 'prerender-docs.cjs');
  assert.ok(fs.existsSync(generatorPath), 'A reusable prerender generator must exist');
  const { renderPage } = require(generatorPath);
  const template = '<html><head></head><body><nav id="docToc"></nav><div id="docStatus" class="doc-status">加载中</div><div class="doc-content" data-doc-src="../../content/changelog/v2.2.1.md"></div></body></html>';
  const result = renderPage(template, '# v2.2.1\n\n## 应用数据迁移\n\n原始素材留在素材源。', 'https://clipknife.cn/changelog/v2.2.1/');
  assert.match(result, /data-doc-prerendered="true"/);
  assert.match(result, /<h1 id="v2\.2\.1">v2\.2\.1<\/h1>/);
  assert.match(result, /<p>原始素材留在素材源。<\/p>/);
  assert.match(result, /<nav id="docToc">[\s\S]*应用数据迁移[\s\S]*<\/nav>/);
  assert.match(result, /rel="canonical" href="https:\/\/clipknife\.cn\/changelog\/v2\.2\.1\/"/);
  assert.match(result, /id="docStatus"[^>]*hidden/);
});

test('regeneration is idempotent and refuses a conflicting canonical or non-log URL', () => {
  const { renderPage } = require('../scripts/prerender-docs.cjs');
  const template = '<html><head></head><body><nav id="docToc"></nav><div class="doc-content" data-doc-src="../../content/changelog/v2.2.1.md"></div></body></html>';
  const source = '# v2.2.1\n\n## 更新\n\n已有内容。';
  const result = renderPage(template, source, 'https://clipknife.cn/changelog/v2.2.1/');
  assert.equal(renderPage(result, source, 'https://clipknife.cn/changelog/v2.2.1/'), result);
  assert.throws(() => renderPage(result, source, 'https://clipknife.cn/changelog/v2.2.0/'), /Conflicting canonical/);
  assert.throws(() => renderPage(template, source, 'https://clipknife.cn/manual/'), /Only version-log/);
});

test('changed log pages have valid sitemap dates while all other page dates remain untouched', () => {
  const xml = fs.readFileSync(path.join(docsRoot, 'sitemap.xml'), 'utf8');
  const entries = new Map([...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((match) => [match[1].match(/<loc>([^<]+)<\/loc>/)[1], match[1].match(/<lastmod>([^<]+)<\/lastmod>/)[1]]));
  for (const version of versions) {
    const date = entries.get(`https://clipknife.cn/changelog/${version}/`);
    assert.match(date, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(date).toISOString().slice(0, 10), date);
    assert.equal(date, '2026-10-10', 'Version logs retain the audited generation batch date');
  }
  assert.equal(entries.get('https://clipknife.cn/manual/'), '2026-10-09');
  assert.equal(entries.get('https://clipknife.cn/faq/'), '2026-10-09');
});
