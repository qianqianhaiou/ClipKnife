const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docsRoot = path.join(__dirname, '..', 'docs');
const publishedVersions = ['v2.1.0', 'v2.0.1'];
const releaseIndex = fs.readFileSync(path.join(docsRoot, 'changelog', 'index.html'), 'utf8');
const sitemap = fs.readFileSync(path.join(docsRoot, 'sitemap.xml'), 'utf8');
const releaseItems = [...releaseIndex.matchAll(/<a class="release-item" href="([^"]+)">([\s\S]*?)<\/a>/g)];

for (const version of publishedVersions) {
  test(`${version} has a published Markdown document and a matching page`, () => {
    const page = fs.readFileSync(path.join(docsRoot, 'changelog', version, 'index.html'), 'utf8');
    const source = page.match(/data-doc-src="([^"]+)"/);
    assert.ok(source, 'The page must load a Markdown document');
    const markdownPath = path.resolve(docsRoot, 'changelog', version, source[1]);
    assert.equal(markdownPath, path.join(docsRoot, 'content', 'changelog', `${version}.md`));
    const markdown = fs.readFileSync(markdownPath, 'utf8');

    assert.equal(markdown.split(/\r?\n/)[0], `# ${version}`);
    assert.match(markdown, /发布通道：stable/);
    assert.match(markdown, /发布状态：已发布/);
    assert.doesNotMatch(markdown, /待发布|尚未发布|将在正式发布时|发布计划/);
    assert.ok(page.includes(`<title>素刀 ClipKnife ${version} 更新日志</title>`));
    assert.ok(page.includes(`rel="canonical" href="https://clipknife.cn/changelog/${version}/"`));
    assert.ok(page.includes('src="../../assets/docs.js"'));
    assert.ok(page.includes('id="docToc"'));
    assert.doesNotMatch(page, /home-particle-scroll\.js|http-equiv="origin-trial"/);

    const date = markdown.match(/发布时间：(\d{4}-\d{2}-\d{2})/);
    assert.ok(date, 'Published releases must include a release date');
    const items = releaseItems.filter((item) => item[1] === `${version}/`);
    assert.equal(items.length, 1, 'Each version must appear exactly once in the release index');
    assert.ok(items[0][2].includes(`<span class="release-date">${date[1]}</span>`));
    assert.ok(items[0][2].includes('<strong>正式版本</strong>'));

    const sitemapEntries = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)];
    assert.equal(sitemapEntries.filter((item) => item[1] === `https://clipknife.cn/changelog/${version}/`).length, 1);
  });

  test(`${version} resolves local navigation, assets, Markdown and download links`, () => {
    const pagePath = path.join(docsRoot, 'changelog', version, 'index.html');
    const page = fs.readFileSync(pagePath, 'utf8');
    const markdown = fs.readFileSync(path.join(docsRoot, 'content', 'changelog', `${version}.md`), 'utf8');
    const links = [
      ...[...page.matchAll(/(?:href|src|data-doc-src)="([^"]+)"/g)].map((match) => match[1]),
      ...[...markdown.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]),
    ];

    for (const link of links) {
      const url = new URL(link, `https://clipknife.cn/changelog/${version}/`);
      if (url.origin !== 'https://clipknife.cn') continue;
      const target = path.join(docsRoot, decodeURIComponent(url.pathname));
      const file = url.pathname.endsWith('/') ? path.join(target, 'index.html') : target;
      assert.ok(fs.statSync(file).isFile(), `Missing local destination: ${link}`);
      if (url.hash) {
        const content = fs.readFileSync(file, 'utf8');
        assert.ok(content.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `Missing anchor: ${link}`);
      }
    }
  });
}

test('the release index puts the draft before published versions', () => {
  assert.deepEqual(releaseItems.slice(0, 4).map((item) => item[1]), ['v2.2.0/', 'v2.1.0/', 'v2.0.1/', 'v2.0.0/']);
  assert.match(releaseIndex, /<meta name="description" content="[^"]*v2\.2\.0/);
  assert.match(releaseIndex, /<meta property="og:description" content="[^"]*v2\.2\.0/);
});

test('v2.2.0 remains clearly marked as an unpublished draft', () => {
  const page = fs.readFileSync(path.join(docsRoot, 'changelog', 'v2.2.0', 'index.html'), 'utf8');
  const markdown = fs.readFileSync(path.join(docsRoot, 'content', 'changelog', 'v2.2.0.md'), 'utf8');
  const items = releaseItems.filter((item) => item[1] === 'v2.2.0/');
  assert.equal(items.length, 1);
  assert.match(items[0][2], /<strong>待发布<\/strong>/);
  assert.match(markdown, /发布时间：待定/);
  assert.match(markdown, /发布状态：待发布/);
  assert.match(page, /name="robots" content="noindex"/);
  assert.match(page, /data-doc-src="\.\.\/\.\.\/content\/changelog\/v2\.2\.0\.md"/);
  assert.doesNotMatch(sitemap, /https:\/\/clipknife\.cn\/changelog\/v2\.2\.0\//);
  const links = [
    ...[...page.matchAll(/(?:href|src|data-doc-src)="([^"]+)"/g)].map((match) => match[1]),
    ...[...markdown.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]),
  ];
  for (const link of links) {
    const url = new URL(link, 'https://clipknife.cn/changelog/v2.2.0/');
    if (url.origin !== 'https://clipknife.cn') continue;
    const target = path.join(docsRoot, decodeURIComponent(url.pathname));
    const file = url.pathname.endsWith('/') ? path.join(target, 'index.html') : target;
    assert.ok(fs.statSync(file).isFile(), `Missing local destination: ${link}`);
    if (url.hash) {
      assert.ok(fs.readFileSync(file, 'utf8').includes(`id="${decodeURIComponent(url.hash.slice(1))}"`));
    }
  }
});
