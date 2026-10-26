/* 衣不缺 Web 版 — 衣柜页 / WardrobePage
   对应鸿蒙端 entry/src/main/ets/pages/WardrobePage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  HW.pages.wardrobe = function (route, ctx) {
    var state = {
      clothingItems: [],
      searchQuery: '',
      selectedCategoryLabel: '全部',
      loading: true,
      errorMessage: '',
      savedOutsideFilterId: '',
      deleteOverlayId: '',
      deletingId: ''
    };

    var root = el('div', { class: 'page' });
    var masonry = helpers.createMasonry({ columns: 2, rowGap: 8 });
    var listHost = masonry.container;

    /* ---------- 搜索头 ---------- */
    var searchInput = el('input', {
      class: 'search-header__input',
      type: 'text',
      placeholder: '搜索衣服、裤子、裙子',
      'aria-label': '搜索衣柜'
    });

    searchInput.addEventListener('input', function (event) {
      state.searchQuery = event.target.value;
      renderList();
    });

    var searchHeader = el('div', { class: 'section-block', style: { paddingTop: '14px' } }, [
      el('div', { class: 'search-header' }, [
        el(
          'button',
          {
            class: 'search-header__icon-button',
            type: 'button',
            'aria-label': '执行搜索',
            html: HW.icon('magnifyingglass', 18),
            onclick: function () {
              openUnifiedSearch();
            }
          },
          []
        ),
        searchInput
      ])
    ]);

    /* ---------- 分类筛选 ---------- */
    var filterHost = el('div', { class: 'section-block', style: { paddingTop: '0' } });

    function renderFilters() {
      ui.clear(filterHost);
      var row = el('div', { class: 'chip-row' });

      models.WARDROBE_CATEGORY_FILTERS.forEach(function (filter) {
        var isActive = state.selectedCategoryLabel === filter.label;
        row.appendChild(
          el(
            'button',
            {
              class: 'chip' + (isActive ? ' chip--active' : ''),
              type: 'button',
              'aria-label': filter.label + (isActive ? '，已选中' : ''),
              onclick: function () {
                state.selectedCategoryLabel = filter.label;
                renderFilters();
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

      filterHost.appendChild(row);
    }

    /* ---------- 筛选提示条 ---------- */
    var noticeHost = el('div', { class: 'section-block' });

    function renderNotice() {
      ui.clear(noticeHost);
      noticeHost.appendChild(
        ui.savedFilterNotice(!!state.savedOutsideFilterId, function () {
          state.searchQuery = '';
          searchInput.value = '';
          state.selectedCategoryLabel = '全部';
          state.savedOutsideFilterId = '';
          renderFilters();
          renderList();
        })
      );
    }

    /* ---------- 列表 ---------- */
    function filteredItems() {
      var filter = models.WARDROBE_CATEGORY_FILTERS.filter(function (candidate) {
        return candidate.label === state.selectedCategoryLabel;
      })[0];
      var categories = filter ? filter.categories : null;
      var query = state.searchQuery.trim().toLowerCase();

      return state.clothingItems.filter(function (item) {
        if (categories && categories.indexOf(item.category) < 0) {
          return false;
        }
        if (query === '') {
          return true;
        }
        return (
          String(item.name).toLowerCase().indexOf(query) >= 0 ||
          (item.note !== undefined &&
            String(item.note).toLowerCase().indexOf(query) >= 0)
        );
      });
    }

    function cardAspectRatio(index) {
      if (index % 4 === 0) {
        return 0.73;
      }
      if (index % 4 === 1) {
        return 0.83;
      }
      return 0.82;
    }

    function renderList() {
      masonry.reset();
      var items = filteredItems();

      if (items.length === 0) {
        masonry.showEmpty(
          ui.wallEmptyState({
            icon: 'shirt',
            accessibilityText: '新增衣物',
            cardTitle: '先放入第一件衣服',
            cardDesc: '拍照或从相册选图后，按分类收进衣柜。',
            title: '点底部相机，选择照片后归类为衣柜',
            desc: '衣服会按图片检索流排在这里。',
            onClick: function () {
              HW.App.navigate(HW.App.RouteKind.ClothingEditor, models.AppMainTab.Wardrobe, {});
            }
          })
        );
        return;
      }

      items.forEach(function (item, index) {
        var aspectRatio = cardAspectRatio(index);
        var card = helpers.wallCard({
          aspectRatio: aspectRatio,
          photoId: item.photoUris && item.photoUris.length ? item.photoUris[0] : '',
          placeholderIcon: 'picture',
          badgeIcon: helpers.categoryIconName(item.category),
          title: helpers.displayItemTitle(item),
          meta: helpers.displayItemMeta(item),
          accessibilityText: helpers.displayItemTitle(item),
          onClick: function () {
            if (state.deleteOverlayId) {
              state.deleteOverlayId = '';
              renderList();
              return;
            }
            openDetail(item);
          },
          onLongPress: function () {
            showDeleteOverlay(item, card);
          }
        });

        if (state.deleteOverlayId === item.id) {
          var media = card.querySelector('.wall-card__media');
          helpers.attachDeleteOverlay(media, {
            label: '删除衣物',
            deleting: state.deletingId === item.id,
            onDelete: function () {
              confirmDelete(item);
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

    function showDeleteOverlay(item, card) {
      if (state.deletingId) {
        return;
      }
      state.deleteOverlayId = item.id;
      renderList();
    }

    function confirmDelete(item) {
      ui.showConfirm({
        title: '删除衣物',
        message:
          '确定删除“' +
          helpers.displayItemTitle(item) +
          '”吗？本地照片会一并移除，关联穿搭将解除该单品。',
        confirmText: '删除',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) {
          state.deleteOverlayId = '';
          renderList();
          return;
        }
        state.deletingId = item.id;
        renderList();

        ctx.repositories.clothing
          .deleteClothing(item.id)
          .then(function () {
            state.clothingItems = state.clothingItems.filter(function (candidate) {
              return candidate.id !== item.id;
            });
            state.deleteOverlayId = '';
            state.deletingId = '';
            renderList();
            ctx.showToast('衣物已删除');
          })
          .catch(function (error) {
            state.deleteOverlayId = '';
            state.deletingId = '';
            renderList();
            ctx.showToast(
              HW.utils.userFacingError(error, '删除衣物失败'),
              true
            );
          });
      });
    }

    /* ---------- 详情 / 编辑 ---------- */
    function openDetail(item) {
      HW.App.navigate(HW.App.RouteKind.ClothingDetail, models.AppMainTab.Wardrobe, {
        clothingId: item.id
      });
    }

    function openUnifiedSearch() {
      HW.App.navigate(HW.App.RouteKind.Search, models.AppMainTab.Wardrobe, {
        query: state.searchQuery
      });
    }

    /* ---------- 数据加载 ---------- */
    function load() {
      state.loading = true;
      state.errorMessage = '';
      renderBody();

      ctx.repositories.clothing
        .listClothing()
        .then(function (items) {
          state.clothingItems = items;
          state.loading = false;
          renderBody();
        })
        .catch(function (error) {
          state.loading = false;
          state.errorMessage = HW.utils.userFacingError(error, '加载衣柜失败');
          renderBody();
        });
    }

    /* ---------- 主体渲染 ---------- */
    var bodyHost = el('div', { class: 'page__body page__body--column' });

    function renderBody() {
      ui.clear(bodyHost);

      if (state.loading) {
        bodyHost.appendChild(
          el('div', {
            class: 'text-secondary',
            style: { padding: '20px', fontSize: '14px' },
            text: '正在加载衣柜...'
          })
        );
        return;
      }

      if (state.errorMessage) {
        bodyHost.appendChild(
          el('div', { class: 'row', style: { gap: '8px', padding: '14px 20px' } }, [
            el('div', {
              class: 'text-danger grow',
              style: { fontSize: '14px' },
              text: state.errorMessage
            }),
            el('button', {
              class: 'btn btn--sm',
              type: 'button',
              style: { width: 'auto', height: '34px', padding: '0 16px', fontSize: '13px' },
              text: '重试',
              onclick: load
            })
          ])
        );
        return;
      }

      bodyHost.appendChild(noticeHost);
      bodyHost.appendChild(listHost);
      renderNotice();
      renderList();
    }

    root.appendChild(searchHeader);
    root.appendChild(filterHost);
    root.appendChild(bodyHost);

    renderFilters();
    renderBody();
    load();

    return {
      el: root,
      /** 保存衣物后回写列表 */
      upsertClothingItem: function (savedItem) {
        var index = -1;
        state.clothingItems.forEach(function (item, i) {
          if (item.id === savedItem.id) {
            index = i;
          }
        });
        if (index >= 0) {
          state.clothingItems[index] = savedItem;
        } else {
          state.clothingItems.unshift(savedItem);
        }

        /* 判断保存后是否仍落在当前筛选内 */
        var filter = models.WARDROBE_CATEGORY_FILTERS.filter(function (candidate) {
          return candidate.label === state.selectedCategoryLabel;
        })[0];
        var categories = filter ? filter.categories : null;
        var query = state.searchQuery.trim().toLowerCase();
        var matchesCategory = !categories || categories.indexOf(savedItem.category) >= 0;
        var matchesQuery =
          query === '' ||
          String(savedItem.name).toLowerCase().indexOf(query) >= 0 ||
          (savedItem.note !== undefined &&
            String(savedItem.note).toLowerCase().indexOf(query) >= 0);

        state.savedOutsideFilterId =
          matchesCategory && matchesQuery ? '' : savedItem.id;

        renderNotice();
        renderList();
      },
      destroy: function () {}
    };
  };
})(window);
