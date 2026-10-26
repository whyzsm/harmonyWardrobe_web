# 衣不缺 · 网页版（Harmony Wardrobe Web）

鸿蒙端 App「衣不缺」（Harmony Wardrobe）的 Web 版实现。
源仓库：[whyzsm/harmonyWardrobe](https://github.com/whyzsm/harmonyWardrobe)，基线分支 `7.30`（commit `3eac889`）。

零依赖、零构建：直接双击 `index.html` 即可运行，所有数据存在浏览器本地。

---

## 快速开始

```bash
# 方式一：直接双击（最简单）
open index.html

# 方式二：起一个本地服务器（推荐，行为与线上一致）
python3 -m http.server 8080
# 然后访问 http://127.0.0.1:8080
```

> `file://` 与 `http://` 均可运行，测试已覆盖两种协议。

---

## 功能覆盖

与鸿蒙端 1:1 对齐，四个主 Tab + 全部子页面。

| Tab | 内容 | 对应鸿蒙源文件 |
|---|---|---|
| **穿搭** | 穿搭图片墙、分类筛选、穿搭详情、穿搭编辑器（展示来源/分类管理/关联单品）、穿着记录编辑器 | `OutfitsPage` / `OutfitDetailPage` / `OutfitEditPage` / `WearLogEditPage` |
| **衣柜** | 衣物图片墙、四类筛选、衣物详情、衣物编辑器（照片/分类/备注/购买信息） | `WardrobePage` / `ClothingDetailPage` / `ClothingEditPage` |
| **逛街** | 逛店图片墙、状态筛选（去过/想去）、路线卡片、逛店详情、逛店编辑器（状态/标签） | `StoreVisitPage` / `StoreVisitDetailPage` / `StoreVisitEditPage` |
| **我的** | 身形尺码、常逛商圈、月度预算、统计概览、本地存储说明、备份导入导出 | `ProfilePage` |

全局能力：

- **底部导航**：穿搭 / 衣柜 / 中央相机 / 逛街 / 我的，中央相机打开「快捷录入」弹层（穿搭 / 逛店 / 衣柜）
- **拍照录入**：一次拍照可分别存入衣柜、穿搭、逛店三个目标
- **统一搜索**：跨 6 类实体的 n-gram 全文检索，带范围标签与历史记录
- **心愿清单**：独立的二级页面（记录想买的衣物、门店、价格）
- **本地备份**：导出为 JSON（含照片 base64），可再导入还原

---

## 目录结构

```
harmonyWardrobe_web/
├── index.html              入口（按依赖顺序加载脚本）
├── styles/
│   ├── tokens.css          设计令牌（颜色/字号/间距/圆角/阴影/动效）
│   ├── base.css            重置、排版、布局骨架
│   └── components.css      组件样式
├── scripts/
│   ├── core/
│   │   ├── utils.js        ID/日期/文本/n-gram/错误文案
│   │   ├── icons.js        sys.symbol.* → 内联 SVG
│   │   ├── models.js       领域枚举与常量
│   │   ├── db.js           IndexedDB 封装
│   │   ├── photoStore.js   照片 Blob 存储 + 选择适配器
│   │   ├── ui.js           渲染工具、Toast、对话框、弹层、照片预览
│   │   └── app.js          路由栈、底部导航、快捷录入
│   ├── data/
│   │   ├── clothingRepo.js   衣物仓储
│   │   ├── outfitRepo.js     穿搭仓储（含分类多对多）
│   │   ├── storeRepo.js      门店/逛店仓储
│   │   ├── miscRepo.js       穿着记录/心愿/档案仓储
│   │   └── backupService.js  本地备份导入导出
│   ├── pages/
│   │   ├── shared.js         跨页面共享逻辑（含瀑布流排布）
│   │   └── *.js              13 个页面模块
│   └── main.js            启动入口
├── assets/                默认封面图
└── tests/                 无头浏览器测试（109 项断言）
```

---

## 架构映射

Web 版沿用了鸿蒙端的分层思想，但把平台能力换成了浏览器等价物。

| 鸿蒙端 | Web 版 | 说明 |
|---|---|---|
| SQLite（RdbStore） | IndexedDB | 表结构与字段语义保持一致 |
| 应用私有目录 + `file://` URI | IndexedDB Blob + `photoId` | 照片以 Blob 存储，引用计数式孤儿清理 |
| `sys.symbol.*` 系统符号 | 内联 SVG | 同名语义映射，见 `scripts/core/icons.js` |
| ArkUI 声明式 Builder | 轻量 DOM 构建（`ui.el`） | 无框架、无构建 |
| `WaterFlow` 瀑布流 | 双列容器 + 最矮列分配 | 实测落位与 ArkUI 策略一致 |
| `PhotoPicker` / Camera | `<input type="file">` | 相册用 `multiple`，拍照用 `capture` |
| 系统文档选择器 | `<a download>` + `<input type="file">` | 备份导入导出 |
| `AlertDialog` | 自绘确认对话框 | 保留原文案 |
| `RdbStore.backup/restore` | JSON + base64 照片 | 覆盖式导入 |

### 设计令牌

`styles/tokens.css` 直接对应 `entry/src/main/ets/theme/Tokens.ets`（易布雀 Yibuque 规范），数值 1:1。

⚠️ **注意颜色通道顺序**：ArkTS 的 8 位十六进制是 **ARGB**（`#AARRGGBB`），CSS 的是 **RGBA**（`#RRGGBBAA`）。
所有带透明度的令牌都做了通道重排，例如：

- `bottomNavigationSurface: '#E62D2C2C'`（ARGB）→ CSS `#2d2c2ce6`
- `overlayDark: '#7A1D1D1F'`（ARGB）→ CSS `#1d1d1f7a`

---

## 测试

基于 Chrome DevTools Protocol 驱动真实 Chrome，无需任何依赖（Node 22 内置 WebSocket）。

```bash
node tests/run-all.js          # 全部套件
node tests/run-all.js smoke    # 只跑指定套件
```

| 套件 | 断言数 | 覆盖内容 |
|---|---|---|
| `smoke.test.js` | 72 | 页面渲染、路由切换、仓储增删改查、搜索索引、照片引用计数、备份导出、刷新持久化 |
| `file-protocol.test.js` | 12 | `file://` 下脚本加载、CSS/图片资源、IndexedDB 可用性与跨会话持久化 |
| `masonry.test.js` | 11 | 瀑布流最矮列分配与 ArkUI 策略一致性、筛选重排、空态切换 |
| `layout.test.js` | 12 | 画布高度固定、列表独立滚动、底部导航与保存条固定可见 |

当前状态：**109 项断言全部通过**。

---

## 与鸿蒙端的有意差异

1. **照片上限统一为 5 张**。鸿蒙端心愿编辑页硬编码 6 张且不截断，此处按全局常量 `MAX_USER_PHOTOS = 5` 统一。
2. **心愿编辑页错误提示统一走 `userFacingError`**。鸿蒙端该页直接抛 `error.message`，与其余页面不一致。
3. **长按删除在桌面端可用右键触发**，同时保留 500ms 长按。
4. **`ProfilePage` 保留心愿清单入口**。鸿蒙端 `WishlistSection()` 已定义但未被 `build()` 调用，Web 版挂载了该入口。
5. **搜索排序**在鸿蒙端 n-gram 降级模式下按标题升序，Web 版按命中词元数降序（更符合直觉），AND 语义一致。

---

## 已知限制

- **备份格式与鸿蒙端不互通**：鸿蒙端使用 `RdbStore.backup` 的二进制快照，Web 端是 JSON。两者数据模型一致，但文件格式不同，无法跨端导入。
- **搜索索引无 FTS5**：Web 端实现的是鸿蒙端的 n-gram 降级路径，语义等价但性能略低（数据量级为个人衣橱，无实际影响）。
- **拍照依赖 `<input capture>`**：iOS Safari 不支持该属性，会退化为相册选择。

---

## 数据存储

| 数据 | 位置 |
|---|---|
| 业务记录 | IndexedDB `harmony-wardrobe` |
| 照片 | IndexedDB `photo_blobs` 表（Blob） |
| 搜索索引 | IndexedDB `search_documents` 表 |

数据完全保存在本机，不上传任何服务器。清空浏览器站点数据即彻底删除。
