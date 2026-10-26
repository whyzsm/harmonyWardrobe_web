/* 衣不缺 Web 版 — 逛街页 / StoreVisitPage
   对应鸿蒙端 entry/src/main/ets/pages/StoreVisitPage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  var STATUS_FILTERS = [
    { label: '全部', value: 'all', icon: 'square_grid_2x2' },
    { label: '去过', value: 'visited', icon: 'store_fill' },
    { label: '想去', value: 'wantToVisit', icon: 'heart' }
  ];

  HW.pages.storeVisit = function (route, ctx) {
    var state = {
      visits: [],
      searchQuery: route.params.storeQuery || '',
      statusFilter: 'all',
      loading: true,
      errorMessage: '',
      savedOutsideFilterId: '',
      deleteOverlayId: '',
      deletingId: ''
    };

    var root = el('div', { class: 'page' });
    var headerHost = el('div');
    var bodyHost = el('div', { class: 'page__body page__body--column' });
    var masonry = helpers.createMasonry({ columns: 2, rowGap: 8 });
    var listHost = masonry.container;

    /* ---------- 搜索与状态筛选 ---------- */
    function buildHeader() {
      var searchInput = el('input', {
        class: 'search-header__input',
        type: 'text',
        placeholder: '搜索商场、品牌、试穿记录',
        'aria-label': '搜索逛店记录'
      });
      searchInput.value = state.searchQuery;
      searchInput.addEventListener('input', function (event) {
        state.searchQuery = event.target.value;
        renderList();
      });

      var statusRow = el('div', { class: 'row', style: { gap: '6px', width: '100%' } });
      STATUS_FILTERS.forEach(function (filter) {
        var isActive = state.statusFilter === filter.value;
        statusRow.appendChild(
          el(
            'button',
            {
              class: 'chip chip--wide' + (isActive ? ' chip--active' : ''),
              type: 'button',
              'aria-label': filter.label + (isActive ? '，已选中' : ''),
              onclick: function () {
                state.statusFilter = filter.value;
                renderHeader();
                renderList();
              }
            },
            [
              el('span', { html: HW.icon(filter.icon, 14) }),
              el('span', { text: filter.label })
            ]
          )
        );
      });

      return el('div', { class: 'section-block', style: { paddingTop: '8px' } }, [
        el('div', { class: 'search-header' }, [
          el(
            'button',
            {
              class: 'search-header__icon-button',
              type: 'button',
              'aria-label': '执行搜索',
              html: HW.icon('magnifyingglass', 18),
              onclick: function () {
                HW.App.navigate(HW.App.RouteKind.Search, models.AppMainTab.Store, {
                  query: state.searchQuery
                });
              }
            },
            []
          ),
          searchInput
        ]),
        el('div', { style: { height: '10px' } }),
        statusRow
      ]);
    }

    /* ---------- 提示条 ---------- */
    var noticeHost = el('div', { class: 'section-block' });

    function renderNotice() {
      ui.clear(noticeHost);
      noticeHost.appendChild(
        ui.savedFilterNotice(!!state.savedOutsideFilterId, function () {
          state.searchQuery = '';
          state.statusFilter = 'all';
          state.savedOutsideFilterId = '';
          renderHeader();
          renderList();
        })
      );
    }

    /* ---------- 路线卡片 ---------- */
    function routeVisits() {
      var today = HW.utils.todayIsoDate();
      var todayVisits = state.visits.filter(function (visit) {
        return visit.visitDate === today;
      });
      return todayVisits.length > 0 ? todayVisits : state.visits;
    }

    function hasTodayRoute() {
      var today = HW.utils.todayIsoDate();
      return state.visits.some(function (visit) {
        return visit.visitDate === today;
      });
    }

    function routeLocation() {
      var visits = routeVisits();
      for (var i = 0; i < visits.length; i += 1) {
        var location = (visits[i].districtOrAddress || '').trim();
        if (location) {
          return location;
        }
      }
      return '逛店随手记';
    }

    function routeSummaryText() {
      if (isSearching()) {
        return '找到 ' + filteredVisits().length + ' 条逛店记录';
      }
      var visits = routeVisits();
      var visited = 0;
      var wantToVisit = 0;
      visits.forEach(function (visit) {
        if (helpers.visitStatus(visit) === models.StoreVisitStatus.WantToVisit) {
          wantToVisit += 1;
        } else {
          visited += 1;
        }
      });
      return visited + ' 家去过，' + wantToVisit + ' 家想去。';
    }

    function renderRouteCard() {
      var badgeText = isSearching()
        ? String(filteredVisits().length)
        : String(state.visits.length);

      return el('div', { class: 'section-block', style: { marginBottom: '16px' } }, [
        el('div', { class: 'guide-card' }, [
          el('div', { class: 'guide-card__text' }, [
            el('div', {
              class: 'guide-card__title',
              text: (hasTodayRoute() ? '今天路线' : '最近路线') + '：' + routeLocation()
            }),
            el('div', { class: 'guide-card__desc', text: routeSummaryText() })
          ]),
          el('div', { class: 'guide-card__badge', text: badgeText })
        ])
      ]);
    }

    /* ---------- 过滤 ---------- */
    function isSearching() {
      return state.searchQuery.trim().length > 0;
    }

    function filteredVisits() {
      var query = state.searchQuery.trim().toLowerCase();

      return state.visits.filter(function (visit) {
        if (state.statusFilter === 'visited') {
          if (helpers.visitStatus(visit) === models.StoreVisitStatus.WantToVisit) {
            return false;
          }
        } else if (state.statusFilter === 'wantToVisit') {
          if (helpers.visitStatus(visit) !== models.StoreVisitStatus.WantToVisit) {
            return false;
          }
        }

        if (query === '') {
          return true;
        }
        var haystack = [
          visit.storeNameSnapshot,
          visit.visitDate,
          visit.districtOrAddress,
          visit.note,
          (visit.focusTags || []).join(' ')
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.indexOf(query) >= 0;
      });
    }

    function cardAspectRatio(index) {
      if (index % 4 === 0) {
        return 0.704;
      }
      if (index % 4 === 2) {
        return 0.98;
      }
      return 0.833;
    }

    /* ---------- 列表 ---------- */
    function renderList() {
      masonry.reset();
      var items = filteredVisits();

      if (items.length === 0) {
        if (isSearching()) {
          masonry.showEmpty(
            ui.wallEmptyState({
              icon: 'store_fill',
              cardTitle: '没有找到相关逛店记录',
              cardDesc: '可以换个商场、品牌或试穿关键词。',
              title: '换个关键词，看看其它逛店记录',
              desc: '也可以清空搜索回到全部逛店。'
            })
          );
        } else if (state.visits.length === 0) {
          masonry.showEmpty(
            ui.wallEmptyState({
              icon: 'store_fill',
              accessibilityText: '新增逛店记录',
              cardTitle: '还没有逛店记录',
              cardDesc: '拍照或从相册选图后，按状态收进逛店。',
              title: '点底部相机，打开快捷录入里的新增逛店。',
              desc: '逛店会按图片记录流排在这里。',
              onClick: function () {
                HW.App.navigate(HW.App.RouteKind.StoreEditor, models.AppMainTab.Store, {});
              }
            })
          );
        } else {
          masonry.showEmpty(
            ui.wallEmptyState({
              icon: 'store_fill',
              cardTitle: '这个状态下还没有逛店记录',
              cardDesc: '当前状态下没有匹配记录。',
              title: '切换状态，看看其他逛店记录。',
              desc: '已有逛店记录会按图片墙排在这里。'
            })
          );
        }
        return;
      }

      items.forEach(function (visit, index) {
        var meta = '';
        if ((visit.focusTags || []).length > 0) {
          meta = visit.focusTags.join(' · ');
        } else if ((visit.note || '').trim()) {
          meta = visit.note.trim();
        } else if ((visit.districtOrAddress || '').trim()) {
          meta = visit.districtOrAddress.trim();
        } else {
          meta = visit.visitDate;
        }

        var aspectRatio = cardAspectRatio(index);
        var card = helpers.wallCard({
          aspectRatio: aspectRatio,
          photoId: visit.photoUris && visit.photoUris.length ? visit.photoUris[0] : '',
          placeholderIcon: 'store_fill',
          statusText: helpers.visitBadge(visit),
          title: visit.storeNameSnapshot,
          meta: meta,
          accessibilityText:
            visit.storeNameSnapshot + '，' + helpers.visitBadge(visit) + '，' + meta,
          onClick: function () {
            if (state.deleteOverlayId) {
              state.deleteOverlayId = '';
              renderList();
              return;
            }
            HW.App.navigate(HW.App.RouteKind.StoreVisitDetail, models.AppMainTab.Store, {
              storeVisitId: visit.id
            });
          },
          onLongPress: function () {
            if (state.deletingId) {
              return;
            }
            state.deleteOverlayId = visit.id;
            renderList();
          }
        });

        if (state.deleteOverlayId === visit.id) {
          helpers.attachDeleteOverlay(card.querySelector('.wall-card__media'), {
            label: '删除逛店记录',
            deleting: state.deletingId === visit.id,
            onDelete: function () {
              confirmDelete(visit);
            },
            onDismiss: function () {
              state.deleteOverlayId = '';
              renderList();
            }
          });
        }

        masonry.place(card, aspectRatio);
      });

      helpers.resolvePhotos(listHost);
    }

    function confirmDelete(visit) {
      ui.showConfirm({
        title: '删除逛店记录',
        message:
          '确定删除“' +
          visit.storeNameSnapshot +
          '”的这条逛店记录吗？本地照片会一并移除，门店资料仍会保留。',
        confirmText: '删除',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) {
          state.deleteOverlayId = '';
          renderList();
          return;
        }
        state.deletingId = visit.id;
        renderList();

        ctx.repositories.store
          .deleteStoreVisit(visit.id)
          .then(function () {
            state.visits = state.visits.filter(function (candidate) {
              return candidate.id !== visit.id;
            });
            state.deleteOverlayId = '';
            state.deletingId = '';
            renderBody();
            ctx.showToast('逛店记录已删除');
          })
          .catch(function (error) {
            state.deleteOverlayId = '';
            state.deletingId = '';
            renderList();
            ctx.showToast(
              HW.utils.userFacingError(error, '删除逛店记录失败'),
              true
            );
          });
      });
    }

    /* ---------- 渲染 ---------- */
    function renderHeader() {
      ui.clear(headerHost);
      headerHost.appendChild(buildHeader());
    }

    function renderBody() {
      ui.clear(bodyHost);

      if (state.loading) {
        bodyHost.appendChild(
          ui.loadingBlock('正在加载逛店记录...', '逛店记录正在从本地衣柜读取。')
        );
        return;
      }

      if (state.errorMessage) {
        bodyHost.appendChild(
          el('div', { class: 'stack stack--md', style: { padding: '20px' } }, [
            el('div', { style: { fontSize: '14px' }, text: '逛店记录暂时没有加载成功' }),
            el('div', {
              class: 'text-danger',
              style: { fontSize: '12px' },
              text: state.errorMessage
            }),
            el('button', {
              class: 'btn btn--sm',
              type: 'button',
              text: '重试',
              onclick: load
            })
          ])
        );
        return;
      }

      bodyHost.appendChild(noticeHost);
      renderNotice();

      if (state.visits.length > 0) {
        bodyHost.appendChild(renderRouteCard());
      }

      bodyHost.appendChild(listHost);
      renderList();
    }

    function load() {
      state.loading = true;
      state.errorMessage = '';
      renderBody();

      ctx.repositories.store
        .listStoreVisits()
        .then(function (visits) {
          state.visits = visits;
          state.loading = false;
          renderBody();
        })
        .catch(function (error) {
          state.loading = false;
          state.errorMessage = HW.utils.userFacingError(error, '加载逛店失败');
          renderBody();
        });
    }

    root.appendChild(headerHost);
    root.appendChild(bodyHost);

    renderHeader();
    renderBody();
    load();

    return { el: root, destroy: function () {} };
  };
})(window);
