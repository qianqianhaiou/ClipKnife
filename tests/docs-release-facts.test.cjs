'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const read = name => fs.readFileSync(path.join(__dirname, '..', 'docs', name), 'utf8');

test('current assistant instructions deliver editable drafts instead of desktop auto-export', () => {
  for (const name of ['content/faq.md', 'content/manual.md']) {
    const text = read(name);
    assert.match(text, /智能口播/);
    assert.match(text, /通用专家/);
    assert.match(text, /不提供成片导出/);
    assert.match(text, /在剪映中.*导出/);
    assert.doesNotMatch(text, /最长可能持续约 20 分钟|导出过程可能持续约 20 分钟|剪映草稿目录和导出目录|进入不可取消的导出阶段/);
  }
  const manual = read('content/manual.md');
  assert.match(manual, /## 12\. 专家与技能/);
  assert.doesNotMatch(manual, /等待你确认后写入本地 `SKILL\.md`|修改默认模型不会自动替换已经建立的会话配置/);
});

test('video-detail editing is limited to tags and remains distinct from clip export', () => {
  const faq = read('content/faq.md').split('## 分镜编辑会修改原始视频吗？')[1].split('\n## ')[0];
  const manual = read('content/manual.md').split('## 8. 视频详情与分镜')[1].split('\n## 9.')[0];
  for (const text of [faq, manual]) {
    assert.ok(text.includes('仅限分镜标签'), 'Current UI editing must be scoped to tags');
    assert.ok(text.includes('不提供备注、起止时间调整、合并、拆分或删除分镜操作'));
    assert.ok(text.includes('导出'));
  }
  assert.ok(read('content/manual.md').includes('### 批量视频拆分镜'));
});

test('functional FAQ schema answers match their complete source sections', () => {
  const html = read('faq/index.html');
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const source = read('content/faq.md').replace(/\r\n/g, '\n');
  for (const title of ['支持哪些素材类型？', '视频搜索是搜索整个视频吗？', '素刀的本地 AI 需要什么样的硬件？']) {
    const question = data.mainEntity.find(q => q.name === title);
    assert.ok(question, `Missing functional FAQ ${title}`);
    const heading = `## ${title}\n`;
    assert.ok(source.includes(heading));
    const answer = source.split(heading)[1].split('\n## ')[0].trim().replace(/`/g, '').replace(/\s+/g, '');
    assert.equal(question.acceptedAnswer.text.replace(/\s+/g, ''), answer);
  }
});

test('search scene provides reproducible steps and labels query examples without invented measurements', () => {
  const html = read('scenes/search-video-content/index.html');
  assert.ok(html.includes('适用版本：v2.3.0'));
  assert.ok(html.includes('描述方式示例，不是检索成功率测试'));
  assert.ok(html.includes('<ol>'));
  assert.ok(html.includes('先用一个素材目录走完搜索流程'));
  assert.ok(html.includes('只读素材共享'));
  assert.ok(!html.includes('单人工具，不做多人协作'));
  assert.ok(!html.includes('找出本地所有相似画面'));
});
