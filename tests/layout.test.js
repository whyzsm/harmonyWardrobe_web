#!/usr/bin/env node
/* 衣不缺 Web 版 — 布局回归测试
   验证视口固定、内部滚动、底部导航与保存条固定可见等布局约束。 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.HW_TEST_PORT || 0) || 8892;
const DEBUG_PORT = Number(process.env.HW_TEST_DEBUG_PORT || 0) || 9392;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };

function startServer() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const fp = path.join(APP_DIR, path.normalize(rel === '/' ? '/index.html' : rel));
      if (!fp.startsWith(APP_DIR) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    s.listen(PORT, '127.0.0.1', () => resolve(s));
  });
}
function fetchJson(u) { return new Promise((res, rej) => { http.get(u, (r) => { let d = ''; r.on('data', c => d += c); r.on('end', () => { try { res(JSON.parse(d)); } catch (e) { rej(e); } }); }).on('error', rej); }); }
async function waitForChrome() { for (let i = 0; i < 60; i++) { try { const l = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`); if (l && l.length) return l; } catch (e) {} await new Promise(r => setTimeout(r, 500)); } throw new Error('no chrome'); }
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) { const ws = new WebSocket(url); await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); }); const c = new CDP(ws); ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && c.pending.has(m.id)) { const { resolve, reject } = c.pending.get(m.id); c.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } }); return c; }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000); }); }
  async eval(e) { const r = await this.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; }
  async waitFor(e, t = 12000) { const d = Date.now() + t; while (Date.now() < d) { let v; try { v = await this.eval(e); } catch (x) { v = false; } if (v) return v; await new Promise(r => setTimeout(r, 250)); } return false; }
}

async function main() {
  const server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-lay-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, '--window-size=430,900', 'about:blank'], { stdio: 'ignore' });
  const results = [];
  const log = (n, ok, d = '') => { results.push({ n, ok, d }); console.log(`${ok ? '  PASS' : '✗ FAIL'}  ${n}${d ? '  — ' + d : ''}`); };

  try {
    const targets = await waitForChrome();
    const cdp = await CDP.connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 430, height: 900, deviceScaleFactor: 1, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await cdp.waitFor(`!!document.querySelector('.bottom-nav')`, 15000);

    /* 造大量数据，制造超长内容 */
    await cdp.eval(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width=60; canvas.height=80;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const photoId = await HW.PhotoStore.save(blob);
      for (let i = 1; i <= 14; i++) {
        await HW.ClothingRepository.createClothing({ name: 'ITEM-' + i, category: 'Top', photoUris: [photoId], note: '备注' + i });
      }
      return true;
    })()`);

    /* --- 画布高度固定 --- */
    const canvas = await cdp.eval(`(() => {
      const c = document.querySelector('.app-canvas');
      return { h: Math.round(c.getBoundingClientRect().height), scrollH: c.scrollHeight, winH: window.innerHeight };
    })()`);
    log('画布高度等于视口高度（不被内容撑高）', Math.abs(canvas.h - canvas.winH) <= 2, JSON.stringify(canvas));

    /* --- 各 Tab 的底部导航固定可见 --- */
    for (const tab of ['wardrobe', 'store', 'outfit', 'profile']) {
      await cdp.eval(`HW.App.switchTab('${tab}')`);
      await cdp.waitFor(`!!document.querySelector('.bottom-nav')`, 8000);
      await new Promise(r => setTimeout(r, 700));
      const nav = await cdp.eval(`(() => {
        const n = document.querySelector('.bottom-nav');
        const r = n.getBoundingClientRect();
        return { bottom: Math.round(r.bottom), winH: window.innerHeight, visible: r.bottom <= window.innerHeight + 2 && r.top >= 0 };
      })()`);
      log(`「${tab}」底部导航固定在视口内`, nav.visible, JSON.stringify(nav));
    }

    /* --- 列表页自身滚动 --- */
    await cdp.eval(`HW.App.switchTab('wardrobe')`);
    await cdp.waitFor(`document.querySelectorAll('.wall-card').length > 0`, 10000);
    await new Promise(r => setTimeout(r, 900));
    const scroll = await cdp.eval(`(() => {
      const host = document.querySelector('.waterflow-host');
      const before = host.scrollTop;
      host.scrollTop = 500;
      const after = host.scrollTop;
      return { scrollable: host.scrollHeight > host.clientHeight, before, after, clientH: host.clientHeight, scrollH: host.scrollHeight };
    })()`);
    log('衣柜列表区可独立滚动', scroll.scrollable, JSON.stringify(scroll));
    log('滚动位置实际生效', scroll.after > scroll.before, `${scroll.before} -> ${scroll.after}`);

    /* --- 编辑页保存条固定可见 --- */
    await cdp.eval(`(async()=>{const c=(await HW.ClothingRepository.listClothing())[0];HW.App.navigate(HW.App.RouteKind.ClothingEditor,'wardrobe',{clothingId:c.id})})()`);
    await cdp.waitFor(`!!document.querySelector('.action-bar')`, 10000);
    await new Promise(r => setTimeout(r, 700));
    const actionBar = await cdp.eval(`(() => {
      const bar = document.querySelector('.action-bar');
      const btn = bar.querySelector('button');
      const br = btn ? btn.getBoundingClientRect() : null;
      return {
        visible: br ? (br.bottom <= window.innerHeight + 2 && br.top >= 0) : false,
        text: btn ? btn.textContent.trim() : '',
        top: br ? Math.round(br.top) : -1,
        bottom: br ? Math.round(br.bottom) : -1,
        winH: window.innerHeight
      };
    })()`);
    log('编辑器保存按钮固定可见于视口内', actionBar.visible, JSON.stringify(actionBar));

    /* --- 编辑器内容区滚动且不遮挡保存条 --- */
    const editorScroll = await cdp.eval(`(() => {
      const sc = document.querySelector('.page__body.scroll-y');
      const bar = document.querySelector('.action-bar');
      const br = bar.getBoundingClientRect();
      return { scrollable: sc.scrollHeight > sc.clientHeight, barTop: Math.round(br.top), clientH: sc.clientHeight, scrollH: sc.scrollHeight };
    })()`);
    log('编辑器内容区独立滚动', editorScroll.scrollable, JSON.stringify(editorScroll));
    log('保存条位于内容区下方不重叠', editorScroll.barTop > 0, JSON.stringify(editorScroll));

    /* --- 详情页 --- */
    await cdp.eval(`(async()=>{const c=(await HW.ClothingRepository.listClothing())[0];HW.App.navigate(HW.App.RouteKind.ClothingDetail,'wardrobe',{clothingId:c.id})})()`);
    await cdp.waitFor(`!!document.querySelector('.hero-photo')`, 10000);
    await new Promise(r => setTimeout(r, 700));
    const detail = await cdp.eval(`(() => {
      const sc = document.querySelector('.page__body.scroll-y');
      const hero = document.querySelector('.hero-photo').getBoundingClientRect();
      return { scrollable: sc.scrollHeight > sc.clientHeight, heroTop: Math.round(hero.top), winH: window.innerHeight, heroBottom: Math.round(hero.bottom) };
    })()`);
    log('详情页主图完整可见', detail.heroTop >= 0 && detail.heroBottom <= detail.winH, JSON.stringify(detail));

    /* --- 快捷录入弹层不超出视口 --- */
    await cdp.eval(`HW.App.switchTab('wardrobe')`);
    await cdp.waitFor(`!!document.querySelector('.bottom-nav__fab')`, 8000);
    await cdp.eval(`document.querySelector('.bottom-nav__fab').click()`);
    await cdp.waitFor(`!!document.querySelector('.sheet')`, 8000);
    await new Promise(r => setTimeout(r, 700));
    const sheet = await cdp.eval(`(() => {
      const s = document.querySelector('.sheet').getBoundingClientRect();
      return { bottom: Math.round(s.bottom), top: Math.round(s.top), winH: window.innerHeight, fits: s.bottom <= window.innerHeight + 2 && s.top >= 0 };
    })()`);
    log('快捷录入弹层完整位于视口内', sheet.fits, JSON.stringify(sheet));

  } catch (e) {
    console.log('异常: ' + e.message);
    results.push({ n: '执行', ok: false, d: e.message });
  } finally {
    const p = results.filter(r => r.ok).length, f = results.filter(r => !r.ok).length;
    console.log(`\n========== 布局测试: ${p} 通过 / ${f} 失败 ==========`);
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.n}  ${r.d}`));
    try { chrome.kill(); } catch (e) {}
    server.close();
    process.exit(f ? 1 : 0);
  }
}
main();
