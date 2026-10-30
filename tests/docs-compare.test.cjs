'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..', 'docs');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const home = read('index.html');
const comparison = home.match(/<section id="compare"[^>]*>([\s\S]*?)<\/section>/)?.[1];
const pages = ['eagle', 'billfish'];
const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const text = html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const jsonLd = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .flatMap(match => { const data = JSON.parse(match[1]); return data['@graph'] || [data]; });

function assertLocalLinks(html, file) {
  const base = new URL(file, 'https://local.test/');
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const url = new URL(match[1], base);
    if (url.origin !== base.origin) continue;
    let target = decodeURIComponent(url.pathname).slice(1);
    if (!target || target.endsWith('/')) target += 'index.html';
    const absolute = path.resolve(root, target);
    assert.ok(absolute.startsWith(root + path.sep), 'Local resources stay within docs');
    assert.ok(fs.existsSync(absolute), `${file}: missing ${match[1]}`);
    if (url.hash && target.endsWith('.html')) {
      assert.ok(ids(read(target)).includes(decodeURIComponent(url.hash.slice(1))), `${file}: unresolved anchor ${match[1]}`);
    }
  }
}

test('homepage comparison is discoverable in both menus, footer and the intended reading order', () => {
  assert.ok(comparison);
  assert.ok(home.indexOf('id="features"') < home.indexOf('id="compare"'));
  assert.ok(home.indexOf('id="compare"') < home.indexOf('id="creation"'));
  const header = home.match(/<header\b[^>]*>([\s\S]*?)<\/header>/)[1];
  assert.equal([...header.matchAll(/href="#compare"/g)].length, 2);
  const footer = home.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)[1];
  for (const name of pages) {
    assert.ok(comparison.includes(`href="compare/${name}/"`));
    assert.ok(footer.includes(`href="compare/${name}/"`));
  }
  assertLocalLinks(comparison, 'index.html');
});

test('scene-led comparison shows five advantages and three product rows with scoped claims', () => {
  const body = comparison.match(/<tbody>([\s\S]*?)<\/tbody>/)[1];
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)];
  assert.equal(rows.length, 3);
  for (const row of rows) {
    assert.equal([...row[1].matchAll(/<th scope="row">/g)].length, 1);
    assert.equal([...row[1].matchAll(/<td\b/g)].length, 5);
  }
  assert.deepEqual(rows.map(row => text(row[1].match(/<th[^>]*>([\s\S]*?)<\/th>/)[1])), ['素刀 ClipKnife', 'Eagle', 'Billfish']);
  const benefits = comparison.match(/<ol class="comparison-benefits"[^>]*>([\s\S]*?)<\/ol>/)[1];
  assert.equal([...benefits.matchAll(/<li>/g)].length, 5);
  for (const capability of ['按画面搜索', '自动分镜定位', '搜台词找片段', '人物自动归组', '分镜直送剪辑']) {
    assert.ok(text(benefits).includes(capability), `Missing differentiator: ${capability}`);
  }
  assert.match(text(body), /依赖已有文字/);
  assert.match(text(body), /交付范围未提及/);
  assert.match(text(body), /插件选段导出/);
  assert.match(comparison, /Billfish 官网展示图像内容搜索与以图搜图/);
  assert.match(text(benefits), /开启转写/);
  assert.match(text(comparison), /需建立索引.*转写、人物按需启用.*配套环境/);
  assert.match(text(comparison), /官网未提及.*不等于不支持/);
  assert.doesNotMatch(text(comparison), /未确认|待确认/);
  assert.match(text(comparison), /4\.0\.0 Build23/);
  assert.ok(comparison.includes('href="compare/eagle/#conditions"'));
  assert.ok(comparison.includes('href="demo/"'));
});

test('comparison illustration uses local sample assets, labelled examples and real controls', () => {
  assert.match(comparison, /能力示意/);
  assert.match(text(comparison), /两项预设示例.*不运行 AI 检索/);
  assert.match(comparison, /<form[^>]*data-compare-search/);
  assert.match(comparison, /<input[^>]*aria-label="[^"]+"[^>]*maxlength="160"/);
  const cards = [...comparison.matchAll(/<button[^>]*data-compare-result="[^"]+"[^>]*>/g)];
  assert.equal(cards.length, 2);
  for (const card of cards) assert.match(card[0], /aria-pressed="(?:true|false)"/);
  assert.match(comparison, /<audio[^>]*src="assets\/compare\/coastal-voice.mp3"[^>]*preload="none"/);
  assert.doesNotMatch(comparison, /autoplay|generated_images|reference\.png/);
  assert.ok(fs.existsSync(path.join(root, 'assets/compare/NOTICE.txt')));
  for (const match of comparison.matchAll(/aria-(?:describedby|labelledby)="([^"]+)"/g)) {
    for (const id of match[1].split(' ')) assert.ok(ids(home).includes(id));
  }
});

test('comparison icons contain drawable geometry without requesting a separate SVG document', () => {
  const symbols = new Map([...read('assets/compare/icons.svg').matchAll(/<symbol id="([^"]+)" viewBox="0 0 24 24">([\s\S]*?)<\/symbol>/g)].map(match => [match[1], match[2]]));
  const icons = [...comparison.matchAll(/<svg\b([^>]*\bclass="[^"]*\bcomparison-icon\b[^"]*"[^>]*)>([\s\S]*?)<\/svg>/g)];
  assert.ok(icons.length >= 20, 'Capability, action and comparison icons are present');
  for (const [, attributes, body] of icons) {
    assert.match(attributes, /\bviewBox="0 0 24 24"/);
    assert.match(body, /<(?:path|circle|rect|line)\b/);
    assert.doesNotMatch(body, /<(?:use|image)\b/, 'Icons render even when external SVG requests are blocked');
    const name = attributes.match(/data-comparison-icon="([^"]+)"/)?.[1];
    assert.ok(symbols.has(name), 'Glyph has a licensed source');
    assert.equal(body, symbols.get(name), 'Inlining preserves the approved icon');
  }
});

