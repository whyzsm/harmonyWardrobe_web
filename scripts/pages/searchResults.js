/* 衣不缺 Web 版 — 统一搜索 / SearchResultsPage
   对应鸿蒙端 entry/src/main/ets/pages/SearchResultsPage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  var SEARCH_SCOPES = [
    { key: 'all', label: '全部' },
    { key: 'clothes', label: '衣柜' },
    { key: 'shops', label: '逛店' },
    { key: 'outfits', label: '穿搭' }
  ];

  HW.pages.searchResults = function (route, ctx) {
    var state = {
      searchText: route.params.query || '',
      activeQuery: (route.params.query || '').trim(),
      selectedScope: route.params.scope || 'all',
      initialScope: route.params.scope || '',
      historyTerms: [],
      results: [],
      visualResults: [],
      isSearching: false,
      errorMessage: '',
      clothingItems: [],
      outfits: []
    };

    var root = el('div', { class: 'page' });
    var headerHost = el('div');
    var bodyHost = el('div', { class: 'page__body' });

    /* ---------- 作用域 ---------- */
    function availableScopes() {
      if (state.initialScope) {
        return [
          {
            key: state.initialScope,
            label: models.SEARCH_ENTITY_LABEL[state.initialScope] || '全部'
          }
        ];
      }
      return SEARCH_SCOPES;
    }

    function matchesInitialScope(entityType) {
      if (!state.initialScope) {
        return true;
      }
      return entityType === state.initialScope;
    }

    function resultMatchesScope(entityType) {
      if (state.initialScope) {
        return entityType === state.initialScope;
      }
      if (state.selectedScope === 'all') {
        return true;
      }
      if (state.selectedScope === 'clothes') {
        return entityType === models.SearchEntityType.Clothing;
      }
      if (state.selectedScope === 'shops') {
        return (
          entityType === models.SearchEntityType.Store ||
          entityType === models.SearchEntityType.StoreVisit
        );
      }
      if (state.selectedScope === 'outfits') {
        return entityType === models.SearchEntityType.Outfit;
      }
      return false;
    }

    function filteredVisualResults() {
      return state.visualResults.filter(function (result) {
        return resultMatchesScope(result.entityType);
      });
    }

    /* ---------- 视觉结果 ---------- */
    function buildVisualResults(results, clothingItems, outfits) {
      return results.map(function (result) {
        var entry = {
          entityType: result.entityType,
          entityId: result.entityId,
          title: result.title,
          subtitle: models.SEARCH_ENTITY_LABEL[result.entityType] || '',
          photoUri: ''
        };

        if (result.entityType === models.SearchEntityType.Clothing) {
          var item = clothingItems.filter(function (candidate) {
            return candidate.id === result.entityId;
          })[0];
          if (item) {
            var categoryLabel =
              models.CLOTHING_CATEGORY_LABEL[item.category] ||
              models.CLOTHING_CATEGORY_LABEL.Top;
            entry.title = helpers.displayItemTitle(item);
            var note = (item.note || '').trim();
            entry.subtitle = note.length > 0 ? categoryLabel + ' · ' + note : categoryLabel;
            entry.photoUri = (item.photoUris || [])[0] || '';
          }
        } else if (result.entityType === models.SearchEntityType.Outfit) {
          var outfit = outfits.filter(function (candidate) {
            return candidate.id === result.entityId;
          })[0];
          if (outfit) {
            entry.title = result.title;
            var count = (outfit.clothingItemIds || []).length;
            var note = (outfit.note || '').trim();
            entry.subtitle =
              note.length > 0 ? count + ' 件单品 · ' + note : count + ' 件单品';
            entry.photoUri = (outfit.photoUris || [])[0] || '';
          }
        }

        return entry;
      });
    }

    /* ---------- 搜索 ---------- */
    function performSearch(query) {
      if (!query || query.trim().length === 0) {
        state.results = [];
        state.visualResults = [];
        renderBody();
        return;
      }

      state.isSearching = true;
      state.errorMessage = '';
      renderBody();

      ctx.repositories.search
        .search(query, models.MAX_SEARCH_LIMIT)
        .then(function (results) {
          var supported = results.filter(function (result) {
            return (
              (models.SEARCH_ENTITY_LABEL[result.entityType] || '').length > 0 &&
              matchesInitialScope(result.entityType)
            );
          });

          return Promise.all([
            ctx.repositories.clothing.listClothing(),
            ctx.repositories.outfit.listOutfits()
          ]).then(function (data) {
            state.results = supported;
            state.clothingItems = data[0];
            state.outfits = data[1];
            state.visualResults = buildVisualResults(supported, data[0], data[1]);
            state.isSearching = false;
            renderBody();
          });
        })
        .catch(function (error) {
          state.errorMessage = HW.utils.userFacingError(error, '搜索失败');
          state.visualResults = [];
          state.isSearching = false;
          renderBody();
        });
    }

    function submitSearch(term) {
      if (term && term.length > 0) {
        state.searchText = term;
      }
      var trimmed = state.searchText.trim();
      var nextQuery = trimmed.length > 0 ? trimmed : models.DEFAULT_SEARCH_TERM;
      state.searchText = nextQuery;
      state.activeQuery = nextQuery;
      state.errorMessage = '';

      var nextHistory = [nextQuery].concat(
        state.historyTerms.filter(function (item) {
          return item !== nextQuery;
        })
      );
      state.historyTerms = nextHistory.slice(0, models.MAX_HISTORY_TERMS);

      performSearch(nextQuery);
    }

    function clearSearch() {
      state.searchText = '';
      state.activeQuery = '';
      state.results = [];
      state.visualResults = [];
      state.errorMessage = '';
      renderBody();
    }

    /* ---------- 打开结果 ---------- */
    function openResult(result) {
      ctx.openSearchTarget(result.entityType, result.entityId, result.title);
    }

    /* ---------- 渲染：页头 ---------- */
    function renderHeader() {
      ui.clear(headerHost);

      var input = el('input', {
        class: 'unified-search-header__input',
        type: 'text',
        placeholder: '搜索衣服、商场、穿搭',
        'aria-label': '搜索衣服、商场、穿搭'
      });
      input.value = state.searchText;
      input.addEventListener('input', function (event) {
        state.searchText = event.target.value;
        if (state.searchText.trim().length === 0) {
          clearSearch();
        }
      });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          submitSearch();
        }
      });

      var scopeRow = el('div', { class: 'scope-row' });
      availableScopes().forEach(function (scope) {
        var isActive = state.selectedScope === scope.key;
        scopeRow.appendChild(
          el(
            'button',
            {
              class: 'scope-tab' + (isActive ? ' scope-tab--active' : ''),
              type: 'button',
              'aria-label': scope.label + (isActive ? '，已选中' : ''),
              onclick: function () {
                state.selectedScope = scope.key;
                renderHeader();
                renderBody();
              }
            },
            [
              el('span', { class: 'scope-tab__label', text: scope.label }),
              el('span', { class: 'scope-tab__underline' })
            ]
          )
        );
      });

      headerHost.appendChild(
        el('div', { class: 'unified-search-header' }, [
          el('div', { class: 'unified-search-header__row' }, [
            el(
              'button',
              {
                class: 'unified-search-header__back',
                type: 'button',
                'aria-label': '返回上一页',
                html: HW.icon('arrow_left', 22),
                onclick: function () {
                  HW.App.back();
                }
              },
              []
            ),
            el('div', { class: 'unified-search-header__field' }, [
              input,
              state.searchText.length > 0
                ? el(
                    'button',
                    {
                      class: 'unified-search-header__clear',
                      type: 'button',
                      'aria-label': '清空搜索',
                      html: HW.icon('xmark', 15),
                      onclick: clearSearch
                    },
                    []
                  )
                : null
            ]),
            el('button', {
              class: 'unified-search-header__submit',
              type: 'button',
              text: '搜索',
              onclick: function () {
                submitSearch();
              }
            })
          ]),
          scopeRow
        ])
      );
    }

    /* ---------- 渲染：主体 ---------- */
    function renderBody() {
      ui.clear(bodyHost);

      if (!state.activeQuery) {
        renderIdle();
        return;
      }

      if (state.isSearching) {
        renderLoading();
        return;
      }

      if (state.errorMessage) {
        renderError();
        return;
      }

      renderResults();
    }

    function renderIdle() {
      var wrap = el('div', {
        class: 'stack',
        style: { padding: '14px 20px 36px', gap: '28px' }
      });

      var historyBlock = el('div', { class: 'stack', style: { gap: '12px' } }, [
        el('div', { class: 'row row--between' }, [
          el('div', { style: { fontSize: '20px' }, text: '历史记录' }),
          el(
            'button',
            {
              class: 'icon-button',
              type: 'button',
              'aria-label': '清空历史记录',
              html: HW.icon('trash', 20),
              style: { width: '34px', height: '34px', color: 'var(--text-secondary)' },
              onclick: function () {
                state.historyTerms = [];
                renderBody();
              }
            },
            []
          )
        ])
      ]);

      if (state.historyTerms.length > 0) {
        var chipWrap = el('div', {
          style: { display: 'flex', flexWrap: 'wrap', gap: '10px' }
        });
        state.historyTerms.forEach(function (term) {
          chipWrap.appendChild(
            el('button', {
              class: 'chip chip--round',
              type: 'button',
              style: {
                background: 'var(--bg-default)',
                borderColor: 'var(--border-light)',
                color: 'var(--text-primary)'
              },
              text: term,
              onclick: function () {
                submitSearch(term);
              }
            })
          );
        });
        historyBlock.appendChild(chipWrap);
      }

      wrap.appendChild(historyBlock);
      bodyHost.appendChild(wrap);
    }

    function renderLoading() {
      var list = el('div', {
        style: { padding: '14px 20px 24px' }
      });
      for (var i = 0; i < 4; i += 1) {
        list.appendChild(
          el('div', {
            class: 'skeleton-row',
            'aria-label': '搜索结果加载占位 ' + (i + 1)
          }, [
            el('div', { class: 'skeleton-row__thumb' }),
            el('div', { class: 'skeleton-row__text' }, [
              el('div', { class: 'skeleton-row__bar', style: { width: '72%' } }),
              el('div', { class: 'skeleton-row__bar skeleton-row__bar--short' })
            ])
          ])
        );
      }
      bodyHost.appendChild(list);
    }

    function renderError() {
      bodyHost.appendChild(
        el('div', {
          class: 'stack stack--md',
          style: { padding: '28px 20px 24px' }
        }, [
          el('div', {
            class: 'text-danger',
            style: { fontSize: '14px' },
            text: state.errorMessage
          }),
          el('button', {
            class: 'btn btn--sm',
            type: 'button',
            text: '重试',
            onclick: function () {
              performSearch(state.activeQuery);
            }
          })
        ])
      );
    }

    function emptyResultTitle() {
      if (state.initialScope) {
        return '没有找到「' + state.activeQuery + '」';
      }
      if (state.selectedScope === 'clothes') {
        return '没有找到相关衣柜';
      }
      if (state.selectedScope === 'shops') {
        return '没有找到相关逛店记录';
      }
      if (state.selectedScope === 'outfits') {
        return '没有找到相关穿搭';
      }
      return '没有找到「' + state.activeQuery + '」';
    }

    function emptyResultDescription() {
      if (state.initialScope) {
        return '换个名称、门店、分类或备注关键词。';
      }
      if (state.selectedScope === 'clothes') {
        return '换个衣柜名称、分类或备注。';
      }
      if (state.selectedScope === 'shops') {
        return '换个商场、品牌或试穿关键词。';
      }
      if (state.selectedScope === 'outfits') {
        return '换个场景、穿搭名称或备注。';
      }
      return '换个名称、商场、分类或备注关键词。';
    }

    function renderResults() {
      var items = filteredVisualResults();

      if (items.length === 0) {
        bodyHost.appendChild(
          el('div', {
            class: 'stack',
            style: { padding: '28px 20px 24px', gap: '10px' }
          }, [
            el('div', { style: { fontSize: '18px' }, text: emptyResultTitle() }),
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '13px' },
              text: emptyResultDescription()
            })
          ])
        );
        return;
      }

      var list = el('div', { style: { padding: '14px 20px 24px' } });

      items.forEach(function (result) {
        var thumb = el('div', { class: 'result-card__thumb' });
        if (result.photoUri) {
          thumb.appendChild(
            helpers.photoImage(result.photoUri, 'result-card__thumb-image', result.title)
          );
        } else {
          var iconName = 'store_fill';
          if (result.entityType === models.SearchEntityType.Clothing) {
            iconName = 'shirt';
          } else if (result.entityType === models.SearchEntityType.Outfit) {
            iconName = 'hanger_and_towels';
          } else if (
            result.entityType === models.SearchEntityType.WearLog ||
            result.entityType === models.SearchEntityType.Wishlist
          ) {
            iconName = 'person';
          }
          thumb.appendChild(el('span', { html: HW.icon(iconName, 24) }));
        }

        var card = el(
          'button',
          {
            class: 'result-card',
            type: 'button',
            onclick: function () {
              openResult(result);
            }
          },
          [
            thumb,
            el('div', { class: 'result-card__body' }, [
              el('div', { class: 'result-card__title ellipsis', text: result.title }),
              el('div', { class: 'result-card__subtitle ellipsis', text: result.subtitle })
            ]),
            el('div', {
              class: 'result-card__badge',
              text: models.SEARCH_ENTITY_LABEL[result.entityType] || ''
            })
          ]
        );

        list.appendChild(el('div', { style: { marginBottom: '10px' } }, [card]));
      });

      bodyHost.appendChild(list);
      helpers.resolvePhotos(list);
    }

    root.appendChild(headerHost);
    root.appendChild(bodyHost);

    renderHeader();
    renderBody();

    if (state.activeQuery.length > 0) {
      performSearch(state.activeQuery);
    }

    return { el: root, destroy: function () {} };
  };
})(window);
