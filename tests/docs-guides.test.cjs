'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const crypto = require('node:crypto');
const os = require('node:os');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const generatorPath = path.join(__dirname, '..', 'scripts', 'prerender-guides.cjs');
function generator() {
  assert.ok(fs.existsSync(generatorPath), 'A separate guide CLI must exist');
  return require(generatorPath);
}
function createFixture(t, prerendered = false) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-guides-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const pages = guides.map((guide) => {
    const page = `docs/${guide.name}/index.html`;
    const source = `docs/content/${guide.name}.md`;
    const template = templateFor(guide);
    const markdown = markdownFor(guide);
    const original = prerendered ? renderer.renderGuidePage(template, markdown, urlFor(guide.name)) : template;
    for (const [relative, data] of [[page, original], [source, markdown]]) {
      fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      fs.writeFileSync(path.join(root, relative), data);
    }
    return { ...guide, page, source, original, markdown };
  });
  const sitemapFile = path.join(root, 'docs/sitemap.xml');
  const sitemap = `<urlset>${guides.map(({ name }) => `<url><loc>${urlFor(name)}</loc><lastmod>2020-01-01</lastmod></url>`).join('')}<url><loc>https://clipknife.cn/</loc><lastmod>2019-01-01</lastmod></url></urlset>`;
  fs.writeFileSync(sitemapFile, sitemap);
  const snapshot = () => Object.fromEntries([...pages.flatMap(({ page, source }) => [page, source]), 'docs/sitemap.xml'].map((file) => [file, fs.readFileSync(path.join(root, file))]));
  const original = snapshot();
  return { root, pages, sitemapFile, snapshot, assertUnchanged: () => assert.deepEqual(snapshot(), original) };
}
const { renderMarkdown } = require('../docs/assets/docs.js');
const renderer = require('../scripts/prerender-docs.cjs');
const normalize = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const hash = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const guides = [
  { name: 'faq', title: '常见问题' },
  { name: 'manual', title: '使用手册' },
];
const urlFor = (name) => `https://clipknife.cn/${name}/`;
const shellHeading = (title) => `<h1 style="display:none;">素刀 ClipKnife ${title}</h1>`;
function templateFor({ name, title }) {
  return `<html>\r\n<head>\r\n<title>原有标题</title>\r\n<link rel="canonical" href="${urlFor(name)}" />\r\n<script type="application/ld+json">\r\n{"@type":"FAQPage","mainEntity":[{"name":"保留既有问答","acceptedAnswer":{"text":"不由生成器同步"}}]}\r\n</script>\r\n</head>\r\n<body>\r\n  ${shellHeading(title)}\r\n<header>导航</header>\r\n<nav id="docToc"></nav>\r\n<div id="docStatus" class="doc-status">加载中</div>\r\n<div class="doc-content" data-doc-src="../content/${name}.md"></div>\r\n</body></html>`;
}
const markdownFor = ({ title }) => `\uFEFF# ${title}\r\n\r\n## 搜索 & 定位\r\n\r\n已有说明。\r\n\r\n### 子步骤\r\n\r\n- 保留列表\r\n\r\n![示例](../assets/example.png)\r\n`;

test('guide renderer restricts eligibility without broadening the legacy renderer', () => {
  assert.equal(typeof renderer.renderGuidePage, 'function');
  const template = templateFor(guides[0]);
  const markdown = markdownFor(guides[0]);
  for (const url of ['https://clipknife.cn/', 'https://clipknife.cn/changelog/v2.3.0/', 'http://clipknife.cn/faq/', 'https://clipknife.cn/faq', 'https://clipknife.cn/faq/?q=x', 'https://clipknife.cn/faq/#x', 'https://example.test/manual/', 'https://clipknife.cn/%66aq/']) {
    assert.throws(() => renderer.renderGuidePage(template, markdown, url), /Only FAQ and manual/);
  }
  for (const guide of guides) assert.throws(() => renderer.renderPage(template, markdown, urlFor(guide.name)), /Only version-log/);
});

