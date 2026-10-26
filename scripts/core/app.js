/* 衣不缺 Web 版 — 应用外壳 / App Shell
   路由栈、底部导航、快捷录入弹层、全局错误提示。
   对应鸿蒙端 entry/src/main/ets/pages/Index.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var icon = HW.icon;

  var RouteKind = {
    Main: 'main',
    ClothingDetail: 'clothingDetail',
    ClothingEditor: 'clothingEditor',
    OutfitDetail: 'outfitDetail',
    OutfitEditor: 'outfitEditor',
    StoreVisitDetail: 'storeVisitDetail',
    StoreEditor: 'storeEditor',
    WearLogEditor: 'wearLogEditor',
    Wishlist: 'wishlist',
    WishlistEditor: 'wishlistEditor',
    Search: 'search',
    CaptureEditor: 'captureEditor'
  };

  function createDefaultParams() {
    return {
      clothingId: '',
      outfitId: '',
      storeVisitId: '',
      wearLogId: '',
      wishlistItemId: '',
      query: '',
      scope: '',
      photoUris: [],
      capturedAt: '',
      sourceTab: HW.models.AppMainTab.Outfit
    };
  }

  var App = {
    RouteKind: RouteKind,

    /** @type {Array<{kind:string, mainTab:string, params:Object}>} */
    stack: [],
    canvas: null,
    contentHost: null,
    navHost: null,
    errorHost: null,
    currentView: null,
    ready: false,

    init: function () {
      App.canvas = document.getElementById('app');
      App.canvas.innerHTML = '';

      var shell = el('div', { class: 'app-canvas' });
      App.contentHost = el('div', {
        class: 'page',
        style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' }
      });
      App.navHost = el('div');
      App.errorHost = el('div');

      shell.appendChild(App.contentHost);
      shell.appendChild(App.navHost);
      shell.appendChild(App.errorHost);
      App.canvas.appendChild(shell);
      App.canvas = shell;

      App.stack = [
        {
          kind: RouteKind.Main,
          mainTab: HW.models.AppMainTab.Outfit,
          params: createDefaultParams()
        }
      ];

      App.ready = true;
      App.render();
    },

    /* ---------- 路由 ---------- */
    current: function () {
      return App.stack[App.stack.length - 1];
    },

    navigate: function (kind, mainTab, params, options) {
      var opts = options || {};
      var route = {
        kind: kind,
        mainTab: mainTab || App.current().mainTab,
        params: Object.assign(createDefaultParams(), params || {})
      };

      if (opts.replace) {
        App.stack[App.stack.length - 1] = route;
      } else {
        App.stack.push(route);
      }
      App.render();
    },

    back: function () {
      if (App.stack.length > 1) {
        App.stack.pop();
        App.render();
      }
    },

    /**
     * 消费（清空）当前路由上的某个参数。
     * 对应鸿蒙端 Index.consumeWishlistRoute()：条目 id 被目标页读走后要清掉，
     * 否则返回该路由时会重复触发。
     */
    consumeParam: function (key) {
      var current = App.current();
      if (current && current.params && typeof current.params[key] === 'string') {
        current.params[key] = '';
      }
    },

    /** 切换主 Tab（重置为该 Tab 的根页面） */
    switchTab: function (mainTab) {
      App.stack = [
        {
          kind: RouteKind.Main,
          mainTab: mainTab,
          params: createDefaultParams()
        }
      ];
      App.render();
    },

    /** 替换当前路由但保留主 Tab（用于「保存后返回列表」） */
    replaceMain: function (mainTab, params) {
      App.stack = [
        {
          kind: RouteKind.Main,
          mainTab: mainTab,
          params: Object.assign(createDefaultParams(), params || {})
        }
      ];
      App.render();
    },

    /* ---------- 渲染 ---------- */
    render: function () {
      if (!App.ready) {
        return;
      }

      var route = App.current();
      ui.clear(App.contentHost);
      ui.clear(App.navHost);

      if (App.currentView && typeof App.currentView.destroy === 'function') {
        try {
          App.currentView.destroy();
        } catch (error) {
          /* ignore */
        }
      }
      App.currentView = null;

      var view = App.buildView(route);
      App.currentView = view;
      App.contentHost.appendChild(view.el);

      App.renderBottomNav(route);
    },

    buildView: function (route) {
      var ctx = App.createContext(route);
      switch (route.kind) {
        case RouteKind.Main:
          return App.buildMainView(route, ctx);
        case RouteKind.ClothingDetail:
          return HW.pages.clothingDetail(route, ctx);
        case RouteKind.ClothingEditor:
          return HW.pages.clothingEditor(route, ctx);
        case RouteKind.OutfitDetail:
          return HW.pages.outfitDetail(route, ctx);
        case RouteKind.OutfitEditor:
          return HW.pages.outfitEditor(route, ctx);
        case RouteKind.StoreVisitDetail:
          return HW.pages.storeVisitDetail(route, ctx);
        case RouteKind.StoreEditor:
          return HW.pages.storeEditor(route, ctx);
        case RouteKind.WearLogEditor:
          return HW.pages.wearLogEditor(route, ctx);
        case RouteKind.Wishlist:
          return HW.pages.wishlist(route, ctx);
        case RouteKind.WishlistEditor:
          return HW.pages.wishlistEditor(route, ctx);
        case RouteKind.Search:
          return HW.pages.searchResults(route, ctx);
        case RouteKind.CaptureEditor:
          return HW.pages.captureEditor(route, ctx);
        default:
          return App.buildMainView(
            { kind: RouteKind.Main, mainTab: HW.models.AppMainTab.Outfit, params: {} },
            ctx
          );
      }
    },

    buildMainView: function (route, ctx) {
      var tab = route.mainTab;
      var host = el('div', {
        class: 'page',
        style: { display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0' }
      });

      var view;
      switch (tab) {
        case HW.models.AppMainTab.Wardrobe:
          view = HW.pages.wardrobe(route, ctx);
          break;
        case HW.models.AppMainTab.Store:
          view = HW.pages.storeVisit(route, ctx);
          break;
        case HW.models.AppMainTab.Outfit:
          view = HW.pages.outfits(route, ctx);
          break;
        default:
          view = HW.pages.profile(route, ctx);
          break;
      }

      host.appendChild(view.el);
      return view;
    },

    createContext: function (route) {
      return {
        route: route,
        params: route.params,
        mainTab: route.mainTab,
        repositories: {
          clothing: HW.ClothingRepository,
          outfit: HW.OutfitRepository,
          store: HW.StoreRepository,
          wearLog: HW.WearLogRepository,
          wishlist: HW.WishlistRepository,
          profile: HW.ProfileRepository,
          search: HW.SearchRepository
        },
        showToast: ui.showToast,
        showConfirm: ui.showConfirm,
        showSheet: ui.showSheet,
        showPhotoPreview: ui.showPhotoPreview,
        navigate: function (kind, mainTab, params, options) {
          App.navigate(kind, mainTab, params, options);
        },
        back: App.back,
        switchTab: App.switchTab,
        replaceMain: App.replaceMain,
        /** 统一搜索结果跳转（对应 Index.onOpenSearchTarget） */
        openSearchTarget: function (entityType, id, title) {
          App.openSearchTarget(entityType, id, title);
        },
        openQuickCapture: App.openQuickCapture,
        setGlobalError: App.setGlobalError
      };
    },

    /**
     * 统一搜索结果跳转（对应鸿蒙端 Index.onOpenSearchTarget）
     */
    openSearchTarget: function (entityType, id, title) {
      var models = HW.models;
      switch (entityType) {
        case models.SearchEntityType.Outfit:
          App.navigate(RouteKind.OutfitDetail, models.AppMainTab.Outfit, { outfitId: id });
          break;
        case models.SearchEntityType.Store:
          App.navigate(RouteKind.StoreVisitDetail, models.AppMainTab.Store, {
            storeVisitId: '',
            storeQuery: title || ''
          });
          break;
        case models.SearchEntityType.StoreVisit:
          App.navigate(RouteKind.StoreVisitDetail, models.AppMainTab.Store, {
            storeVisitId: id
          });
          break;
        case models.SearchEntityType.Wishlist:
          /* 对应鸿蒙端 Index.openWishlistPage(id)：
             进入心愿清单页并带上待打开的条目，由清单页消费后展开编辑器。 */
          App.navigate(RouteKind.Wishlist, models.AppMainTab.Profile, {
            wishlistItemId: id
          });
          break;
        case models.SearchEntityType.WearLog:
          App.navigate(RouteKind.WearLogEditor, models.AppMainTab.Outfit, {
            wearLogId: id
          });
          break;
        case models.SearchEntityType.Clothing:
          App.navigate(RouteKind.ClothingDetail, models.AppMainTab.Wardrobe, {
            clothingId: id
          });
          break;
        default:
          App.switchTab(models.AppMainTab.Profile);
          break;
      }
    },

    /* ---------- 全局错误条 ---------- */
    setGlobalError: function (message) {
      ui.clear(App.errorHost);
      if (!message) {
        return;
      }
      App.errorHost.appendChild(
        el('div', {
          class: 'text-danger',
          style: {
            width: '100%',
            padding: '8px 20px',
            fontSize: '13px',
            background: 'var(--card-white)'
          },
          text: message
        })
      );
    },

    /* ---------- 底部导航 ---------- */
    renderBottomNav: function (route) {
      if (route.kind !== RouteKind.Main) {
        return;
      }

      var models = HW.models;
      var activeTab = route.mainTab;

      function navItem(tab, label, iconName) {
        var isActive = activeTab === tab;
        return el(
          'button',
          {
            class: 'bottom-nav__item' + (isActive ? ' bottom-nav__item--active' : ''),
            type: 'button',
            'aria-label': label + (isActive ? '，已选中' : ''),
            'aria-current': isActive ? 'page' : null,
            onclick: function () {
              App.switchTab(tab);
            }
          },
          [
            el('span', { class: 'bottom-nav__icon', html: icon(iconName, 20) }),
            el('span', { class: 'bottom-nav__label', text: label })
          ]
        );
      }

      var nav = el('nav', { class: 'bottom-nav', 'aria-label': '主导航' }, [
        navItem(models.AppMainTab.Outfit, '穿搭', 'hanger_and_towels'),
        navItem(models.AppMainTab.Wardrobe, '衣柜', 'shirt'),
        el(
          'button',
          {
            class: 'bottom-nav__fab-slot',
            type: 'button',
            'aria-label': '快捷录入',
            onclick: function () {
              App.openQuickCapture();
            }
          },
          [
            el('span', { class: 'bottom-nav__fab', html: icon('camera_fill', 20) })
          ]
        ),
        navItem(models.AppMainTab.Store, '逛街', 'store_fill'),
        navItem(models.AppMainTab.Profile, '我的', 'person')
      ]);

      App.navHost.appendChild(
        el('div', { class: 'bottom-nav-host' }, [nav])
      );
    },

    /* ---------- 快捷录入弹层 ---------- */
    openQuickCapture: function () {
      var activeTab = App.current().mainTab;
      var models = HW.models;

      /**
       * 深色卡片跟随当前 Tab：
       *   穿搭 Tab → 穿搭 深色；逛街 Tab → 逛街 深色；其余 → 衣柜 深色
       */
      function isPrimary(target) {
        if (activeTab === models.AppMainTab.Store || activeTab === models.AppMainTab.Outfit) {
          return activeTab === target;
        }
        return target === models.AppMainTab.Wardrobe;
      }

      var sheet = ui.showSheet({
        title: '快捷录入',
        flat: true,
        render: function (close) {
          var wrap = el('div', { class: 'stack stack--md' });

          function actionCard(options) {
            var primary = isPrimary(options.target);
            return el(
              'button',
              {
                class: 'quick-action' + (primary ? ' quick-action--primary' : ''),
                type: 'button',
                'aria-label': options.title + '，' + options.description,
                onclick: function () {
                  close();
                  options.onClick();
                }
              },
              [
                el('span', {
                  class: 'quick-action__icon',
                  html: icon(options.icon, 22)
                }),
                el('span', { class: 'quick-action__text' }, [
                  el('span', { class: 'quick-action__title', text: options.title }),
                  el('span', { class: 'quick-action__desc', text: options.description })
                ])
              ]
            );
          }

          wrap.appendChild(
            actionCard({
              title: '穿搭',
              description: '新增穿搭',
              icon: 'hanger_and_towels',
              target: models.AppMainTab.Outfit,
              onClick: function () {
                App.openQuickOutfitEditor();
              }
            })
          );
          wrap.appendChild(
            actionCard({
              title: '逛店',
              description: '新增逛店记录',
              icon: 'store_fill',
              target: models.AppMainTab.Store,
              onClick: function () {
                App.openQuickStoreEditor();
              }
            })
          );
          wrap.appendChild(
            actionCard({
              title: '衣柜',
              description: '新增衣物',
              icon: 'shirt',
              target: models.AppMainTab.Wardrobe,
              onClick: function () {
                App.openQuickClothingEditor();
              }
            })
          );

          return wrap;
        }
      });

      return sheet;
    },

    openQuickOutfitEditor: function () {
      App.navigate(RouteKind.OutfitEditor, App.current().mainTab, {});
    },

    openQuickStoreEditor: function () {
      App.navigate(RouteKind.StoreEditor, App.current().mainTab, {});
    },

    openQuickClothingEditor: function () {
      App.navigate(RouteKind.ClothingEditor, App.current().mainTab, {});
    },

    /**
     * 拍照录入：选择照片 → 进入 CaptureEditor
     */
    startCapture: function (source) {
      var picker =
        source === 'camera'
          ? HW.PhotoPickerAdapter.captureFromCamera()
          : HW.PhotoPickerAdapter.pickFromGallery(HW.models.MAX_USER_PHOTOS);

      return picker
        .then(function (photoUris) {
          if (!photoUris || !photoUris.length) {
            return;
          }
          App.navigate(RouteKind.CaptureEditor, App.current().mainTab, {
            photoUris: photoUris,
            capturedAt: new Date().toISOString(),
            sourceTab: App.current().mainTab
          });
        })
        .catch(function (error) {
          App.setGlobalError(
            HW.utils.userFacingError(error, source === 'camera' ? '拍照失败，请重试' : '选择照片失败，请重试')
          );
        });
    }
  };

  HW.App = App;
  HW.createDefaultParams = createDefaultParams;
})(window);
