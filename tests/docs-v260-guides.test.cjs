'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { renderMarkdown } = require('../docs/assets/docs.js');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const entry = '系统设置 → 诊断与修复 → 进入创作助手（临时入口）';
const publicAssets = [
  '/assets/home.css', '/assets/home.js', '/assets/compare.css', '/assets/compare.js',
  '/assets/screenshots/material-library.webp', '/assets/screenshots/smart-search.webp',
  '/assets/screenshots/video-storyboard.webp', '/assets/screenshots/creative-tools.webp',
  '/assets/compare/jianying.ico', '/assets/compare/eagle.png', '/assets/compare/billfish.ico',
];

test('robots precisely allows current home/compare rendering assets, not directories or QR codes', () => {
  const robots = read('docs/robots.txt');
  const rules = [...robots.matchAll(/^(Allow|Disallow):\s*(\S+)/gm)].map((m) => ({ allow: m[1] === 'Allow', value: m[2] }));
  const allowed = (url) => {
    const matches = rules.filter(({value}) => value.endsWith('$') ? url === value.slice(0, -1) : url.startsWith(value));
    matches.sort((a,b) => b.value.replace(/\$$/, '').length - a.value.replace(/\$$/, '').length || Number(b.allow) - Number(a.allow));
    return matches[0]?.allow ?? true;
  };
  const home = read('docs/index.html');
  for (const asset of publicAssets) {
    assert.ok(home.includes(asset.slice(1)), `real home reference: ${asset}`);
    assert.ok(fs.existsSync(path.join(root, 'docs', asset)), `exists: ${asset}`);
    assert.ok(rules.some((rule) => rule.allow && rule.value === `${asset}$`), `exact allow: ${asset}`);
    assert.equal(allowed(asset), true, asset);
    assert.equal(allowed(`${asset}.private`), false, `suffix is not allowed: ${asset}`);
  }
  assert.ok(rules.some((rule) => !rule.allow && rule.value === '/assets/'));
  for (const asset of ['/assets/private.png', '/assets/screenshots/other.webp', '/assets/compare/other.png', '/assets/wechat.jpg', '/assets/wechatgroup1106.jpg']) assert.equal(allowed(asset), false, asset);
  for (const dir of ['/assets/', '/assets/screenshots/', '/assets/compare/']) assert.ok(!rules.some((rule) => rule.allow && rule.value === dir));
});

for (const name of ['manual', 'faq']) {
  test(`${name}: published 2.6.0 operational guidance replaces development labels`, () => {
    const md = read(`docs/content/${name}.md`);
    assert.match(md, /适用(?:版本|范围)：Windows x64，v2\.6\.0/);
    assert.match(md, /更新时间：2026-10-30/);
    if (name === 'faq') assert.ok(md.includes('从分组中移出素材也只影响分组成员关系'));
    assert.ok(md.includes(entry));
    for (const term of ['我的分组', '添加到分组', '一次性导入', '单独添加的文件', '高级初始化', '从素材库移除', '永久删除原文件', '不经过回收站', 'NTFS/ReFS']) assert.ok(md.includes(term), term);
    assert.doesNotMatch(md, /待发布|尚未发布|开发版/);
    assert.doesNotMatch(md, /项目用于|使用项目的一般流程|以下说明适用于已发布的 v2\.5\.0 项目管理/);
    assert.match(md, /不再自动.*项目片段|取消项目专用的自动片段准备/);
    assert.match(md, /旧项目导出文件|已有导出文件保留/);
    assert.match(md, /重启不会|重启后.*不会|重启不会自动/);
    assert.ok(md.includes('../changelog/v2.6.0/'));
  });
}

test('both static guides contain the exact Markdown render, with current sitemap dates', () => {
  for (const name of ['faq', 'manual']) {
    const md = read(`docs/content/${name}.md`);
    const html = read(`docs/${name}/index.html`);
    assert.ok(html.includes(renderMarkdown(md).html), `${name} has stale body`);
    assert.ok(html.includes(entry));
    assert.match(html, /data-doc-prerendered="true"/);
    const xml = read('docs/sitemap.xml');
    const row = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].find((m) => m[1].includes(`<loc>https://clipknife.cn/${name}/</loc>`));
    assert.ok(row);
    assert.match(row[1], /<lastmod>2026-10-30<\/lastmod>/);
  }
});

test('existing FAQ schema does not silently claim changed operational questions', () => {
  const html = read('docs/faq/index.html');
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const md = read('docs/content/faq.md');
  const strip = (text) => text.replace(/<[^>]+>/g, '').replace(/\s/g, '');
  for (const question of schema.mainEntity) {
    if (!/项目|分组|初始化|单个文件|永久删除|从素材库移除|创作助手/.test(question.name)) continue;
    const sections = md.split(/^#{2,3} /m);
    const section = sections.find((s) => s.split('\n')[0] === question.name);
    assert.ok(section, question.name);
    assert.equal(strip(renderMarkdown(section.slice(section.indexOf('\n') + 1)).html), strip(question.acceptedAnswer.text));
  }
});
