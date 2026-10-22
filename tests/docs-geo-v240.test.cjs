'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('homepage schema follows its actual installer and records this metadata update', () => {
  const html = read('docs/index.html');
  const versions = [...html.matchAll(/_([0-9]+\.[0-9]+\.[0-9]+)_x64-setup\.exe/g)].map(match => match[1]);
  assert.ok(versions.length > 0);
  assert.equal(new Set(versions).size, 1, 'Conflicting installer versions');
  const nodes = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .flatMap(match => { const data = JSON.parse(match[1]); return data['@graph'] || [data]; });
  const app = nodes.find(node => node['@type'] === 'SoftwareApplication');
  assert.ok(app);
  assert.equal(app.softwareVersion, versions[0]);
  const entry = read('docs/sitemap.xml').match(/<url>\s*<loc>https:\/\/clipknife.cn\/<\/loc>([\s\S]*?)<\/url>/);
  assert.ok(entry);
  assert.ok(entry[1].includes('<lastmod>2026-10-22</lastmod>'));
});

test('root changelog preserves the published v2.4.0 facts and scoped CUDA migration', () => {
  const changelog = read('CHANGELOG.md');
  const heading = changelog.match(/^## v2\.4\.0 .+$/m);
  assert.equal(heading?.[0], '## v2.4.0 — 2026-10-16');
  const release = changelog.split('## v2.4.0 — 2026-10-16')[1].split('## v2.3.0')[0];
  for (const required of [
    'docs/content/changelog/v2.4.0.md', '智能分类', '词云', '本机图片和视频分镜',
    '候选需由用户确认', '最近标签', '分镜循环', '默认关闭',
    '每次添加一张图片、一个完整视频或一个分镜', '时间线末尾的新轨道',
    '完整原视频及选定范围', '原素材范围内调整首尾',
    '5.9.0.11632', '11.6.0.14552', '配套新版分镜组件', '素刀连接', '0.2.0',
    '活动序列', '面板打开', 'Windows Premiere Pro 26.0', '26.0.0',
    '不支持 PR 25.x 和 macOS', '不支持单独添加音频或直接添加共享库素材',
    '不会自动新建草稿、项目或序列', '结果未确认', '先检查剪辑软件中的时间线',
    'CUDA 13', '计算能力至少 7.5', 'Windows 驱动至少 580.88',
    'Maxwell', 'Pascal', 'Volta', 'GTX 1050 Ti', '搜索会回退 CPU',
    '无法运行新版本地视觉描述', '4GB', '6GB', '不提供 CPU 推理',
    'CPU 与 AMD 搜索组件不适用这组 NVIDIA 门槛', '备份应用数据',
  ]) assert.ok(release.includes(required), `Missing release fact: ${required}`);
});

test('search-to-edit guidance scopes v2.4.0 delivery and its compatibility boundaries', () => {
  const html = read('docs/scenes/search-video-content/index.html');
  const section = html.match(/<section id="search-to-edit">([\s\S]*?)<\/section>/);
  assert.ok(section, 'Missing static search-to-edit section');
  const text = section[1].replace(/<[^>]*>/g, '');
  for (const required of [
    'v2.4.0', '每次添加一张图片、一个完整视频或一个分镜', '时间线末尾的新轨道',
    '完整原视频及选定范围', '原素材范围内调整首尾', '添加到 → 剪映',
    '5.9.0.11632', '11.6.0.14552', '配套新版分镜组件',
    '素刀连接', '0.2.0', '活动序列', '面板打开', 'Windows Premiere Pro 26.0',
    '26.0.0', '官方版本日志', '其他版本尚未逐版验证', '不支持 PR 25.x 和 macOS',
    '不支持单独添加音频或直接添加共享库素材', '不会自动新建草稿、项目或序列',
    '结果未确认', '先检查剪辑软件中的时间线', '避免重复添加',
  ]) assert.ok(text.includes(required), `Missing delivery boundary: ${required}`);
  assert.ok(section[1].includes('href="../../changelog/v2.4.0/"'));
  assert.match(html, /适用版本：v2\.3\.0/);
  assert.match(html, /新增的“从检索到剪辑”一节适用 v2\.4\.0/);
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const article = schema['@graph'].find(node => node['@type'] === 'Article');
  assert.equal(article.datePublished, '2026-10-03');
  assert.equal(article.dateModified, '2026-10-17');
  const entry = read('docs/sitemap.xml').match(/<url>\s*<loc>https:\/\/clipknife.cn\/scenes\/search-video-content\/<\/loc>([\s\S]*?)<\/url>/);
  assert.ok(entry);
  assert.ok(entry[1].includes(`<lastmod>${article.dateModified}</lastmod>`));
});