for (const name of pages) {
  const file = `compare/${name}/index.html`;
  test(`${name}: page, assets, source references and nested-route anchors all resolve`, () => {
    const html = read(file);
    assertLocalLinks(html, file);
    const allIds = ids(html);
    assert.equal(new Set(allIds).size, allIds.length, 'No duplicate section or citation IDs');
    for (const match of html.matchAll(/aria-(?:labelledby|describedby)="([^"]+)"/g)) {
      for (const id of match[1].split(/\s+/)) assert.ok(allIds.includes(id), `Missing accessible label ${id}`);
    }
    const citationIds = [...html.matchAll(/href="#(source-[^"]+)"/g)].map(match => match[1]);
    assert.ok(citationIds.length >= 18, 'Both products have citations beside their compared facts');
    for (const id of citationIds) assert.ok(allIds.includes(id));
    const sources = html.match(/<ul class="compare-sources">([\s\S]*?)<\/ul>/)[1];
    for (const match of sources.matchAll(/href="(https:[^"]+)"/g)) {
      const url = new URL(match[1]);
      assert.ok(['cn.eagle.cool', 'community-cn.eagle.cool', 'www.billfish.cn'].includes(url.hostname), 'Competitor evidence uses official sources or the official plugin directory');
    }
  });

  test(`${name}: search metadata describes the visible article and is included once in the sitemap`, () => {
    const html = read(file);
    const url = `https://clipknife.cn/compare/${name}/`;
    assert.equal([...html.matchAll(/rel="canonical"/g)].length, 1);
    assert.ok(html.includes(`rel="canonical" href="${url}"`));
    assert.ok(html.includes(`property="og:url" content="${url}"`));
    const description = html.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(description.length > 70);
    assert.ok(html.includes(`property="og:description" content="${description}"`));
    const nodes = jsonLd(html);
    const article = nodes.find(node => node['@type'] === 'Article');
    assert.equal(article.mainEntityOfPage, url);
    assert.equal(article.description, description);
    assert.ok(article.headline.includes(name === 'eagle' ? 'Eagle' : 'Billfish'));
    const reviewDate = html.match(/<time datetime="([0-9-]+)">/)[1];
    assert.equal(article.dateModified, reviewDate);
    assert.match(reviewDate, /^\d{4}-\d{2}-\d{2}$/);
    const breadcrumbs = nodes.find(node => node['@type'] === 'BreadcrumbList').itemListElement;
    assert.equal(breadcrumbs.at(-1).item, url);
    const entries = [...read('sitemap.xml').matchAll(/<url>([\s\S]*?)<\/url>/g)].filter(match => match[1].includes(`<loc>${url}</loc>`));
    assert.equal(entries.length, 1);
    assert.ok(entries[0][1].includes(`<lastmod>${reviewDate}</lastmod>`));
  });

  test(`${name}: complete content and actions work without a JavaScript renderer`, () => {
    const html = read(file);
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    assert.equal([...html.matchAll(/<script\b/g)].length, 1, 'Only structured metadata, no executable script');
    assert.doesNotMatch(html, /<script[^>]*src=|fonts\.google|cdn\.tailwind|data-doc-src=/);
    for (const target of ['../../demo/', '../../#download', `../${name === 'eagle' ? 'billfish' : 'eagle'}/`]) {
      assert.ok(html.includes(`href="${target}"`));
    }
    const rows = [...html.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].matchAll(/<tr>([\s\S]*?)<\/tr>/g)];
    assert.equal(rows.length, 9);
    for (const row of rows) {
      assert.equal([...row[1].matchAll(/<th scope="row">/g)].length, 1);
      assert.equal([...row[1].matchAll(/<td\b/g)].length, 2);
    }
    assert.match(html, /class="compare-table-scroll" role="region" tabindex="0"/);
    assert.match(html, /<caption>[^<]+<\/caption>/);
    assert.ok([...html.matchAll(/<details>/g)].length >= 4);
    assert.match(html, /<summary>[^<]+<\/summary>/);
    const image = html.match(/<img[^>]*fetchpriority="high"[^>]*>/)[0];
    assert.match(image, /width="1440" height="900"/);
    assert.match(image, /alt="[^"]+"/);
    assert.match(text(html), /隔离示例数据/);
  });

  test(`${name}: claims disclose indexing, platform, optional processing and unverified capability boundaries`, () => {
    const body = text(read(file).split('<body')[1]);
    for (const fact of ['Windows x64', '16GB', 'CPU', '默认关闭', '采样画面', '许可验证', '局域网共享', '供应商', '原始素材', '官方资料未明确']) {
      assert.ok(body.includes(fact), `Missing condition: ${fact}`);
    }
    assert.match(body, /候选.*确认/);
    assert.match(body, /26\.0\.0/);
    assert.match(body, /标签与评分/);
    assert.doesNotMatch(body, /价格|收费|免费|订阅|性价比|永久免费|完全离线|零占用|百分之百|全面碾压/);
  });
}
test('comparison-only content keeps fees out of the homepage summary too', () => {
  assert.doesNotMatch(text(comparison), /价格|收费|免费|订阅|性价比/);
});

