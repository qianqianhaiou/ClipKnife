const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const docsRoot = path.join(__dirname, '..', 'docs');
const read = (file) => fs.readFileSync(path.join(docsRoot, file), 'utf8');
const jsonLd = (html) => [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
  .flatMap((match) => {
    const data = JSON.parse(match[1]);
    return data['@graph'] || [data];
  });

test('homepage structured version matches its actual Windows installer', () => {
  const home = read('index.html');
  const installer = home.match(/_([0-9]+\.[0-9]+\.[0-9]+)_x64-setup\.exe/);
  assert.ok(installer, 'The homepage must link a versioned Windows installer');
  const app = jsonLd(home).find((item) => item['@type'] === 'SoftwareApplication');
  assert.ok(app);
  assert.equal(app.softwareVersion, installer[1]);
});

test('homepage has exactly one self-referencing canonical link', () => {
  const canonicals = [...read('index.html').matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)];
  assert.equal(canonicals.length, 1);
  assert.match(canonicals[0][0], /href="https:\/\/clipknife\.cn\/"/);
});

for (const file of ['index.html', 'manual/index.html', 'faq/index.html', 'changelog/index.html']) {
  test(`${file} has a descriptive summary synchronized with Open Graph`, () => {
    const html = read(file);
    const description = html.match(/<meta name="description" content="([^"]+)"/);
    const social = html.match(/<meta property="og:description" content="([^"]+)"/);
    assert.ok(description);
    assert.ok(social);
    const length = Array.from(description[1]).length;
    assert.ok(length >= 150 && length <= 160, `Expected a 150–160 character summary, got ${length}`);
    assert.equal(social[1], description[1]);
  });
}

test('homepage contact QR images have meaningful alternative text', () => {
  const home = read('index.html');
  for (const image of ['wechat.jpg', 'wechatgroup.jpg']) {
    const tag = [...home.matchAll(/<img\b[^>]*>/g)].map((match) => match[0])
      .find((value) => value.includes(`assets/${image}`));
    assert.ok(tag, `Keep the official-site contact image ${image}`);
    const alt = tag.match(/\balt="([^"]*)"/);
    assert.ok(alt && alt[1].trim().length > 0, `${image} needs descriptive alt text`);
    assert.match(alt[1], /二维码/);
  }
});

test('scene structured content is present in the static article for readers', () => {
  const html = read('scenes/search-video-content/index.html');
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/);
  assert.ok(article, 'The scene needs a static article');
  const normalize = (value) => value.replace(/\s+/g, '');
  const text = normalize(article[1].replace(/<[^>]+>/g, ''));
  const faq = jsonLd(html).find((item) => item['@type'] === 'FAQPage');
  assert.ok(faq);
  assert.equal(faq.mainEntity.length, 4);
  for (const question of faq.mainEntity) {
    assert.ok(text.includes(normalize(question.name)), `Readers must see ${question.name}`);
    assert.ok(text.includes(normalize(question.acceptedAnswer.text)), `Readers must see the complete answer to ${question.name}`);
  }
  const headline = jsonLd(html).find((item) => item['@type'] === 'Article').headline;
  assert.ok(article[1].includes(`<h1>${headline}</h1>`), 'The article heading belongs inside the article');
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
});

test('robots allows required public JS and CSS while retaining the assets restriction', () => {
  const rules = read('robots.txt').split(/\r?\n/)
    .map((line) => line.split('#')[0].trim()).filter(Boolean);
  for (const resource of ['/assets/app.js', '/assets/docs.js', '/assets/styles.css']) {
    assert.ok(rules.includes(`Allow: ${resource}`), `Robots must explicitly allow ${resource}`);
  }
  assert.ok(rules.includes('Disallow: /assets/'));
  assert.ok(rules.includes('Sitemap: https://clipknife.cn/sitemap.xml'));
});

test('SEO-edited pages retain the optimization date in sitemap and scene metadata', () => {
  const entries = new Map([...read('sitemap.xml').matchAll(/<url>([\s\S]*?)<\/url>/g)]
    .map((match) => [match[1].match(/<loc>([^<]+)<\/loc>/)[1], match[1].match(/<lastmod>([^<]+)<\/lastmod>/)[1]]));
  for (const url of [
    'https://clipknife.cn/',
    'https://clipknife.cn/manual/',
    'https://clipknife.cn/faq/',
    'https://clipknife.cn/changelog/',
    'https://clipknife.cn/scenes/search-video-content/',
  ]) {
    const lastmod = entries.get(url);
    assert.match(lastmod, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(lastmod >= '2026-10-09', `Do not regress the lastmod of ${url} to before this optimization`);
  }
  const article = jsonLd(read('scenes/search-video-content/index.html')).find((item) => item['@type'] === 'Article');
  assert.equal(article.datePublished, '2026-10-03');
  assert.equal(article.dateModified, entries.get('https://clipknife.cn/scenes/search-video-content/'));
});

test('scene FAQ answers remain verbatim excerpts from the product FAQ source', () => {
  const normalize = (value) => value.replace(/\s+/g, '');
  const source = normalize(read('content/faq.md'));
  const faq = jsonLd(read('scenes/search-video-content/index.html')).find((item) => item['@type'] === 'FAQPage');
  for (const question of faq.mainEntity) {
    assert.ok(source.includes(normalize(question.acceptedAnswer.text)), `FAQ answer drifted from its source: ${question.name}`);
  }
});
