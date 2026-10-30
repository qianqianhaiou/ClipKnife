'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { renderGuidePage } = require('./prerender-docs.cjs');
const targets = ['faq', 'manual'].map((name) => ({
  page: `docs/${name}/index.html`,
  source: `docs/content/${name}.md`,
  mountSource: `../content/${name}.md`,
  url: `https://clipknife.cn/${name}/`,
}));

function run(args, { root = path.resolve(__dirname, '..'), now = () => new Date() } = {}) {
  const usage = 'Use --check or --write --date YYYY-MM-DD --source-audit FILE';
  const write = args.includes('--write');
  if (!write && (args.length !== 1 || args[0] !== '--check')) throw new Error(usage);
  const readOption = (name) => {
    const index = args.indexOf(name);
    if (index < 0 || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(usage);
    return args[index + 1];
  };
  let date;
  let audit;
  if (write) {
    if (args.length !== 5 || args.includes('--check')) throw new Error(usage);
    date = readOption('--date');
    const today = now();
    const ceiling = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > ceiling) throw new Error('Date must be valid and not in the future');
    audit = JSON.parse(fs.readFileSync(readOption('--source-audit'), 'utf8'));
    if (!audit || audit.approved_version !== '2.6.0' || !Array.isArray(audit.rows) || audit.rows.length !== targets.length) throw new Error('Invalid source audit: expected approved_version 2.6.0 and exactly two rows');
    const seen = new Set();
    for (const row of audit.rows) {
      if (!row || !targets.some((target) => target.page === row.page && target.source === row.source) || seen.has(row.page) || typeof row.local_sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(row.local_sha256)) throw new Error('Invalid source audit: paths, duplicates or SHA-256');
      seen.add(row.page);
    }
  }
  const plans = targets.map((target) => {
    const originalBytes = fs.readFileSync(path.join(root, target.page));
    const original = originalBytes.toString('utf8');
    const mounts = [...original.matchAll(/\bdata-doc-src="([^"]+)"/g)];
    if (mounts.length !== 1 || mounts[0][1] !== target.mountSource) throw new Error(`Unexpected document source: ${target.page}`);
    const sourceBytes = fs.readFileSync(path.join(root, target.source));
    if (write) {
      const row = audit.rows.find((entry) => entry.page === target.page);
      const rawHash = crypto.createHash('sha256').update(sourceBytes).digest('hex');
      if (row.local_sha256 !== rawHash) throw new Error(`Unaudited or changed source: ${target.source}`);
    }
    return { ...target, original, originalBytes, sourceBytes, rendered: renderGuidePage(original, sourceBytes.toString('utf8'), target.url) };
  });
  const changed = plans.filter((plan) => plan.original.replace(/\r\n/g, '\n') !== plan.rendered.replace(/\r\n/g, '\n'));
  const sitemapFile = path.join(root, 'docs/sitemap.xml');
  const sitemapBytes = fs.readFileSync(sitemapFile);
  const urls = new Set(changed.map((plan) => plan.url));
  const found = new Set();
  const sitemap = sitemapBytes.toString('utf8').replace(/<url>([\s\S]*?)<\/url>/g, (entry, contents) => {
    const locations = [...contents.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
    const location = locations.find((url) => targets.some((target) => target.url === url));
    if (!location) return entry;
    if (locations.length !== 1 || found.has(location)) throw new Error(`Duplicate or ambiguous sitemap entry: ${location}`);
    found.add(location);
    if ([...entry.matchAll(/<lastmod>[^<]+<\/lastmod>/g)].length !== 1) throw new Error(`Expected one sitemap lastmod: ${location}`);
    return write && urls.has(location) ? entry.replace(/<lastmod>[^<]+<\/lastmod>/, `<lastmod>${date}</lastmod>`) : entry;
  });
  if (found.size !== targets.length) throw new Error('Both guides must already appear in sitemap');
  if (!write) {
    if (changed.length) throw new Error(`Stale or missing prerenders: ${changed.map((plan) => plan.page).join(', ')}`);
    return { checked_pages: plans.length, stale_pages: 0 };
  }
  // Complete the plan and recheck ALL inputs before the first output write.
  // These sequential file writes are not a multi-file atomic transaction.
  for (const plan of plans) {
    if (!fs.readFileSync(path.join(root, plan.page)).equals(plan.originalBytes)) throw new Error(`Page changed during generation: ${plan.page}`);
    if (!fs.readFileSync(path.join(root, plan.source)).equals(plan.sourceBytes)) throw new Error(`Source changed during generation: ${plan.source}`);
  }
  if (!fs.readFileSync(sitemapFile).equals(sitemapBytes)) throw new Error('Sitemap changed during generation');
  for (const plan of changed) fs.writeFileSync(path.join(root, plan.page), plan.rendered, 'utf8');
  if (changed.length) fs.writeFileSync(sitemapFile, sitemap, 'utf8');
  return { checked_pages: plans.length, updated_pages: changed.map((plan) => plan.page), source_markdown_modified: false };
}

module.exports = { run };
if (require.main === module) {
  try { console.log(JSON.stringify(run(process.argv.slice(2)), null, 2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
