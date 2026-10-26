/* 衣不缺 Web 版 — 穿搭页 / OutfitsPage
   对应鸿蒙端 entry/src/main/ets/pages/OutfitsPage.ets。
   根 Column：space 14，无 padding（子元素自带），bg bgDefault。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  HW.pages.outfits = function (route, ctx) {
    var state = {
      outfits: [],
      categories: [],
      clothingItems: [],
      searchQuery: '',
      selectedCategoryId: '',
      loading: true,
      errorMessage: '',
      savedOutsideFilterId: '',
      deleteOverlayId: '',
      deletingId: ''
    };

    var root = el('div', {
      class: 'page',
      style: { gap: '14px', alignItems: 'stretch' }
    });
    var headerHost = el('div', { style: { padding: '14px 20px 0' } });
    var filterHost = el('div', {
      style: { padding: '0 20px', width: '100%', height: '44px' }
    });
    var bodyHost = el('div', { class: 'page__body page__body--column' });
    var masonry = helpers.createMasonry({ columns: 2, rowGap: 8, inset: true });
    var listHost = masonry.container;

    /* ---------- 搜索头 ---------- */
    function buildSearchHeader() {
      var searchInput = el('input', {
        class: 'search-header__input',
        type: 'text',
        placeholder: '搜索穿搭、分类、备注',
        'aria-label': '搜索穿搭'
      });
      searchInput.value = state.searchQuery;
      searchInput.addEventListener('input', function (event) {
        state.searchQuery = event.target.value;
        renderList();
      });

      return el('div', { class: 'search-header' }, [
        el(
          'button',
          {
            class: 'search-header__icon-button',
            type: 'button',
            'aria-label': '执行搜索',
            html: HW.icon('magnifyingglass', 18),
            onclick: function () {
              HW.App.navigate(HW.App.RouteKind.Search, models.AppMainTab.Outfit, {
                query: state.searchQuery
              });
            }
          },
          []
        ),
        searchInput
      ]);
    }

    /* ---------- 分类筛选（宽度随内容） ---------- */
    function renderFilters() {
      ui.clear(filterHost);
      var row = el('div', {
        class: 'row',
        style: { gap: '8px', height: '44px', overflowX: 'auto', scrollbarWidth: 'none' }
      });

      function addChip(label, categoryId, iconName) {
        var isActive = state.selectedCategoryId === categoryId;
        row.appendChild(
          el(
            'button',
            {
              class: 'chip-filter' + (isActive ? ' chip-filter--active' : ''),
              type: 'button',
              'aria-label': label + (isActive ? '，已选中' : ''),
              onclick: function () {
                state.selectedCategoryId = categoryId;
                renderFilters();
                renderList();
              }
            },
            [
              el('span', { class: 'chip-filter__icon', html: HW.icon(iconName, 17) }),
              el('span', { text: label })
            ]
          )
        );
      }

      addChip('全部', '', 'hanger_and_towels');
      state.categories.forEach(function (category) {
        addChip(category.name, category.id, 'clothing');
      });

      filterHost.appendChild(row);
    }

    /* ---------- 提示条 ---------- */
    var noticeHost = el('div', { style: { padding: '0 20px', width: '100%' } });

    function renderNotice() {
      ui.clear(noticeHost);
      noticeHost.appendChild(
        ui.savedFilterNotice(!!state.savedOutsideFilterId, function () {
          state.searchQuery = '';
          state.selectedCategoryId = '';
          state.savedOutsideFilterId = '';
          renderHeader();
          renderFilters();
          renderList();
        })
      );
    }

    /* ---------- 引导卡 ---------- */
    function renderGuideCard() {
      var hasClothing = state.clothingItems.length > 0;
      return el('div', { style: { padding: '0 20px', width: '100%' } }, [
        el('div', { class: 'guide-card' }, [
          el('div', { class: 'guide-card__text' }, [
            el('div', {
              class: 'guide-card__title',
              text: hasClothing ? '从已有单品开始搭配' : '先添加衣物再创建穿搭'
            }),
            el('div', {
              class: 'guide-card__desc',
              text: hasClothing
                ? '选择衣柜里的真实单品，组合适合自己的穿搭。'
                : '衣柜中有单品后，就可以在这里创建搭配。'
            })
          ]),
          el('div', { class: 'guide-card__badge', text: state.clothingItems.length + ' 件' })
        ])
      ]);
    }

    /* ---------- 过滤 ---------- */
    function filteredOutfits() {
      var query = state.searchQuery.trim().toLowerCase();
      return state.outfits.filter(function (outfit) {
        if (state.selectedCategoryId) {
          if ((outfit.categoryIds || []).indexOf(state.selectedCategoryId) < 0) {
            return false;
          }
        }
        if (query === '') {
          return true;
        }
        var searchable = (
          (outfit.title || '') +
          ' ' +
          (outfit.categoryNames || []).join(' ') +
          ' ' +
          (outfit.note || '')
        ).toLowerCase();
        return searchable.indexOf(query) >= 0;
      });
    }

    /* outfitStackAspectRatio(index)：index%4===2 → 1/1.18，其余 1/1.48 */
    function outfitStackAspectRatio(index) {
      return index % 4 === 2 ? 1 / 1.18 : 1 / 1.48;
    }

    /* ---------- 列表 ---------- */
    function renderList() {
      masonry.reset();
      var items = filteredOutfits();

      if (state.outfits.length === 0) {
        masonry.showEmpty(
          ui.wallEmptyState({
            icon: 'hanger_and_towels',
            accessibilityText: '新增穿搭',
            cardTitle: '还没有穿搭',
            cardDesc: '拍照或从相册选图后，按分类收进穿搭。',
            title: '点底部相机，选择照片后归类为穿搭',
            desc: '穿搭会按图片组合流排在这里。',
            onClick: function () {
              HW.App.navigate(HW.App.RouteKind.OutfitEditor, models.AppMainTab.Outfit, {});
            }
          })
        );
        return;
      }

      if (items.length === 0) {
        masonry.showEmpty(
          el('div', {}, [
            ui.wallEmptyState({
              icon: 'hanger_and_towels',
              cardTitle: '暂时没有这类穿搭',
              cardDesc: '当前分类下还没有匹配的穿搭。',
              title: '换一个分类看看，或查看全部穿搭',
              desc: '已有穿搭会继续按图片组合流排在这里。'
            }),
            el('div', { style: { paddingBottom: '20px' } }, [
              el('button', {
                class: 'btn btn--sm',
                type: 'button',
                style: { width: 'auto', padding: '0 24px', fontSize: '14px' },
                text: '查看全部',
                onclick: function () {
                  state.selectedCategoryId = '';
                  renderFilters();
                  renderList();
                }
              })
            ])
          ])
        );
        return;
      }

      items.forEach(function (outfit, index) {
        var photoUris = helpers.displayPhotoUris(outfit, state.clothingItems);
        var categoryText =
          (outfit.categoryNames || []).length > 0
            ? outfit.categoryNames.join('、')
            : '未分类';
        var meta =
          (outfit.note || '').trim().length > 0
            ? outfit.note.trim()
            : (outfit.clothingItemIds || []).length + ' 件单品';

        var aspectRatio = outfitStackAspectRatio(index);
        var card = helpers.wallCard({
          layout: 'outfit',
          aspectRatio: aspectRatio,
          photoId: photoUris.length ? photoUris[0] : '',
          placeholderIcon: 'picture',
          placeholderIconSize: 24,
          placeholderTextSmall: true,
          photoCount: photoUris.length,
          title: helpers.displayOutfitTitle(outfit),
          category: categoryText,
          meta: meta,
          accessibilityText: helpers.displayOutfitTitle(outfit),
          onClick: function () {
            if (state.deleteOverlayId) {
              state.deleteOverlayId = '';
              renderList();
              return;
            }
            HW.App.navigate(HW.App.RouteKind.OutfitDetail, models.AppMainTab.Outfit, {
              outfitId: outfit.id
            });
          },
          onLongPress: function () {
            if (state.deletingId) {
              return;
            }
            state.deleteOverlayId = outfit.id;
            renderList();
          }
        });

        if (state.deleteOverlayId === outfit.id) {
          helpers.attachDeleteOverlay(card.querySelector('.wall-card__media'), {
            label: '删除穿搭',
            deleting: state.deletingId === outfit.id,
            onDelete: function () {
              confirmDelete(outfit);
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

    function confirmDelete(outfit) {
      ui.showConfirm({
        title: '删除穿搭',
        message:
          '确定删除“' +
          helpers.displayOutfitTitle(outfit) +
          '”吗？穿搭照片会一并移除，已有穿着记录将保留但不再关联这套穿搭。',
        confirmText: '删除',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) {
          state.deleteOverlayId = '';
          renderList();
          return;
        }
        state.deletingId = outfit.id;
        renderList();

        ctx.repositories.outfit
          .deleteOutfit(outfit.id)
          .then(function () {
            state.outfits = state.outfits.filter(function (candidate) {
              return candidate.id !== outfit.id;
            });
            state.deleteOverlayId = '';
            state.deletingId = '';
            renderList();
            ctx.showToast('穿搭已删除');
          })
          .catch(function (error) {
            state.deleteOverlayId = '';
            state.deletingId = '';
            renderList();
            ctx.showToast(HW.utils.userFacingError(error, '删除穿搭失败'), true);
          });
      });
    }

    /* ---------- 数据加载 ---------- */
    function ensureSelectedCategoryExists() {
      if (
        state.selectedCategoryId &&
        !state.categories.some(function (category) {
          return category.id === state.selectedCategoryId;
        })
      ) {
        state.selectedCategoryId = '';
      }
    }

    function load() {
      state.loading = true;
      state.errorMessage = '';
      renderBody();

      Promise.all([
        ctx.repositories.outfit.listOutfits(),
        ctx.repositories.outfit.listOutfitCategories(),
        ctx.repositories.clothing.listClothing()
      ])
        .then(function (results) {
          state.outfits = results[0];
          state.categories = results[1];
          state.clothingItems = results[2];
          state.loading = false;
          ensureSelectedCategoryExists();
          renderAll();
        })
        .catch(function (error) {
          state.loading = false;
          state.errorMessage = HW.utils.userFacingError(error, '加载穿搭失败');
          renderBody();
        });
    }

    /* ---------- 渲染 ---------- */
    function renderHeader() {
      ui.clear(headerHost);
      headerHost.appendChild(buildSearchHeader());
    }

    function renderBody() {
      ui.clear(bodyHost);

      if (state.loading) {
        bodyHost.appendChild(
          el('div', { class: 'loading-block', style: { flex: '1' } }, [
            el('div', { class: 'spinner' }),
            el('div', { class: 'loading-block__text', text: '正在加载穿搭...' })
          ])
        );
        return;
      }

      if (state.errorMessage) {
        bodyHost.appendChild(
          el('div', {
            class: 'stack stack--md',
            style: { flex: '1', justifyContent: 'center', padding: '0 20px' }
          }, [
            el('div', {
              class: 'text-danger',
              style: { fontSize: '14px' },
              text: state.errorMessage
            }),
            el('button', {
              class: 'btn btn--sm',
              type: 'button',
              style: { width: 'auto', padding: '0 24px' },
              text: '重试',
              onclick: load
            })
          ])
        );
        return;
      }

      bodyHost.appendChild(noticeHost);
      bodyHost.appendChild(renderGuideCard());
      bodyHost.appendChild(listHost);
      renderNotice();
      renderList();
    }

    function renderAll() {
      renderHeader();
      renderFilters();
      renderBody();
    }

    root.appendChild(headerHost);
    root.appendChild(filterHost);
    root.appendChild(bodyHost);

    renderAll();
    load();

    return { el: root, destroy: function () {} };
  };
})(window);
