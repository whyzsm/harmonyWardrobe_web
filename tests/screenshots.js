#!/usr/bin/env node
/* 衣不缺 Web 版 — 截图脚本：渲染各页面并输出 PNG 供人工核对 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.resolve(__dirname, '..', '.screenshots');
const PORT = Number(process.env.HW_TEST_PORT || 0) || 8894;
const DEBUG_PORT = Number(process.env.HW_TEST_DEBUG_PORT || 0) || 9330;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const fp = path.join(APP_DIR, path.normalize(rel === '/' ? '/index.html' : rel));
      if (!fp.startsWith(APP_DIR) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}
function fetchJson(url) { return new Promise((resolve, reject) => { http.get(url, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } }); }).on('error', reject); }); }
async function waitForChrome() { for (let i = 0; i < 60; i++) { try { const l = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`); if (l && l.length) return l; } catch (e) {} await new Promise(r => setTimeout(r, 500)); } throw new Error('no chrome'); }
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); }
  static async connect(url) { const ws = new WebSocket(url); await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); }); const c = new CDP(ws); ws.addEventListener('message', ev => { const m = JSON.parse(ev.data); if (m.id && c.pending.has(m.id)) { const { resolve, reject } = c.pending.get(m.id); c.pending.delete(m.id); m.error ? reject(new Error(m.error.message)) : resolve(m.result); } }); return c; }
  send(method, params = {}) { const id = ++this.id; return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('timeout ' + method)); } }, 30000); }); }
  async eval(expression) { const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; }
  async waitFor(expression, timeoutMs = 12000) { const deadline = Date.now() + timeoutMs; while (Date.now() < deadline) { let v; try { v = await this.eval(expression); } catch (e) { v = false; } if (v) return v; await new Promise(r => setTimeout(r, 250)); } return false; }
  async shot(file) {
    const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
  }
}

/* 生成一张有辨识度的测试照片（渐变 + 文字），便于视觉核对 */
const SEED_SCRIPT = `(async () => {
  function makePhoto(label, c1, c2) {
    const canvas = document.createElement('canvas');
    canvas.width = 480; canvas.height = 640;
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 480, 640);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 480, 640);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = 'bold 56px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 240, 340);
    return new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
  }
  const p1 = await HW.PhotoStore.save(await makePhoto('白衬衫', '#8FA9C9', '#3E5C82'));
  const p2 = await HW.PhotoStore.save(await makePhoto('通勤穿搭', '#E8B4A0', '#9C5F4A'));
  const p3 = await HW.PhotoStore.save(await makePhoto('静安嘉里', '#B8C4A9', '#5E7052'));
  const p4 = await HW.PhotoStore.save(await makePhoto('羊毛大衣', '#C9BFA9', '#7A6A4F'));
  const c1 = await HW.ClothingRepository.createClothing({ name:'白色棉质衬衫', category:'Top', photoUris:[p1], note:'面试常穿', purchaseInfo:{ storeName:'优衣库', price:199, purchaseDate:'2026-08-01' } });
  const c2 = await HW.ClothingRepository.createClothing({ name:'深色直筒西裤', category:'Pants', photoUris:[p2], note:'通勤搭配' });
  const c3 = await HW.ClothingRepository.createClothing({ name:'米色风衣', category:'LongSkirt', photoUris:[p4] });
  await HW.OutfitRepository.createOutfit({ title:'通勤基础搭配', photoUris:[p2], clothingItemIds:[c1.id, c2.id], categoryNames:['通勤','基础'] });
  await HW.StoreRepository.createStoreVisitWithOptionalStore({ storeName:'静安嘉里 COS', storeNameSnapshot:'静安嘉里 COS', districtOrAddress:'静安寺 · 二楼女装区', visitDate: HW.utils.todayIsoDate(), photoUris:[p3], status:'visited', focusTags:['试穿','想回看'] });
  await HW.WishlistRepository.createWishlistItem({ title:'驼色羊毛大衣', storeName:'优衣库', price:799, photoUris:[p4], note:'等换季' });
  await HW.ProfileRepository.saveProfile({ heightCm:175, weightKg:65, waistCm:78, upperSize:'M', lowerSize:'28', shoeSize:'40', frequentDistricts:['静安寺','安福路'], monthlyBudget:3000, commonBudgets:[2400,3200,4000] });
  return true;
})()`;