test('guide renderer preserves head/schema and renders both bodies, TOCs and one visible H1 idempotently', () => {
  assert.equal(typeof renderer.renderGuidePage, 'function', 'A separate guide renderer must be exported');
  for (const guide of guides) {
    const template = templateFor(guide);
    const markdown = markdownFor(guide);
    const html = renderer.renderGuidePage(template, markdown, urlFor(guide.name));
    assert.equal(html.match(/<head>[\s\S]*?<\/head>/)[0], template.match(/<head>[\s\S]*?<\/head>/)[0], 'The entire head, including schema and line endings, stays verbatim');
    assert.ok(html.includes(renderMarkdown(normalize(markdown)).html));
    assert.match(html, /<nav id="docToc"><a class="toc-link toc-level-2"[^>]*>搜索 &amp; 定位<\/a>\n<a class="toc-link toc-level-3"[^>]*>子步骤<\/a><\/nav>/);
    assert.ok(html.includes(`href="#${encodeURIComponent('搜索-&-定位')}"`));
    assert.match(html, /id="docStatus"[^>]* hidden>/);
    assert.ok(html.includes(`data-doc-src="../content/${guide.name}.md"`));
    assert.ok(html.includes(`data-doc-prerendered="true" data-doc-source-sha256="${hash(normalize(markdown))}"`));
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    assert.doesNotMatch(html, /^[ \t]+\r?$/m, 'Removing an indented shell H1 must not create trailing whitespace');
    assert.match(html, new RegExp(`<h1 id="[^"]+">${guide.title}</h1>`));
    assert.equal(renderer.renderGuidePage(html, markdown, urlFor(guide.name)), html);
  }
});

test('guide rendering retains non-shell H1s and existing canonical safety checks', () => {
  const template = templateFor(guides[0]);
  const markdown = markdownFor(guides[0]);
  for (const heading of ['<h1 hidden>另一标题</h1>', '<h1>素刀 ClipKnife 常见问题</h1>', shellHeading('使用手册')]) {
    assert.ok(renderer.renderGuidePage(template.replace(shellHeading('常见问题'), heading), markdown, urlFor('faq')).includes(heading));
  }
  const sample = `<script type="application/json">${JSON.stringify({ sample: `<body>${shellHeading('常见问题')}` })}</script>`;
  assert.ok(renderer.renderGuidePage(template.replace('</head>', `${sample}</head>`), markdown, urlFor('faq')).includes(sample));
  const link = `<link rel="canonical" href="${urlFor('faq')}" />`;
  const cases = [
    [template.replace(link, link.replace(urlFor('faq'), urlFor('manual'))), /Conflicting canonical/],
    [template.replace(link, link + link), /Conflicting canonical/],
    [template.replace(link, '').replace('</body>', `${link}</body>`), /Canonical outside valid head/],
    [template.replace(link, `<template>${link}</template>`), /Canonical outside valid head/],
    [template.replace(link, `<svg>${link}</svg>`), /Canonical outside valid head/],
    [template.replace(link, `<link rel="c&#97;nonical" href="${urlFor('faq')}" />`), /Malformed link attributes/],
    [template.replace('</head>', ''), /Missing real head closing tag/],
  ];
  for (const [input, error] of cases) assert.throws(() => renderer.renderGuidePage(input, markdown, urlFor('faq')), error);
  for (const source of ['## 没有主标题', '# 第一\n\n# 第二']) assert.throws(() => renderer.renderGuidePage(template, source, urlFor('faq')), /exactly one source H1/);
  const inserted = renderer.renderGuidePage(template.replace(link, ''), markdown, urlFor('faq'));
  assert.equal((inserted.match(/rel="canonical"/g) || []).length, 1);
  assert.equal(renderer.renderGuidePage(inserted, markdown, urlFor('faq')), inserted);
});

test('CRLF-only checkout differences are not stale and never trigger rewriting', (t) => {
  const fixture = createFixture(t, true);
  for (const { page } of fixture.pages) {
    const file = path.join(fixture.root, page);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/\r?\n/g, '\r\n'));
  }
  const before = fixture.snapshot();
  assert.deepEqual(generator().run(['--check'], { root: fixture.root }), { checked_pages: 2, stale_pages: 0 });
  const auditFile = writeAudit(fixture);
  assert.deepEqual(generator().run(writeArgs(auditFile), { root: fixture.root }).updated_pages, []);
  assert.deepEqual(fixture.snapshot(), before);
});

const writeArgs = (auditFile, date = '2020-01-02') => ['--write', '--date', date, '--source-audit', auditFile];
function writeAudit(fixture, transform = (audit) => audit) {
  const audit = {
    approved_version: '2.3.0',
    rows: fixture.pages.map(({ page, source }) => ({ page, source, local_sha256: hash(fs.readFileSync(path.join(fixture.root, source))) })),
  };
  const file = path.join(fixture.root, 'audit.json');
  fs.writeFileSync(file, JSON.stringify(transform(audit)));
  return file;
}

