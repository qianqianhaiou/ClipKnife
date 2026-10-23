'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Chinese README states the documentation scope and current product boundaries', () => {
  const text = read('README.md');
  for (const fact of [
    '不包含桌面应用源代码', 'https://clipknife.cn/',
    '不提供备注编辑、手工调整起止时间、合并、拆分或删除分镜',
    '批量视频拆分镜', '项目管理', '剪映草稿',
    '局域网共享默认关闭', 'HTTP 明文', '外部视觉 API',
    '对话和描述文字', '联网激活', '核心检索可使用 CPU',
    '不提供 CPU 推理', 'Vulkan', '公测',
  ]) assert.ok(text.includes(fact), `Missing public boundary: ${fact}`);
  assert.doesNotMatch(text, /预留页面|正在实现.*MVP|https:\/\/qianqianhaiou\.github\.io|微信|二维码/);
  assert.doesNotMatch(text, /素材原文件永不离开|永久[免费承诺]|pnpm tauri dev/);
});

test('English README describes the released app rather than an open-source MVP', () => {
  const text = read('README.en.md');
  for (const fact of [
    'does not contain the desktop application source code', 'https://clipknife.cn/',
    'tag editing only', 'manual boundary changes, merging, splitting or deleting shots',
    'Project management', 'Jianying drafts', 'disabled by default', 'unencrypted HTTP',
    'external vision API', 'conversation and description text', 'online activation',
    'Core local search can run on a CPU', 'no CPU inference', 'Vulkan', 'public beta',
  ]) assert.ok(text.includes(fact), `Missing English boundary: ${fact}`);
  assert.doesNotMatch(text, /reserved pages|implementing the ClipKnife MVP|pnpm (?:install|tauri dev|build)|bun install|build\.ps1/);
  assert.doesNotMatch(text, /qianqianhaiou\.github\.io|WeChat|QR code|free forever/i);
});

test('homepage scopes CPU support and separates local, LAN and external-model data', () => {
  const html = read('docs/index.html');
  assert.ok(html.includes('本机核心检索可用 CPU'));
  assert.doesNotMatch(html, /CPU 可运行，GPU 可加速|素材原文件永不离开本地硬盘|素材文件不会上传至任何云端服务器/);
  const details = [...html.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/g)].map(match => match[1]);
  const network = details.find(block => block.includes('素刀 需要联网吗？'));
  const privacy = details.find(block => block.includes('我的素材隐私如何保障？'));
  assert.ok(network && privacy);
  for (const fact of ['激活', '许可验证', '组件下载', '局域网', '外部视觉模型']) {
    assert.ok(network.includes(fact), `Missing connectivity boundary: ${fact}`);
  }
  for (const fact of ['素刀公网服务', '默认关闭', '可信局域网', 'HTTP 明文', '查询图片', '原文件', '外部视觉 API', '采样帧', '对话和描述文字']) {
    assert.ok(privacy.includes(fact), `Missing privacy boundary: ${fact}`);
  }
  const descriptions = [...html.matchAll(/<meta\b[^>]*(?:name="description"|property="og:description"|name="twitter:description")[^>]*content="([^"]*)"/g)].map(match => match[1]);
  assert.equal(descriptions.length, 3);
  for (const text of descriptions) assert.ok(text.includes('局域网共享和外部模型按功能传输数据'));
  const schema = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.ok(descriptions.every(text => text === schema.description));
});

test('scene privacy distinguishes local processing, optional LAN sharing and external vision', () => {
  const html = read('docs/scenes/search-video-content/index.html');
  const section = html.match(/<h2>本机搜索与可选功能的数据边界<\/h2>([\s\S]*?)<h2>/)?.[1];
  assert.ok(section, 'Missing scoped privacy section');
  const faq = read('docs/content/faq.md');
  const manual = read('docs/content/manual.md');
  const localFact = '本机建库、搜索、分镜或转写不会向素刀公网服务上传原始素材。';
  const lanFact = '主动启用局域网共享并配对后，搜索词会发送给你选定的共享端；使用共享库的“以图搜图”时，你主动选择的查询图片也会发送至该共享端，临时查询文件在处理结束后清理。';
  const visionFact = '本地来源的图片在本机处理；外部来源每次发送一张图片、一个指定时间点的帧，或分镜最多三张采样帧给你配置的供应商；完整视频不会发送。';
  for (const fact of [localFact, lanFact]) {
    assert.ok(faq.includes(fact), 'Fact must exist in the FAQ source');
    assert.ok(section.includes(fact), `Missing scoped fact: ${fact}`);
  }
  assert.ok(manual.includes(visionFact), 'Fact must exist in the manual source');
  assert.ok(section.includes(visionFact));
  for (const fact of ['共享默认关闭', '已授权设备', '原文件', '不经素刀公网服务中转', '外部视觉 API', '不再逐次确认']) {
    assert.ok(section.includes(fact), `Missing optional-data boundary: ${fact}`);
  }
  for (const href of ['../../faq/', '../../manual/']) assert.ok(section.includes(`href="${href}"`));
  assert.doesNotMatch(html, /素材不出电脑|不搬家、不上传|任何数据都不离开电脑|CPU 也能跑/);
});

test('scene hardware text uses the FAQ distinction between basic CPU search and local vision', () => {
  const html = read('docs/scenes/search-video-content/index.html');
  const faq = read('docs/content/faq.md');
  const fact = faq.match(/## 素刀的本地 AI 需要什么样的硬件？\s+([^\r\n]+)/)?.[1];
  assert.ok(fact);
  assert.ok(html.includes(`<p>${fact}</p>`), 'Hardware paragraph must match its fact source');
  assert.doesNotMatch(html, /有支持 Vulkan 的显卡时自动加速/);
  assert.ok(html.includes('href="../../changelog/v2.4.0/"'));
});

test('scene social summary scopes data handling without adding performance claims', () => {
  const html = read('docs/scenes/search-video-content/index.html');
  const og = html.match(/<meta property="og:description" content="([^"]*)"\s*\/>/)?.[1];
  assert.ok(og);
  assert.ok(og.includes('本机建库与搜索在本机完成'));
  assert.ok(og.includes('共享与外部模型的数据范围按功能说明'));
  assert.doesNotMatch(og, /素材不出电脑|完全离线|永久免费|3\s*秒|8\.5T/);
});
