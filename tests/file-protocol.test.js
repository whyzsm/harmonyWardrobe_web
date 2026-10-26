#!/usr/bin/env node
/* 衣不缺 Web 版 — file:// 直接打开验证
   模拟用户双击 index.html 的场景（无本地服务器）。 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_DIR = path.resolve(__dirname, '..');
const DEBUG_PORT = Number(process.env.HW_TEST_DEBUG_PORT || 0) || 9331;

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject);
  });
}
async function waitForChrome() {
  for (let i = 0; i < 60; i++) {
    try { const l = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`); if (l && l.length) return l; } catch (e) {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Chrome 未就绪');
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.logs = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const c = new CDP(ws);
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) { const { resolve, reject } = c.pending.get(m.id); c.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
      else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') c.logs.push(m.params.entry.text);
    });
    return c;
  }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000); }); }
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; }
  async waitFor(expression, timeoutMs = 12000) { const deadline = Date.now() + timeoutMs; while (Date.now() < deadline) { let v; try { v = await this.eval(expression); } catch (e) { v = false; } if (v) return v; await new Promise(r => setTimeout(r, 250)); } return false; }
}

async function main() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-file-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, '--window-size=430,900', 'about:blank'], { stdio: 'ignore' });
  const results = [];
  const log = (n, ok, d = '') => { results.push({ n, ok, d }); console.log(`${ok ? '  PASS' : '✗ FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

  try {
    const targets = await waitForChrome();
    const cdp = await CDP.connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `window.__errors=[];window.addEventListener('error',function(e){window.__errors.push('ERROR: '+(e.message||'')+' @ '+(e.filename||'').split('/').pop()+':'+(e.lineno||''))});window.addEventListener('unhandledrejection',function(e){window.__errors.push('REJECT: '+(e.reason&&e.reason.message?e.reason.message:String(e.reason)))})`
    });

    const fileUrl = 'file://' + path.join(APP_DIR, 'index.html');
    console.log('打开: ' + fileUrl + '\n');
    await cdp.send('Page.navigate', { url: fileUrl });

    const booted = await cdp.waitFor(`!!document.querySelector('.bottom-nav')`, 15000);
    log('file:// 下应用正常启动', !!booted);
    if (!booted) {
      const err = await cdp.eval('JSON.stringify(window.__errors || [])');
      const body = await cdp.eval('document.body.innerText.slice(0,300)');
      console.log('  errors: ' + err);
      console.log('  body: ' + body);
    }

    /* 资源是否加载成功（CSS/图片） */
    const assets = await cdp.eval(`(async () => {
      const css = getComputedStyle(document.querySelector('.bottom-nav')).borderRadius;
      const cover = await new Promise(r => {
        const img = new Image();
        img.onload = () => r('LOADED:' + img.naturalWidth + 'x' + img.naturalHeight);
        img.onerror = () => r('FAILED');
        img.src = 'assets/default_fashion_cover.jpg';
      });
      const icons = document.querySelectorAll('svg.icon').length;
      return { css, cover, icons };
    })()`);
    log('CSS 正常应用（底��导航圆角来自样式表）', assets.css === '28px', assets.css);
    log('本地图片资源可加载', assets.cover.startsWith('LOADED'), assets.cover);
    log('SVG 图标已渲染', assets.icons > 0, `icons=${assets.icons}`);

    /* IndexedDB 在 file:// 下可用 */
    const db = await cdp.eval(`(async () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width=4; canvas.height=4;
        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const photoId = await HW.PhotoStore.save(blob);
        const clothing = await HW.ClothingRepository.createClothing({ name:'file协议测试', category:'Top', photoUris:[photoId] });
        const list = await HW.ClothingRepository.listClothing();
        const photos = await HW.PhotoStore.summary();
        return { ok: true, listCount: list.length, photos: photos.photoCount, name: list[0] && list[0].name };
      } catch(e) { return { ok:false, error: e.message }; }
    })()`);
    log('file:// 下 IndexedDB 可写可读', db.ok && db.listCount === 1, JSON.stringify(db));

    /* 数据在 file:// 下跨刷新持久化 */
    await cdp.send('Page.navigate', { url: fileUrl });
    await cdp.waitFor(`!!document.querySelector('.bottom-nav')`, 15000);
    const persisted = await cdp.eval(`(async () => {
      const list = await HW.ClothingRepository.listClothing();
      const photos = await HW.PhotoStore.summary();
      return { count: list.length, photos: photos.photoCount };
    })()`);
    log('file:// 下刷新后数据持久化', persisted.count === 1 && persisted.photos === 1, JSON.stringify(persisted));

    /* 各 Tab 切换 */
    for (const tab of ['wardrobe', 'store', 'outfit', 'profile']) {
      await cdp.eval(`HW.App.switchTab('${tab}')`);
      const ok = await cdp.waitFor(`!!document.querySelector('.bottom-nav') && document.body.innerText.length > 20`, 8000);
      log(`file:// 下切换到「${tab}」Tab 正常`, !!ok);
    }

    const errors = await cdp.eval('JSON.stringify(window.__errors || [])');
    log('file:// 下无未捕获 JS 错误', errors === '[]', errors);
    log('file:// 下控制台无错误日志', cdp.logs.length === 0, cdp.logs.join(' | '));

  } catch (e) {
    console.log('FILE 测试异常: ' + e.message);
    results.push({ n: 'file:// 测试', ok: false, d: e.message });
  } finally {
    const passed = results.filter(r => r.ok).length, failed = results.filter(r => !r.ok).length;
    console.log(`\n========== file:// 结果: ${passed} 通过 / ${failed} 失败 ==========`);
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.n}  ${r.d}`));
    try { chrome.kill(); } catch (e) {}
    process.exit(failed ? 1 : 0);
  }
}
main();