test('audited write updates only changed guides and sitemap dates, preserving raw source bytes', (t) => {
  const fixture = createFixture(t);
  const auditFile = writeAudit(fixture);
  const { run } = generator();
  const result = run(writeArgs(auditFile), { root: fixture.root });
  assert.deepEqual(result, { checked_pages: 2, updated_pages: fixture.pages.map(({ page }) => page), source_markdown_modified: false });
  for (const page of fixture.pages) {
    assert.equal(fs.readFileSync(path.join(fixture.root, page.page), 'utf8'), renderer.renderGuidePage(page.original, page.markdown, urlFor(page.name)));
    assert.deepEqual(fs.readFileSync(path.join(fixture.root, page.source)), Buffer.from(page.markdown));
  }
  const sitemap = fs.readFileSync(fixture.sitemapFile, 'utf8');
  for (const { name } of guides) assert.ok(sitemap.includes(`<loc>${urlFor(name)}</loc><lastmod>2020-01-02</lastmod>`));
  assert.ok(sitemap.includes('<loc>https://clipknife.cn/</loc><lastmod>2019-01-01</lastmod>'));
  assert.deepEqual(run(['--check'], { root: fixture.root }), { checked_pages: 2, stale_pages: 0 });
  const before = fixture.snapshot();
  assert.deepEqual(run(writeArgs(auditFile, '2020-01-03'), { root: fixture.root }).updated_pages, []);
  assert.deepEqual(fixture.snapshot(), before, 'Idempotent generation must not advance sitemap dates');
});

test('write rejects unaudited bytes and malformed or non-exact two-page audits before any output', async (t) => {
  const changes = [
    ['wrong version', (a) => ({ ...a, approved_version: '2.2.1' })],
    ['missing version', (a) => ({ rows: a.rows })],
    ['null audit', () => null],
    ['missing rows', () => ({ approved_version: '2.3.0' })],
    ['missing row', (a) => ({ ...a, rows: a.rows.slice(0, 1) })],
    ['duplicate row', (a) => ({ ...a, rows: [a.rows[0], a.rows[0]] })],
    ['extra row', (a) => ({ ...a, rows: [...a.rows, a.rows[0]] })],
    ['null row', (a) => ({ ...a, rows: [a.rows[0], null] })],
    ['outside page', (a) => { a.rows[1].page = 'docs/changelog/v2.3.0/index.html'; return a; }],
    ['traversal page', (a) => { a.rows[1].page = 'docs/manual/../manual/index.html'; return a; }],
    ['swapped source', (a) => { a.rows[1].source = a.rows[0].source; return a; }],
    ['invalid hash', (a) => { a.rows[1].local_sha256 = 'not-a-sha256'; return a; }],
    ['wrong hash', (a) => { a.rows[1].local_sha256 = '0'.repeat(64); return a; }],
    ['normalized instead of raw hash', (a, f) => { a.rows[1].local_sha256 = hash(normalize(f.pages[1].markdown)); return a; }],
  ];
  for (const [name, change] of changes) {
    await t.test(name, (t) => {
      const fixture = createFixture(t);
      const auditFile = writeAudit(fixture, (audit) => change(audit, fixture));
      const observed = observedGenerator();
      assert.throws(() => observed.run(writeArgs(auditFile), { root: fixture.root }), /Invalid source audit|Unaudited or changed source/);
      assert.deepEqual(observed.writes, []);
      fixture.assertUnchanged();
    });
  }
});

test('write rejects invalid/future dates and ambiguous arguments without output', (t) => {
  const fixture = createFixture(t);
  const auditFile = writeAudit(fixture);
  const options = { root: fixture.root, now: () => new Date(2026, 9, 14, 12) };
  for (const date of ['2026-02-30', '2026-13-01', '2026-1-01', '2026-10-15', '9999-01-01', 'invalid', '2020-01-02T00:00:00Z']) {
    const observed = observedGenerator();
    assert.throws(() => observed.run(writeArgs(auditFile, date), options), /Date must be valid and not in the future/);
    assert.deepEqual(observed.writes, []);
    fixture.assertUnchanged();
  }
  for (const args of [[], ['--write'], ['--check', '--write'], ['--check', '--date', '2020-01-02'], ['--write', '--date', '2020-01-02'], ['--write', '--date', '--source-audit', auditFile], [...writeArgs(auditFile), '--unknown'], [...writeArgs(auditFile), '--date', '2020-01-03'], ['--write', '--write', '--source-audit', auditFile, '--date']]) {
    assert.throws(() => generator().run(args, options), /Use --check or --write/);
    fixture.assertUnchanged();
  }
  fs.writeFileSync(auditFile, '{invalid JSON');
  assert.throws(() => generator().run(writeArgs(auditFile), options), SyntaxError);
  fixture.assertUnchanged();
  assert.throws(() => generator().run(writeArgs(`${auditFile}.missing`), options), /ENOENT/);
  fixture.assertUnchanged();
  writeAudit(fixture);
  assert.equal(generator().run(writeArgs(auditFile, '2026-10-14'), options).updated_pages.length, 2, 'The local current date is allowed');
});

