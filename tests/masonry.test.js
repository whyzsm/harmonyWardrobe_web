#!/usr/bin/env node
/* 验证瀑布流排布语义：ArkUI WaterFlow 按「最矮列」放置，
   视觉阅读顺序应为从左到右、从上到下，且卡片落在两列中高度均衡。 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.HW_TEST_PORT || 0) || 8893;
const DEBUG_PORT = Number(process.env.HW_TEST_DEBUG_PORT || 0) || 9393;
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
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-mas-'));
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

    /* 造 8 件衣物，名称带序号，便于校验顺序 */
    await cdp.eval(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width=60; canvas.height=80;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const photoId = await HW.PhotoStore.save(blob);
      for (let i = 1; i <= 8; i++) {
        await HW.ClothingRepository.createClothing({ name: 'ITEM-' + i, category: 'Top', photoUris: [photoId] });
      }
      return true;
    })()`);

    await cdp.eval(`HW.App.switchTab('wardrobe')`);
    await cdp.waitFor(`document.querySelectorAll('.wall-card').length >= 8`, 12000);
    await new Promise(r => setTimeout(r, 1200));  // 等待 rAF 排布完成

    const layout = await cdp.eval(`(() => {
      const cards = Array.from(document.querySelectorAll('.wall-card'));
      const cols = Array.from(document.querySelectorAll('.waterflow__column'));
      const items = cards.map(c => {
        const r = c.getBoundingClientRect();
        const t = (c.querySelector('.wall-card__title')||{}).textContent || '';
        return { title: t, x: Math.round(r.left), y: Math.round(r.top), h: Math.round(r.height), col: r.left < 250 ? 0 : 1 };
      });
      return {
        items,
        colHeights: cols.map(c => Math.round(c.getBoundingClientRect().height)),
        colCounts: cols.map(c => c.querySelectorAll('.wall-card').length),
        colLefts: cols.map(c => Math.round(c.getBoundingClientRect().left))
      };
    })()`);

    log('渲染出 8 张卡片', layout.items.length === 8, `n=${layout.items.length}`);
    log('卡片分布在两个独立列容器中', layout.colCounts.length === 2 && layout.colCounts[0] > 0 && layout.colCounts[1] > 0, JSON.stringify(layout.colCounts));
    log('两列左右不重叠', layout.colLefts[1] > layout.colLefts[0], JSON.stringify(layout.colLefts));

    /* ArkUI WaterFlow 语义：条目按「当前最矮的列」放置，
       因此列内条目必须保持数据序列的相对次序（子序列），
       而不是按 y 排序还原全局顺序。 */
    const orderCheck = await cdp.eval(`(async () => {
      const data = await HW.ClothingRepository.listClothing();
      const dataOrder = data.map(i => i.name);
      const cols = Array.from(document.querySelectorAll('.waterflow__column'));
      const colTitles = cols.map(c => Array.from(c.querySelectorAll('.wall-card__title')).map(t => t.textContent));
      // 高度必须按标题建索引：DOM 顺序是「先左列后右列」，与数据顺序不同
      const heightByTitle = {};
      Array.from(document.querySelectorAll('.wall-card')).forEach(c => {
        const t = (c.querySelector('.wall-card__title')||{}).textContent || '';
        heightByTitle[t] = Math.round(c.getBoundingClientRect().height);
      });

      // 每列必须是 dataOrder 的子序列
      function isSubsequence(sub, full) {
        let k = 0;
        for (const x of full) { if (k < sub.length && sub[k] === x) k++; }
        return k === sub.length;
      }

      // 模拟「最矮列」分配，与实际 DOM 落位对比
      const simulated = [[], []];
      const colH = [0, 0];
      dataOrder.forEach((name, i) => {
        let s = 0;
        for (let c = 1; c < 2; c++) if (colH[c] < colH[s]) s = c;
        simulated[s].push(name);
        colH[s] += (heightByTitle[name] || 0) + 8;
      });

      return {
        dataOrder,
        colTitles,
        subseqOk: colTitles.every(t => isSubsequence(t, dataOrder)),
        simulated,
        actual: colTitles
      };
    })()`);
    log('各列条目保持数据序列的相对次序（子序列）', orderCheck.subseqOk,
      JSON.stringify(orderCheck.colTitles));
    log('落位与「最矮列」分配策略一致', JSON.stringify(orderCheck.simulated) === JSON.stringify(orderCheck.actual),
      `sim=${JSON.stringify(orderCheck.simulated)} actual=${JSON.stringify(orderCheck.actual)}`);

    /* 高度均衡：两列高度差不应过大 */
    const diff = Math.abs(layout.colHeights[0] - layout.colHeights[1]);
    log('两列高度大致均衡（最短列策略生效）', diff < 160, `左=${layout.colHeights[0]} 右=${layout.colHeights[1]} 差=${diff}`);

    /* 卡片高度应有变化（瀑布流而非等高网格） */
    const heights = layout.items.map(i => i.h);
    log('卡片高度存在差异（真瀑布流）', Math.max(...heights) - Math.min(...heights) > 20,
      `min=${Math.min(...heights)} max=${Math.max(...heights)}`);

    /* 筛选后重排不残留旧卡片 */
    await cdp.eval(`(() => {
      const input = document.querySelector('.search-header__input');
      input.value = 'ITEM-3';
      input.dispatchEvent(new Event('input', {bubbles:true}));
    })()`);
    await new Promise(r => setTimeout(r, 900));
    const filtered = await cdp.eval(`(() => {
      const cards = Array.from(document.querySelectorAll('.wall-card'));
      const cols = Array.from(document.querySelectorAll('.waterflow__column'));
      return {
        total: cards.length,
        titles: cards.map(c=>(c.querySelector('.wall-card__title')||{}).textContent),
        colCounts: cols.map(c=>c.querySelectorAll('.wall-card').length)
      };
    })()`);
    log('筛选后仅保留匹配卡片', filtered.total === 1 && filtered.titles[0] === 'ITEM-3', JSON.stringify(filtered.titles));
    log('筛选后列容器未残留旧卡片', filtered.colCounts.reduce((a,b)=>a+b,0) === 1, JSON.stringify(filtered.colCounts));

    /* 清空筛选恢复全部 */
    await cdp.eval(`(() => {
      const input = document.querySelector('.search-header__input');
      input.value = '';
      input.dispatchEvent(new Event('input', {bubbles:true}));
    })()`);
    await new Promise(r => setTimeout(r, 900));
    const restored = await cdp.eval(`document.querySelectorAll('.wall-card').length`);
    log('清空筛选后恢复全部卡片', restored === 8, `n=${restored}`);

    /* 空态占位正确 */
    await cdp.eval(`(() => {
      const input = document.querySelector('.search-header__input');
      input.value = '绝不存在的关键词xyz';
      input.dispatchEvent(new Event('input', {bubbles:true}));
    })()`);
    await new Promise(r => setTimeout(r, 900));
    const emptyState = await cdp.eval(`(() => ({
      cards: document.querySelectorAll('.wall-card').length,
      emptyVisible: !!document.querySelector('.waterflow-empty .wall-empty'),
      flowHidden: getComputedStyle(document.querySelector('.waterflow')).display === 'none'
    }))()`);
    log('无匹配时显示空态且隐藏瀑布流', emptyState.cards === 0 && emptyState.emptyVisible && emptyState.flowHidden, JSON.stringify(emptyState));

  } catch (e) {
    console.log('异常: ' + e.message);
    results.push({ n: '执行', ok: false, d: e.message });
  } finally {
    const p = results.filter(r => r.ok).length, f = results.filter(r => !r.ok).length;
    console.log(`\n========== 瀑布流测试: ${p} 通过 / ${f} 失败 ==========`);
    results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.n}  ${r.d}`));
    try { chrome.kill(); } catch (e) {}
    server.close();
    process.exit(f ? 1 : 0);
  }
}
main();
