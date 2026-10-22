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