function observedGenerator(onRead = () => {}) {
  const writes = [];
  const nativeRequire = createRequire(generatorPath);
  const observedFs = {
    ...fs,
    readFileSync(file, ...args) {
      const data = fs.readFileSync(file, ...args);
      onRead(path.resolve(file), data);
      return data;
    },
    writeFileSync(file, ...args) {
      writes.push(path.resolve(file));
      return fs.writeFileSync(file, ...args);
    },
  };
  const context = { module: { exports: {} }, __dirname: path.dirname(generatorPath), require: (name) => name === 'node:fs' ? observedFs : nativeRequire(name) };
  vm.runInNewContext(fs.readFileSync(generatorPath, 'utf8'), context, { filename: generatorPath });
  return { run: context.module.exports.run, writes };
}

test('both guides must already have unique sitemap entries and lastmod, even when unchanged', async (t) => {
  const entry = `<url><loc>${urlFor('manual')}</loc><lastmod>2020-01-01</lastmod></url>`;
  const cases = [
    ['missing entry', (xml) => xml.replace(entry, '')],
    ['duplicate entry', (xml) => xml.replace(entry, entry + entry)],
    ['missing lastmod', (xml) => xml.replace(entry, entry.replace('<lastmod>2020-01-01</lastmod>', ''))],
    ['duplicate lastmod', (xml) => xml.replace(entry, entry.replace('</lastmod>', '</lastmod><lastmod>2020-01-01</lastmod>'))],
  ];
  for (const [name, change] of cases) {
    for (const prerendered of [false, true]) {
      await t.test(`${name}; prerendered=${prerendered}`, (t) => {
        const fixture = createFixture(t, prerendered);
        fs.writeFileSync(fixture.sitemapFile, change(fs.readFileSync(fixture.sitemapFile, 'utf8')));
        const before = fixture.snapshot();
        const auditFile = writeAudit(fixture);
        const observed = observedGenerator();
        assert.throws(() => observed.run(writeArgs(auditFile), { root: fixture.root }), /sitemap|Sitemap|lastmod/);
        assert.throws(() => observed.run(['--check'], { root: fixture.root }), /sitemap|Sitemap|lastmod/);
        assert.deepEqual(observed.writes, []);
        assert.deepEqual(fixture.snapshot(), before);
      });
    }
  }
});

test('write rechecks every template, source and sitemap byte snapshot before the first output', async (t) => {
  for (const target of ['docs/faq/index.html', 'docs/manual/index.html', 'docs/content/faq.md', 'docs/content/manual.md', 'docs/sitemap.xml']) {
    for (const kind of ['body', 'line endings']) {
      await t.test(`${target}: ${kind}`, (t) => {
        const fixture = createFixture(t, true);
        // Only FAQ needs generation; unchanged manual must still be rechecked.
        const faq = fixture.pages[0];
        fs.writeFileSync(path.join(fixture.root, faq.page), templateFor(faq));
        const auditFile = writeAudit(fixture);
        let before;
        let mutated = false;
        const observed = observedGenerator((file) => {
          if (file !== fixture.sitemapFile || mutated) return;
          mutated = true;
          const fullPath = path.join(fixture.root, target);
          const data = fs.readFileSync(fullPath, 'utf8');
          fs.writeFileSync(fullPath, kind === 'body' ? `${data}\n并发修改` : `\uFEFF${data.replace(/\r?\n/g, '\r\n')}`);
          before = fixture.snapshot();
        });
        assert.throws(() => observed.run(writeArgs(auditFile), { root: fixture.root }), /(?:Page|Source|Sitemap) changed during generation/);
        assert.equal(mutated, true);
        assert.deepEqual(observed.writes, [], 'Preflight failures must not write any output');
        assert.deepEqual(fixture.snapshot(), before, 'Keep the external change; do not overwrite or roll it back');
      });
    }
  }
});

