#!/usr/bin/env node
/* 衣不缺 Web 版 — 测试运行器
   依次执行各测试套件，汇总结果。
   用法：node tests/run-all.js            运行全部
        node tests/run-all.js smoke       只跑指定套件 */

const { spawn } = require('child_process');
const path = require('path');

const SUITES = [
  { name: 'smoke', file: 'smoke.test.js', desc: '功能冒烟：页面渲染、路由、增删改查、搜索、持久化' },
  { name: 'file', file: 'file-protocol.test.js', desc: 'file:// 直接打开：脚本加载、资源、IndexedDB、持久化' },
  { name: 'masonry', file: 'masonry.test.js', desc: '瀑布流排布：最矮列分配、筛选重排、空态切换' },
  { name: 'layout', file: 'layout.test.js', desc: '布局约束：画布固定、内部滚动、底部导航与保存条可见' }
];

async function run(suite) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, suite.file)], {
      stdio: 'inherit',
      env: process.env
    });
    child.on('exit', (code) => resolve(code === 0));
  });
}

(async () => {
  const filter = process.argv[2];
  const selected = filter
    ? SUITES.filter((s) => s.name === filter)
    : SUITES;

  if (selected.length === 0) {
    console.error('未知测试套件: ' + filter);
    console.error('可用: ' + SUITES.map((s) => s.name).join(', '));
    process.exit(2);
  }

  const summary = [];

  for (const suite of selected) {
    console.log('\n' + '='.repeat(64));
    console.log('▶ ' + suite.name + ' — ' + suite.desc);
    console.log('='.repeat(64));
    const ok = await run(suite);
    summary.push({ suite: suite.name, ok });
  }

  console.log('\n' + '='.repeat(64));
  console.log('汇总：');
  summary.forEach((s) => {
    console.log(`  ${s.ok ? '✓ 通过' : '✗ 失败'}  ${s.suite}`);
  });
  const failed = summary.filter((s) => !s.ok);
  console.log('='.repeat(64));
  console.log(
    failed.length === 0
      ? '全部测试套件通过。'
      : failed.length + ' 个套件失败。'
  );
  process.exit(failed.length === 0 ? 0 : 1);
})();