const SHOTS = [
  { name: '01-outfit-tab', setup: `HW.App.switchTab('outfit')`, wait: `document.querySelectorAll('.wall-card').length > 0` },
  { name: '02-wardrobe-tab', setup: `HW.App.switchTab('wardrobe')`, wait: `document.querySelectorAll('.wall-card').length > 0` },
  { name: '03-store-tab', setup: `HW.App.switchTab('store')`, wait: `document.querySelectorAll('.wall-card').length > 0` },
  { name: '04-profile-tab', setup: `HW.App.switchTab('profile')`, wait: `!!document.querySelector('.profile-hero')` },
  { name: '05-clothing-detail', setup: `(async()=>{const c=(await HW.ClothingRepository.listClothing())[0];HW.App.navigate(HW.App.RouteKind.ClothingDetail,'wardrobe',{clothingId:c.id})})()`, wait: `!!document.querySelector('.hero-photo')` },
  { name: '06-clothing-editor', setup: `(async()=>{const c=(await HW.ClothingRepository.listClothing())[0];HW.App.navigate(HW.App.RouteKind.ClothingEditor,'wardrobe',{clothingId:c.id})})()`, wait: `!!document.querySelector('.name-card__input')` },
  { name: '07-outfit-editor-photo', setup: `HW.App.navigate(HW.App.RouteKind.OutfitEditor,'outfit',{})`, wait: `document.body.innerText.includes('上传这套穿搭照片')` },
  { name: '08-outfit-editor-wardrobe', setup: `HW.App.navigate(HW.App.RouteKind.OutfitEditor,'outfit',{});setTimeout(()=>{const segs=document.querySelectorAll('.seg');if(segs[1])segs[1].click();},500)`, wait: `document.body.innerText.includes('选择衣柜单品')` },
  { name: '09-store-editor', setup: `HW.App.navigate(HW.App.RouteKind.StoreEditor,'store',{})`, wait: `document.body.innerText.includes('逛店状态')` },
  { name: '10-quick-capture', setup: `HW.App.switchTab('outfit');setTimeout(()=>HW.App.openQuickCapture(),400)`, wait: `!!document.querySelector('.sheet-backdrop')` },
  { name: '11-search', setup: `HW.App.navigate(HW.App.RouteKind.Search,'wardrobe',{query:'通勤'})`, wait: `document.querySelectorAll('.result-card').length > 0` },
  { name: '12-wishlist', setup: `HW.App.navigate(HW.App.RouteKind.Wishlist,'profile',{})`, wait: `document.body.innerText.includes('羊毛大衣')` }
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-shot-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, '--window-size=360,996', '--force-device-scale-factor=2', 'about:blank'], { stdio: 'ignore' });

  try {
    const targets = await waitForChrome();
    const cdp = await CDP.connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 996, deviceScaleFactor: 2, mobile: true });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await cdp.waitFor(`!!document.querySelector('.bottom-nav')`, 15000);

    await cdp.eval(SEED_SCRIPT);
    await new Promise(r => setTimeout(r, 800));

    for (const shot of SHOTS) {
      await cdp.eval(shot.setup);
      const ok = await cdp.waitFor(shot.wait, 10000);
      await new Promise(r => setTimeout(r, 700));
      await cdp.shot(path.join(OUT_DIR, shot.name + '.png'));
      console.log(`${ok ? '  OK ' : '  ?  '} ${shot.name}.png`);
    }
    console.log('\n输出目录: ' + OUT_DIR);
  } catch (e) {
    console.log('截图异常: ' + e.message);
  } finally {
    try { chrome.kill(); } catch (e) {}
    server.close();
  }
}
main();