test('write validates the entire plan before writing the first guide', async (t) => {
  for (const mutation of ['source after audit', 'bad canonical', 'wrong mount source']) {
    await t.test(mutation, (t) => {
      const fixture = createFixture(t);
      const auditFile = writeAudit(fixture);
      const manual = fixture.pages[1];
      if (mutation === 'source after audit') fs.appendFileSync(path.join(fixture.root, manual.source), '\n修改来源');
      else fs.writeFileSync(path.join(fixture.root, manual.page), manual.original.replace(mutation === 'bad canonical' ? urlFor('manual') : '../content/manual.md', mutation === 'bad canonical' ? urlFor('faq') : '../content/faq.md'));
      const before = fixture.snapshot();
      const observed = observedGenerator();
      assert.throws(() => observed.run(writeArgs(auditFile), { root: fixture.root }), /Unaudited or changed source|Conflicting canonical|Unexpected document source/);
      assert.deepEqual(observed.writes, []);
      assert.deepEqual(fixture.snapshot(), before);
    });
  }
});

test('real FAQ and manual templates render in memory with their complete head and source preserved', () => {
  const root = path.join(__dirname, '..');
  for (const { name } of guides) {
    const template = fs.readFileSync(path.join(root, `docs/${name}/index.html`), 'utf8');
    const markdown = fs.readFileSync(path.join(root, `docs/content/${name}.md`), 'utf8');
    const rendered = renderer.renderGuidePage(template, markdown, urlFor(name));
    assert.ok(rendered.includes(renderMarkdown(normalize(markdown)).html));
    assert.equal(rendered.match(/<head>[\s\S]*?<\/head>/)[0], template.match(/<head>[\s\S]*?<\/head>/)[0]);
    assert.equal([...rendered.matchAll(/<h1\b/g)].length, 1);
    assert.equal(renderer.renderGuidePage(rendered, markdown, urlFor(name)), rendered);
  }
});

test('CLI executes check/write/check and rejects bad arguments in an isolated repository', (t) => {
  const fixture = createFixture(t);
  const root = path.join(__dirname, '..');
  for (const file of ['scripts/prerender-guides.cjs', 'scripts/prerender-docs.cjs', 'docs/assets/docs.js']) {
    const target = path.join(fixture.root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(root, file), target);
  }
  const cli = (...args) => {
    const result = spawnSync(process.execPath, [path.join(fixture.root, 'scripts/prerender-guides.cjs'), ...args], { cwd: fixture.root, encoding: 'utf8' });
    assert.ifError(result.error);
    return result;
  };
  const stale = cli('--check');
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /Stale or missing prerenders: docs\/faq\/index.html, docs\/manual\/index.html/);
  fixture.assertUnchanged();
  const invalid = cli('--write');
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Use --check or --write/);
  fixture.assertUnchanged();
  const written = cli(...writeArgs(writeAudit(fixture)));
  assert.equal(written.status, 0, written.stderr);
  assert.deepEqual(JSON.parse(written.stdout).updated_pages, fixture.pages.map(({ page }) => page));
  const checked = cli('--check');
  assert.equal(checked.status, 0, checked.stderr);
  assert.deepEqual(JSON.parse(checked.stdout), { checked_pages: 2, stale_pages: 0 });
  const observed = observedGenerator();
  observed.run(writeArgs(path.join(fixture.root, 'audit.json')), { root: fixture.root });
  assert.deepEqual(observed.writes, [], 'An idempotent write must perform zero file writes');
  observed.run(['--check'], { root: fixture.root });
  assert.deepEqual(observed.writes, [], 'A check must perform zero file writes');
});

test('check reports stale pages, detects source changes, and never writes', (t) => {
  const { run } = generator();
  const stale = createFixture(t);
  assert.throws(() => run(['--check'], { root: stale.root }), /Stale or missing prerenders: docs\/faq\/index.html, docs\/manual\/index.html/);
  stale.assertUnchanged();
  const current = createFixture(t, true);
  assert.deepEqual(run(['--check'], { root: current.root }), { checked_pages: 2, stale_pages: 0 });
  current.assertUnchanged();
  fs.appendFileSync(path.join(current.root, current.pages[1].source), '\n新增说明。');
  const before = current.snapshot();
  assert.throws(() => run(['--check'], { root: current.root }), /Stale or missing prerenders: docs\/manual\/index.html/);
  assert.deepEqual(current.snapshot(), before);
});
