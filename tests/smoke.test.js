#!/usr/bin/env node
/* 衣不缺 Web 版 — 无头浏览器冒烟测试 v2
   使用轮询等待代替固定 sleep，断言读取真实 DOM 值（含 input.value）。 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const APP_DIR = path.resolve(__dirname, '..');
const PORT = Number(process.env.HW_TEST_PORT || 0) || 8895;
const DEBUG_PORT = Number(process.env.HW_TEST_DEBUG_PORT || 0) || 9395;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(APP_DIR, path.normalize(rel === '/' ? '/index.html' : rel));
      if (!filePath.startsWith(APP_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('nf'); return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}
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
  throw new Error('Chrome 调试端口未就绪');
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.logs = []; }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
    const c = new CDP(ws);
    ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.pending.has(m.id)) {
        const { resolve, reject } = c.pending.get(m.id); c.pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
        c.logs.push(m.params.entry.text);
      }
    });
    return c;
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); } }, 30000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('EVAL: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  }
  /** 轮询直到表达式返回真值 */
  async waitFor(expression, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      let value;
      try { value = await this.eval(expression); } catch (e) { value = false; }
      if (value) return value;
      await new Promise(r => setTimeout(r, 200));
    }
    return false;
  }
}

async function main() {
  const server = await startServer();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'hw-chrome-'));
  const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${DEBUG_PORT}`, `--user-data-dir=${profile}`, '--window-size=430,900', 'about:blank'], { stdio: 'ignore' });

  const results = [];
  const log = (name, ok, detail = '') => {
    results.push({ name, ok, detail });
    console.log(`${ok ? '  PASS' : '✗ FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
  };

  try {
    const targets = await waitForChrome();
    const cdp = await CDP.connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Log.enable');

    /* 注入错误收集器 */
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        window.__errors = [];
        window.addEventListener('error', function(e){ window.__errors.push('ERROR: ' + (e.message||'') + ' @ ' + (e.filename||'').split('/').pop() + ':' + (e.lineno||'')); });
        window.addEventListener('unhandledrejection', function(e){ window.__errors.push('REJECT: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason))); });
      `
    });

    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    const booted = await cdp.waitFor(`!!document.querySelector('.bottom-nav')`, 10000);
    log('应用启动并渲染底部导航', !!booted);

    const nav = await cdp.eval(`Array.from(document.querySelectorAll('.bottom-nav__label')).map(n => n.textContent)`);
    log('底部导航顺序为 穿搭/衣柜/逛街/我的', JSON.stringify(nav) === JSON.stringify(['穿搭', '衣柜', '逛街', '我的']), JSON.stringify(nav));
    log('默认进入穿搭 Tab', await cdp.eval(`!!document.querySelector('.guide-card')`));

    /* ---- 造数据（含购买信息，用于验证详情页条件渲染） ---- */
    const seeded = await cdp.eval(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width=4; canvas.height=4;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const photoId = await HW.PhotoStore.save(blob);
      const clothing = await HW.ClothingRepository.createClothing({
        name: '测试白衬衫', category: 'Top', photoUris: [photoId], note: '面试穿',
        purchaseInfo: { storeName: '优衣库', price: 199, purchaseDate: '2026-08-01', note: '打折买的' }
      });
      const outfit = await HW.OutfitRepository.createOutfit({
        title: '通勤穿搭', photoUris: [photoId], clothingItemIds: [clothing.id], categoryNames: ['通勤']
      });
      const visit = await HW.StoreRepository.createStoreVisitWithOptionalStore({
        storeName: '静安嘉里 COS', storeNameSnapshot: '静安嘉里 COS',
        districtOrAddress: '静安寺', visitDate: HW.utils.todayIsoDate(),
        photoUris: [photoId], status: 'visited', focusTags: ['试穿'], note: '二楼的针织不错'
      });
      const wish = await HW.WishlistRepository.createWishlistItem({
        title: '羊毛大衣', storeName: '优衣库', price: 799, photoUris: [photoId], note: '驼色'
      });
      const wearLog = await HW.WearLogRepository.createWearLog({
        outfitTemplateId: outfit.id, wornDate: HW.utils.todayIsoDate(), photoUris: [photoId], placeText: '公司'
      });
      await HW.ProfileRepository.saveProfile({
        heightCm: 175, weightKg: 65, waistCm: 78, upperSize: 'M', lowerSize: '28',
        shoeSize: '40', frequentDistricts: ['静安寺'], monthlyBudget: 3000, commonBudgets: [2400, 3200]
      });
      return { clothingId: clothing.id, outfitId: outfit.id, visitId: visit.id, wishId: wish.id, wearLogId: wearLog.id, photoId };
    })()`);
    log('仓储层写入六类数据', !!(seeded.clothingId && seeded.outfitId && seeded.visitId && seeded.wishId && seeded.wearLogId));

    /* ---- 搜索索引 ---- */
    const search = await cdp.eval(`(async () => ({
      r1: (await HW.SearchRepository.search('通勤', 100)).length,
      r2: (await HW.SearchRepository.search('静安', 100)).length,
      r3: (await HW.SearchRepository.search('衬衫', 100)).length,
      r4: (await HW.SearchRepository.search('不存在的东西xyz', 100)).length
    }))()`);
    log('搜索命中「通勤」', search.r1 > 0, `n=${search.r1}`);
    log('搜索命中「静安」（门店名）', search.r2 > 0, `n=${search.r2}`);
    log('搜索命中「衬衫」（衣物名）', search.r3 > 0, `n=${search.r3}`);
    log('无关词不误命中', search.r4 === 0, `n=${search.r4}`);

    /* ---- 衣柜 Tab ---- */
    await cdp.eval(`HW.App.switchTab('wardrobe')`);
    const wardOk = await cdp.waitFor(`document.querySelectorAll('.wall-card').length > 0`);
    const ward = await cdp.eval(`(() => ({
      cards: document.querySelectorAll('.wall-card').length,
      chips: Array.from(document.querySelectorAll('.chip-tab')).map(c=>c.textContent.trim()),
      text: document.body.innerText
    }))()`);
    log('衣柜 Tab 渲染图片墙卡片', ward.cards > 0, `cards=${ward.cards}`);
    log('衣柜分类筛选项为 全部/上衣/裤装/裙装', JSON.stringify(ward.chips) === JSON.stringify(['全部','上衣','裤装','裙装']), JSON.stringify(ward.chips));
    log('衣柜卡片显示备注作为副标题', ward.text.includes('面试穿'), ward.text.slice(0, 120).replace(/\n/g, '/'));

    /* ---- 衣物详情 ---- */
    await cdp.eval(`HW.App.navigate(HW.App.RouteKind.ClothingDetail, 'wardrobe', { clothingId: '${seeded.clothingId}' })`);
    const detailOk = await cdp.waitFor(`!!document.querySelector('.hero-photo')`);
    const detail = await cdp.eval(`(() => ({
      text: document.body.innerText,
      hasNav: !!document.querySelector('.bottom-nav'),
      hasHero: !!document.querySelector('.hero-photo'),
      hasPurchase: document.body.innerText.includes('购买信息'),
      hasRecord: document.body.innerText.includes('记录信息'),
      hasPrice: document.body.innerText.includes('¥199.00'),
      hasStore: document.body.innerText.includes('优衣库')
    }))()`);
    log('衣物详情页渲染主图', detail.hasHero);
    log('详情页隐藏底部导航', !detail.hasNav);
    log('详情页渲染购买信息卡', detail.hasPurchase);
    log('详情页渲染记录信息卡', detail.hasRecord);
    log('详情页价格格式化为 ¥199.00', detail.hasPrice);
    log('详情页显示购买门店', detail.hasStore);

    /* ---- 衣物编辑器（回填） ---- */
    await cdp.eval(`HW.App.navigate(HW.App.RouteKind.ClothingEditor, 'wardrobe', { clothingId: '${seeded.clothingId}' })`);
    const editorOk = await cdp.waitFor(`!!Array.from(document.querySelectorAll('input')).find(i=>i.value === '测试白衬衫')`);
    const editor = await cdp.eval(`(() => {
      const inputs = Array.from(document.querySelectorAll('input'));
      const nameInput = inputs.find(i => i.getAttribute('aria-label') === '衣物名称');
      const storeInput = inputs.find(i => i.getAttribute('aria-label') === '购买门店');
      const chips = Array.from(document.querySelectorAll('.chip-opt')).map(c=>c.textContent.trim());
      const noteArea = document.querySelector('textarea');
      return {
        title: document.querySelector('.top-bar__title--center')?.textContent,
        name: nameInput ? nameInput.value : null,
        store: storeInput ? storeInput.value : null,
        note: noteArea ? noteArea.value : null,
        chips: chips,
        hasSaveBtn: Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='保存衣物')
      };
    })()`);
    log('衣物编辑器标题为「编辑衣物」', editor.title === '编辑衣物', String(editor.title));
    log('编辑器回填衣物名称', editor.name === '测试白衬衫', String(editor.name));
    log('编辑器回填购买门店', editor.store === '优衣库', String(editor.store));
    log('编辑器回填备注', editor.note === '面试穿', String(editor.note));
    log('编辑器分类含长裙且不含半裙（新数据）', editor.chips.includes('长裙') && !editor.chips.includes('半裙'), JSON.stringify(editor.chips));
    log('编辑器提供保存按钮', editor.hasSaveBtn);

    /* ---- 穿搭 Tab ---- */
    await cdp.eval(`HW.App.switchTab('outfit')`);
    const outfitOk = await cdp.waitFor(`document.querySelectorAll('.wall-card').length > 0`);
    const outfits = await cdp.eval(`(() => ({
      cards: document.querySelectorAll('.wall-card').length,
      chips: Array.from(document.querySelectorAll('.chip-filter')).map(c=>c.textContent.trim()),
      text: document.body.innerText
    }))()`);
    log('穿搭 Tab 渲染图片墙卡片', outfits.cards > 0, `cards=${outfits.cards}`);
    log('穿搭分类含「全部」与「通勤」', outfits.chips.includes('全部') && outfits.chips.includes('通勤'), JSON.stringify(outfits.chips));
    log('穿搭卡片显示分类与单品数', outfits.text.includes('通勤') && outfits.text.includes('1 件单品'), outfits.text.slice(0,150).replace(/\n/g,'/'));

    /* ---- 逛店 Tab ---- */
    await cdp.eval(`HW.App.switchTab('store')`);
    const storeOk = await cdp.waitFor(`document.querySelectorAll('.wall-card').length > 0`);
    const store = await cdp.eval(`(() => ({
      cards: document.querySelectorAll('.wall-card').length,
      statusChips: Array.from(document.querySelectorAll('.chip-status-filter')).map(c=>c.textContent.trim()),
      text: document.body.innerText
    }))()`);
    log('逛街 Tab 渲染图片墙卡片', store.cards > 0, `cards=${store.cards}`);
    log('逛街状态筛选项为 全部/去过/想去', JSON.stringify(store.statusChips) === JSON.stringify(['全部','去过','想去']), JSON.stringify(store.statusChips));
    log('逛街卡片显示门店名与状态徽标', store.text.includes('静安嘉里') && store.text.includes('已去'), store.text.slice(0,150).replace(/\n/g,'/'));

    /* ---- 逛店详情 ---- */
    await cdp.eval(`HW.App.navigate(HW.App.RouteKind.StoreVisitDetail, 'store', { storeVisitId: '${seeded.visitId}' })`);
    const visitOk = await cdp.waitFor(`!!document.querySelector('.hero-photo')`);
    const visitDetail = await cdp.eval(`(() => ({
      text: document.body.innerText,
      hasPurchase: false,
      hasRecord: false,
      hasDistrict: document.body.innerText.includes('静安寺'),
      hasTags: document.body.innerText.includes('试穿')
    }))()`);
    log('逛店详情页渲染', visitOk);
    log('逛店详情显示商圈与标签', visitDetail.hasDistrict && visitDetail.hasTags);

    /* ---- 我的 Tab ---- */
    await cdp.eval(`HW.App.switchTab('profile')`);
    const profileOk = await cdp.waitFor(`!!document.querySelector('.profile-hero')`);
    const profile = await cdp.eval(`(() => ({
      text: document.body.innerText,
      stats: Array.from(document.querySelectorAll('.stat-item')).map(s => s.innerText.replace(/\\n/g,' '))
    }))()`);
    log('我的 Tab 渲染档案页', profileOk);
    log('统计项为 单品/逛店/搭配 三项', profile.stats.length === 3, JSON.stringify(profile.stats));
    log('档案展示尺码摘要', profile.text.includes('上衣 M'), '');
    log('档案展示预算区', profile.text.includes('预算提醒') && profile.text.includes('¥3,000'), '');
    log('档案展示数据迁移入口', profile.text.includes('导出本地备份') && profile.text.includes('导入本地备份'));

    /* ---- 尺码编辑 Sheet ---- */
    await cdp.eval(`document.querySelectorAll('.preference-row .btn--outline-pill')[0].click()`);
    const sheetOk = await cdp.waitFor(`!!document.querySelector('.sheet-backdrop')`);
    const sheetText = await cdp.eval(`document.querySelector('.sheet') ? document.querySelector('.sheet').innerText : ''`);
    log('尺码编辑弹层打开', sheetOk);
    log('尺码弹层含身高/体重/腰围与衣物尺码', sheetText.includes('身高') && sheetText.includes('体重') && sheetText.includes('腰围') && sheetText.includes('上衣'), sheetText.replace(/\n/g, '/'));
    await cdp.eval(`document.querySelector('.sheet__cancel').click()`);
    await new Promise(r => setTimeout(r, 400));

    /* ---- 统一搜索 ---- */
    await cdp.eval(`HW.App.navigate(HW.App.RouteKind.Search, 'wardrobe', { query: '通勤' })`);
    const searchOk = await cdp.waitFor(`document.querySelectorAll('.result-card').length > 0`);
    const searchPage = await cdp.eval(`(() => ({
      results: document.querySelectorAll('.result-card').length,
      scopes: Array.from(document.querySelectorAll('.scope-tab__label')).map(s=>s.textContent),
      badges: Array.from(document.querySelectorAll('.result-card__badge')).map(b=>b.textContent)
    }))()`);
    log('统一搜索页渲染结果', searchOk, `results=${searchPage.results}`);
    log('搜索页范围标签为 全部/衣柜/逛店/穿搭', JSON.stringify(searchPage.scopes) === JSON.stringify(['全部','衣柜','逛店','穿搭']), JSON.stringify(searchPage.scopes));
    log('搜索结果带类型徽标', searchPage.badges.length > 0, JSON.stringify(searchPage.badges));

    /* ---- 空搜索：默认词 ---- */
    await cdp.eval(`HW.App.navigate(HW.App.RouteKind.Search, 'wardrobe', { query: '' })`);
    await new Promise(r => setTimeout(r, 500));
    const idle = await cdp.eval(`document.body.innerText.includes('历史记录')`);
    log('搜索页空态显示历史记录', idle);

    /* ---- 心愿清单 ---- */
    await cdp.eval(`HW.App.navigate(HW.App.RouteKind.Wishlist, 'profile', {})`);
    const wishOk = await cdp.waitFor(`document.body.innerText.includes('羊毛大衣')`);
    const wishlist = await cdp.eval(`(() => ({
      text: document.body.innerText,
      cards: document.querySelectorAll('.list-row').length
    }))()`);
    log('心愿清单页渲染条目', wishlist.cards > 0 && wishlist.text.includes('羊毛大衣'), `cards=${wishlist.cards}`);
    log('心愿条目显示门店与价格', wishlist.text.includes('优衣库') && wishlist.text.includes('¥799.00'), '');

    /* ---- 我的 Tab → 心愿清单入口（鸿蒙端缺失，Web 版补上） ---- */
    await cdp.eval(`HW.App.switchTab('profile')`);
    await cdp.waitFor(`!!document.querySelector('.profile-hero')`, 8000);
    const wishlistEntry = await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('.preference-row'));
      const row = rows.find(r => r.innerText.includes('心愿清单'));
      const btn = row ? Array.from(row.querySelectorAll('button')).find(b => b.textContent.trim() === '查看') : null;
      return { hasSection: document.body.innerText.includes('我的清单'), hasRow: !!row, hasButton: !!btn };
    })()`);
    log('我的页含「我的清单 / 心愿清单」入口', wishlistEntry.hasSection && wishlistEntry.hasRow && wishlistEntry.hasButton, JSON.stringify(wishlistEntry));

    await cdp.eval(`(() => {
      const rows = Array.from(document.querySelectorAll('.preference-row'));
      const row = rows.find(r => r.innerText.includes('心愿清单'));
      Array.from(row.querySelectorAll('button')).find(b => b.textContent.trim() === '查看').click();
    })()`);
    const wishlistNavOk = await cdp.waitFor(`document.body.innerText.includes('心仪单品')`, 8000);
    log('点击「查看」进入心愿清单页', !!wishlistNavOk);
    await cdp.eval(`HW.App.switchTab('profile')`);
    await cdp.waitFor(`!!document.querySelector('.profile-hero')`, 8000);

    /* ---- 快捷录入弹层 ---- */
    await cdp.eval(`HW.App.switchTab('wardrobe')`);
    await cdp.waitFor(`!!document.querySelector('.bottom-nav__fab')`);
    await cdp.eval(`document.querySelector('.bottom-nav__fab').click()`);
    const quickOk = await cdp.waitFor(`!!document.querySelector('.sheet-backdrop')`);
    const quickText = await cdp.eval(`document.querySelector('.sheet') ? document.querySelector('.sheet').innerText : ''`);
    log('快捷录入弹层打开', quickOk);
    log('快捷录入含穿搭/逛店/衣柜三项', quickText.includes('穿搭') && quickText.includes('逛店') && quickText.includes('衣柜'), quickText.replace(/\n/g, '/'));
    await cdp.eval(`document.querySelector('.sheet__cancel').click()`);
    await new Promise(r => setTimeout(r, 400));

    /* ---- 拍照录入页 ---- */
    await cdp.eval(`HW.App.navigate(HW.App.RouteKind.CaptureEditor, 'wardrobe', { photoUris: ['${seeded.photoId}'], capturedAt: new Date().toISOString() })`);
    const captureOk = await cdp.waitFor(`!!document.querySelector('.photo-counter') || document.body.innerText.includes('自动识别')`);
    const captureText = await cdp.eval(`document.body.innerText`);
    log('拍照录入页渲染', captureOk);
    log('拍照录入含衣物/穿搭/逛店三种模式', captureText.includes('衣物') && captureText.includes('穿搭') && captureText.includes('逛店'), '');
    log('拍照录入显示自动识别徽标', captureText.includes('自动识别'), '');

    /* ---- 穿搭编辑器（分类管理） ---- */
    await cdp.eval(`HW.App.navigate(HW.App.RouteKind.OutfitEditor, 'outfit', { outfitId: '${seeded.outfitId}' })`);
    const outfitEditorOk = await cdp.waitFor(`document.body.innerText.includes('展示内容')`);
    const outfitEditor = await cdp.eval(`(() => ({
      text: document.body.innerText,
      hasCustom: Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='自定义分类'),
      hasSelectedChip: Array.from(document.querySelectorAll('.cat-chip--active')).map(c=>c.textContent.trim())
    }))()`);
    log('穿搭编辑器渲染展示来源选择', outfitEditorOk);
    log('穿搭编辑器提供自定义分类入口', outfitEditor.hasCustom);
    log('穿搭编辑器回填已选分类「通勤」', outfitEditor.hasSelectedChip.some(c => c.includes('通勤')), JSON.stringify(outfitEditor.hasSelectedChip));

    /* ---- 分类名校验 ---- */
    const catValidation = await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='自定义分类');
      btn.click();
      const input = document.getElementById('outfit_custom_category_input');
      input.value = '这个分类名称超过十二个字符了';
      input.dispatchEvent(new Event('input', {bubbles:true}));
      return document.body.innerText;
    })()`);
    log('自定义分类名超长时报错', catValidation.includes('分类名称最多 12 个字符'), '');

    /* ---- 删除确认对话框 ---- */
    await cdp.eval(`HW.App.switchTab('wardrobe')`);
    await cdp.waitFor(`document.querySelectorAll('.wall-card').length > 0`);
    await cdp.eval(`(() => {
      const card = document.querySelector('.wall-card__media');
      card.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    })()`);
    const overlayOk = await cdp.waitFor(`!!document.querySelector('.delete-overlay')`);
    log('长按卡片显示删除遮罩', overlayOk);
    await cdp.eval(`document.querySelector('.delete-overlay__btn').click()`);
    const dialogOk = await cdp.waitFor(`!!document.querySelector('.dialog')`);
    const dialogText = await cdp.eval(`document.querySelector('.dialog') ? document.querySelector('.dialog').innerText : ''`);
    log('删除弹出确认对话框', dialogOk);
    log('删除确认文案正确', dialogText.includes('删除衣物') && dialogText.includes('本地照片会一并移除'), dialogText.replace(/\n/g, '/'));

    /* ---- 取消删除，数据仍在 ---- */
    await cdp.eval(`Array.from(document.querySelectorAll('.dialog__action')).find(b=>b.textContent.trim()==='取消').click()`);
    await new Promise(r => setTimeout(r, 400));
    const afterCancel = await cdp.eval(`(async()=> (await HW.ClothingRepository.listClothing()).length)()`);
    log('取消删除后数据保留', afterCancel === 1, `count=${afterCancel}`);

    /* ---- 确认删除 ---- */
    await cdp.eval(`(() => {
      const card = document.querySelector('.wall-card__media');
      card.dispatchEvent(new PointerEvent('pointerdown', {bubbles:true}));
    })()`);
    await cdp.waitFor(`!!document.querySelector('.delete-overlay__btn')`);
    await cdp.eval(`document.querySelector('.delete-overlay__btn').click()`);
    await cdp.waitFor(`!!document.querySelector('.dialog')`);
    await cdp.eval(`Array.from(document.querySelectorAll('.dialog__action')).find(b=>b.textContent.trim()==='删除').click()`);
    const deleted = await cdp.eval(`(async () => {
      await new Promise(r=>setTimeout(r,800));
      return {
        count: (await HW.ClothingRepository.listClothing()).length,
        searchCount: (await HW.SearchRepository.search('衬衫', 100)).length,
        photos: (await HW.PhotoStore.summary()).photoCount
      };
    })()`);
    log('确认删除后衣物移除', deleted.count === 0, `count=${deleted.count}`);

    /* 精确校验：衣物自身的搜索文档应消失；穿搭文档因仍引用「测试白衬衫」而保留（符合预期） */
    const searchDetail = await cdp.eval(`(async () => {
      const all = await HW.SearchRepository.search('衬衫', 100);
      return {
        total: all.length,
        types: all.map(x => x.entityType),
        clothingDocs: all.filter(x => x.entityType === 'clothing').length
      };
    })()`);
    log('删除后衣物的搜索文档被清除', searchDetail.clothingDocs === 0, `clothingDocs=${searchDetail.clothingDocs}`);
    log('仍引用该名称的穿搭文档保留（符合设计）', searchDetail.types.includes('outfit'), JSON.stringify(searchDetail.types));

    /* 照片仍被穿搭/心愿引用 → 不应被当作孤儿清理 */
    const photoRef = await cdp.eval(`(async () => {
      const outfitPhotos = await HW.Db.getAll('outfit_photos');
      const wishPhotos = await HW.Db.getAll('wishlist_photos');
      return { outfitRefs: outfitPhotos.length, wishRefs: wishPhotos.length };
    })()`);
    log('照片仍被穿搭/心愿引用，保留是正确的', photoRef.outfitRefs > 0 && photoRef.wishRefs > 0, JSON.stringify(photoRef));

    /* 删除穿搭后，照片仍被心愿引用 → 仍保留 */
    await cdp.eval(`(async () => { await HW.OutfitRepository.deleteOutfit('${seeded.outfitId}'); })()`);
    const afterOutfitDelete = await cdp.eval(`(async () => {
      const photos = (await HW.PhotoStore.summary()).photoCount;
      const outfitPhotos = (await HW.Db.getAll('outfit_photos')).length;
      const clothingPhotos = (await HW.Db.getAll('clothing_photos')).length;
      return { photos, outfitPhotos, clothingPhotos };
    })()`);
    log('删除穿搭后照片仍被心愿引用而保留', afterOutfitDelete.photos === 1 && afterOutfitDelete.outfitPhotos === 0 && afterOutfitDelete.clothingPhotos === 0, JSON.stringify(afterOutfitDelete));

    /* 删除心愿后，照片彻底成为孤儿 → 应被清理 */
    await cdp.eval(`(async () => { await HW.WishlistRepository.deleteWishlistItem('${seeded.wishId}'); })()`);
    const orphanCleaned = await cdp.eval(`(async () => ({
      photos: (await HW.PhotoStore.summary()).photoCount,
      wearLogPhotos: (await HW.Db.getAll('wear_log_photos')).length
    }))()`);
    log('照片仍被穿着记录引用时保留', orphanCleaned.photos === 1 && orphanCleaned.wearLogPhotos === 1, JSON.stringify(orphanCleaned));

    await cdp.eval(`(async () => { await HW.WearLogRepository.deleteWearLog('${seeded.wearLogId}'); })()`);
    const fullyCleaned = await cdp.eval(`(async () => ({
      photos: (await HW.PhotoStore.summary()).photoCount,
      allPhotoTables: (await HW.Db.getAll('clothing_photos')).length
        + (await HW.Db.getAll('outfit_photos')).length
        + (await HW.Db.getAll('wear_log_photos')).length
        + (await HW.Db.getAll('wishlist_photos')).length
        + (await HW.Db.getAll('store_visit_photos')).length
        + (await HW.Db.getAll('store_photos')).length
    }))()`);
    const refBreakdown = await cdp.eval(`(async () => {
      const tables = ['clothing_photos','outfit_photos','wear_log_photos','wishlist_photos','store_visit_photos','store_photos'];
      const out = {};
      for (const t of tables) { out[t] = (await HW.Db.getAll(t)).length; }
      return out;
    })()`);
    log('删除穿搭/心愿/穿着后仅门店侧仍引用照片', JSON.stringify(refBreakdown) === JSON.stringify({
      clothing_photos:0, outfit_photos:0, wear_log_photos:0, wishlist_photos:0, store_visit_photos:1, store_photos:1
    }), JSON.stringify(refBreakdown));
    log('门店仍引用照片 → Blob 保留是正确的', fullyCleaned.photos === 1, `photos=${fullyCleaned.photos}`);

    /* 删除逛店记录后，门店侧仍保留门店与首图 → 照片仍是门店的 */
    await cdp.eval(`(async () => { await HW.StoreRepository.deleteStoreVisit('${seeded.visitId}'); })()`);
    const afterVisitDelete = await cdp.eval(`(async () => ({
      visitPhotos: (await HW.Db.getAll('store_visit_photos')).length,
      storePhotos: (await HW.Db.getAll('store_photos')).length,
      photos: (await HW.PhotoStore.summary()).photoCount
    }))()`);
    log('删除逛店记录后门店资料与首图保留', afterVisitDelete.visitPhotos === 0 && afterVisitDelete.storePhotos === 1, JSON.stringify(afterVisitDelete));
    log('照片仍属于门店 → 不清理是正确的', afterVisitDelete.photos === 1, `photos=${afterVisitDelete.photos}`);

    /* ---- 备份导出 ---- */
    const backup = await cdp.eval(`(async () => {
      const photos = await HW.PhotoStore.exportAll();
      const summary = await HW.PhotoStore.summary();
      return { exported: photos.length, stored: summary.photoCount };
    })()`);
    log('照片可导出为备份数据', backup.exported === backup.stored && backup.exported > 0, `exported=${backup.exported}`);

    /* ---- 持久化：重新加载 ---- */
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/index.html` });
    await cdp.waitFor(`!!document.querySelector('.bottom-nav')`, 10000);
    const persisted = await cdp.eval(`(async () => {
      const profile = await HW.ProfileRepository.getProfile();
      return {
        outfits: (await HW.OutfitRepository.listOutfits()).length,
        visits: (await HW.StoreRepository.listStoreVisits()).length,
        wishes: (await HW.WishlistRepository.listWishlistItems()).length,
        logs: (await HW.WearLogRepository.listWearLogs()).length,
        height: profile.heightCm, budget: profile.monthlyBudget,
        photos: (await HW.PhotoStore.summary()).photoCount
      };
    })()`);
    log('刷新后档案仍在', persisted.height === 175 && persisted.budget === 3000, JSON.stringify(persisted));

    /* 真正孤儿（无任何引用）的照片必须被清理 */
    const orphanTest = await cdp.eval(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width=2; canvas.height=2;
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const orphanId = await HW.PhotoStore.save(blob);
      const before = (await HW.PhotoStore.summary()).photoCount;
      await HW.removeOrphanPhotoBlobs([orphanId]);
      const after = (await HW.PhotoStore.summary()).photoCount;
      return { before, after, orphanId };
    })()`);
    log('无引用照片被正确清理', orphanTest.after === orphanTest.before - 1, JSON.stringify(orphanTest));

    /* ---- 错误收集 ---- */
    const finalErrors = await cdp.eval('JSON.stringify(window.__errors || [])');
    log('全流程无未捕获 JS 错误', finalErrors === '[]', finalErrors);
    log('控制台无错误日志', cdp.logs.length === 0, cdp.logs.join(' | '));

  } catch (error) {
    console.log('\n✗ 测试执行异常: ' + error.message + '\n' + error.stack);
    results.push({ name: '测试执行', ok: false, detail: error.message });
  } finally {
    const passed = results.filter(r => r.ok).length;
    const failed = results.filter(r => !r.ok).length;
    console.log(`\n========== 结果: ${passed} 通过 / ${failed} 失败 / 共 ${results.length} ==========`);
    if (failed) {
      console.log('失败项:');
      results.filter(r => !r.ok).forEach(r => console.log(`  - ${r.name}  ${r.detail}`));
    }
    try { chrome.kill(); } catch (e) {}
    server.close();
    process.exit(failed ? 1 : 0);
  }
}
main();
