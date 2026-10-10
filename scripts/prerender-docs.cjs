'use strict';
const crypto = require('node:crypto');
const { renderMarkdown } = require('../docs/assets/docs.js');
const normalize = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const sha256 = (text) => crypto.createHash('sha256').update(normalize(text)).digest('hex');

function htmlTags(html) {
  const tags = [];
  let templateDepth = 0;
  let foreignDepth = 0;
  const starts = /<!--[\s\S]*?(?:-->|$)|<\/?[a-z][^ \t\n\f\r/>]*(?=[ \t\n\f\r/>])/gi;
  let start;
  while ((start = starts.exec(html))) {
    if (start[0].startsWith('<!--')) continue;
    // Consume each complete tag so quoted attributes cannot become elements.
    const match = html.slice(start.index).match(/^<(\/?)([a-z][^ \t\n\f\r/>]*)((?:[^"'<>]|"[^"]*"|'[^']*')*)>/i);
    if (!match) throw new Error('Malformed link attributes');
    const tag = {
      index: start.index,
      end: start.index + match[0].length,
      closing: Boolean(match[1]),
      name: match[2].toLowerCase(),
      attributes: match[3],
      templateDepth,
      foreignDepth,
    };
    tags.push(tag);
    starts.lastIndex = tag.end;
    if (tag.name === 'template') templateDepth = Math.max(0, templateDepth + (tag.closing ? -1 : 1));
    if (tag.name === 'svg' || tag.name === 'math') foreignDepth = Math.max(0, foreignDepth + (tag.closing ? -1 : 1));
    if (!tag.closing && /^(?:script|style|title|textarea|xmp|iframe|noembed|noframes)$/.test(tag.name)) {
      const closing = new RegExp(`</${tag.name}(?=[ \\t\\n\\f\\r/>])[^>]*>`, 'gi');
      closing.lastIndex = starts.lastIndex;
      const end = closing.exec(html);
      starts.lastIndex = end ? closing.lastIndex : html.length;
    }
  }
  return tags;
}

function headBoundary(tags) {
  const realHeads = tags.filter((tag) => tag.name === 'head' && tag.templateDepth === 0 && tag.foreignDepth === 0);
  const openings = realHeads.filter((tag) => !tag.closing);
  const closings = realHeads.filter((tag) => tag.closing);
  if (openings.length !== 1 || closings.length !== 1 || openings[0].end > closings[0].index) throw new Error('Missing real head closing tag');
  return { opening: openings[0], closing: closings[0] };
}

function canonicalLinks(tags, head) {
  const canonical = [];
  for (const tag of tags) {
    if (tag.closing || tag.name !== 'link') continue;
    const attributes = new Map();
    let rest = tag.attributes;
    while (!/^[ \t\n\f\r]*\/?[ \t\n\f\r]*$/.test(rest)) {
      const attribute = rest.match(/^[ \t\n\f\r]+([^ \t\n\f\r"'<>/=]+)(?:[ \t\n\f\r]*=[ \t\n\f\r]*(?:"([^"]*)"|'([^']*)'|([^ \t\n\f\r"'=<>`]+)))?/);
      if (!attribute) throw new Error('Malformed link attributes');
      const name = attribute[1].toLowerCase();
      if (attributes.has(name)) throw new Error('Malformed link attributes');
      attributes.set(name, attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
      rest = rest.slice(attribute[0].length);
    }
    const relation = attributes.get('rel') || '';
    if (relation.includes('&')) throw new Error('Malformed link attributes: encoded rel is unsupported');
    if (!relation.toLowerCase().split(/[ \t\n\f\r]+/).includes('canonical')) continue;
    if (tag.index < head.opening.end || tag.end > head.closing.index || tag.templateDepth > 0 || tag.foreignDepth > 0) throw new Error('Canonical outside valid head');
    canonical.push(attributes);
  }
  return canonical;
}

function renderPage(template, markdown, pageUrl) {
  if (!/^https:\/\/clipknife\.cn\/changelog\/v\d+\.\d+\.\d+\/$/.test(pageUrl)) throw new Error('Only version-log pages are eligible');
  const rendered = renderMarkdown(normalize(markdown));
  if (rendered.toc.filter((entry) => entry.level === 1).length !== 1) throw new Error('Expected exactly one source H1');
  const mount = /<div\b([^>]*\bdata-doc-src="[^"]+"[^>]*)>[\s\S]*?<\/div>/g;
  if ([...template.matchAll(mount)].length !== 1) throw new Error('Expected exactly one document mount');
  let html = normalize(template).replace(mount, (_, attributes) => {
    const clean = attributes.replace(/\s+data-doc-(?:prerendered|source-sha256)="[^"]*"/g, '');
    return `<div${clean} data-doc-prerendered="true" data-doc-source-sha256="${sha256(markdown)}">\n${rendered.html}\n</div>`;
  });
  const links = rendered.toc.filter((entry) => entry.level === 2 || entry.level === 3)
    .map((entry) => `<a class="toc-link toc-level-${entry.level}" href="#${encodeURIComponent(entry.id)}">${escape(entry.text)}</a>`).join('\n');
  if (!/<nav id="docToc">[\s\S]*?<\/nav>/.test(html)) throw new Error('Missing directory mount');
  html = html.replace(/<nav id="docToc">[\s\S]*?<\/nav>/, () => `<nav id="docToc">${links}</nav>`);
  html = html.replace(/<div id="docStatus"([^>]*)>/, (_, attrs) => `<div id="docStatus"${attrs.replace(/\s+hidden\b/g, '')} hidden>`);
  const tags = htmlTags(html);
  const head = headBoundary(tags);
  const canonical = canonicalLinks(tags, head);
  if (canonical.length > 1 || (canonical.length === 1 && canonical[0].get('href') !== pageUrl)) throw new Error('Conflicting canonical');
  if (!canonical.length) {
    const index = head.closing.index;
    html = `${html.slice(0, index)}  <link rel="canonical" href="${pageUrl}" />\n${html.slice(index)}`;
    const insertedTags = htmlTags(html);
    const inserted = canonicalLinks(insertedTags, headBoundary(insertedTags));
    if (inserted.length !== 1 || inserted[0].get('href') !== pageUrl) throw new Error('Canonical insertion failed');
  }
  return html;
}

const fs = require('node:fs');
const path = require('node:path');

function run(args) {
  const root = path.resolve(__dirname, '..');
  const write = args.includes('--write');
  if (!write && !args.includes('--check')) throw new Error('Use --check or --write --date YYYY-MM-DD --source-audit FILE');
  const readOption = (name) => {
    const index = args.indexOf(name);
    if (index < 0 || !args[index + 1]) throw new Error(`Missing ${name}`);
    return args[index + 1];
  };
  let date;
  let audit;
  if (write) {
    date = readOption('--date');
    const today = new Date();
    const ceiling = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > ceiling) throw new Error('Date must be valid and not in the future');
    audit = JSON.parse(fs.readFileSync(readOption('--source-audit'), 'utf8'));
  }
  const versions = fs.readdirSync(path.join(root, 'docs', 'changelog')).filter((name) => /^v\d+\.\d+\.\d+$/.test(name)).sort();
  const plans = versions.map((version) => {
    const page = `docs/changelog/${version}/index.html`;
    const source = `docs/content/changelog/${version}.md`;
    const original = fs.readFileSync(path.join(root, page), 'utf8');
    const sourceBytes = fs.readFileSync(path.join(root, source));
    const markdown = sourceBytes.toString('utf8');
    if (write) {
      const row = audit.rows.find((entry) => entry.page === page && entry.source === source);
      const rawHash = crypto.createHash('sha256').update(sourceBytes).digest('hex');
      if (!audit.eligible_pages.includes(page) || !row || row.status !== 200 || !row.text_public_local || row.source_dirty || row.local_sha256 !== rawHash) throw new Error(`Unaudited or changed source: ${source}`);
    }
    const url = `https://clipknife.cn/changelog/${version}/`;
    return { page, source, sourceBytes, url, original, rendered: renderPage(original, markdown, url) };
  });
  const changed = plans.filter((plan) => normalize(plan.original) !== plan.rendered);
  if (!write) {
    if (changed.length) throw new Error(`Stale or missing prerenders: ${changed.map((plan) => plan.page).join(', ')}`);
    console.log(JSON.stringify({ checked_pages: plans.length, stale_pages: 0 }));
    return;
  }
  const sitemapFile = path.join(root, 'docs', 'sitemap.xml');
  const sitemapOriginal = fs.readFileSync(sitemapFile, 'utf8');
  const urls = new Set(changed.map((plan) => plan.url));
  let sitemap = normalize(sitemapOriginal);
  const found = new Set();
  sitemap = sitemap.replace(/<url>([\s\S]*?)<\/url>/g, (entry, contents) => {
    const location = contents.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (!urls.has(location)) return entry;
    found.add(location);
    if (!/<lastmod>[^<]+<\/lastmod>/.test(entry)) throw new Error(`Missing lastmod: ${location}`);
    return entry.replace(/<lastmod>[^<]+<\/lastmod>/, `<lastmod>${date}</lastmod>`);
  });
  if (found.size !== urls.size) throw new Error('Every changed page must already appear in sitemap');
  for (const plan of plans) {
    if (fs.readFileSync(path.join(root, plan.page), 'utf8') !== plan.original) throw new Error(`Page changed during generation: ${plan.page}`);
  }
  if (fs.readFileSync(sitemapFile, 'utf8') !== sitemapOriginal) throw new Error('Sitemap changed during generation');
  for (const plan of plans) {
    if (!fs.readFileSync(path.join(root, plan.source)).equals(plan.sourceBytes)) throw new Error(`Source changed during generation: ${plan.source}`);
  }
  for (const plan of changed) fs.writeFileSync(path.join(root, plan.page), plan.rendered, 'utf8');
  if (changed.length) fs.writeFileSync(sitemapFile, sitemap, 'utf8');
  console.log(JSON.stringify({ checked_pages: plans.length, updated_pages: changed.map((plan) => plan.page), source_markdown_modified: false, excluded_pages: ['docs/manual/index.html', 'docs/faq/index.html'] }, null, 2));
}

module.exports = { renderPage, run };
if (require.main === module) {
  try { run(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
