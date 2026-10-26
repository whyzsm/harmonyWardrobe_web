/* 衣不缺 Web 版 — 穿搭详情 / OutfitDetailPage
   对应鸿蒙端 entry/src/main/ets/pages/OutfitDetailPage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  HW.pages.outfitDetail = function (route, ctx) {
    var state = {
      outfit: undefined,
      clothingItems: [],
      loading: true,
      isDeleting: false,
      deleteErrorMessage: ''
    };

    var root = el('div', { class: 'page' });

    function categoryText(outfit) {
      var names = (outfit.categoryNames || []).join('、');
      return names.length > 0 ? names : '未分类';
    }

    function photoCountText(outfit) {
      if (!outfit || !outfit.photoUris || outfit.photoUris.length === 0) {
        return '暂无照片';
      }
      return outfit.photoUris.length + ' 张照片';
    }

    function renderNotFound() {
      return [
        ui.secondaryPageHeader({
          title: '穿搭详情',
          backAccessibilityText: '返回穿搭',
          onBack: function () {
            HW.App.back();
          }
        }),
        el(
          'div',
          {
            class: 'stack stack--lg',
            style: {
              flex: '1',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }
          },
          [
            el('div', { style: { fontSize: '24px' }, text: '穿搭不存在' }),
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '14px' },
              text: '可能已经被删除，请返回穿搭重新选择。'
            })
          ]
        )
      ];
    }

    function confirmDelete() {
      ui.showConfirm({
        title: '删除穿搭',
        message: '确定要删除这套穿搭吗？照片也会一并移除。',
        confirmText: '删除',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) {
          return;
        }
        state.isDeleting = true;
        state.deleteErrorMessage = '';
        render();

        ctx.repositories.outfit
          .deleteOutfit(state.outfit.id)
          .then(function () {
            HW.App.back();
            ctx.showToast('穿搭已删除');
          })
          .catch(function (error) {
            state.isDeleting = false;
            state.deleteErrorMessage = HW.utils.userFacingError(error, '删除穿搭失败');
            render();
          });
      });
    }

    function renderContent() {
      var outfit = state.outfit;
      var photoUris = helpers.displayPhotoUris(outfit, state.clothingItems);
      var scroll = el('div', { class: 'page__body scroll-y' });
      var inner = el('div', { class: 'stack stack--lg', style: { padding: '8px 20px 28px' } });

      /* 主图 */
      var hero = el('div', { class: 'hero-photo' });
      if (photoUris.length > 0) {
        hero.appendChild(
          helpers.photoCarousel(photoUris, {
            alt: helpers.displayOutfitTitle(outfit),
            className: ''
          })
        );
        hero.addEventListener('click', function () {
          ctx.showPhotoPreview({
            photos: photoUris,
            index: 0,
            title: helpers.displayOutfitTitle(outfit)
          });
        });
      } else {
        hero.appendChild(
          el('div', { class: 'hero-photo__empty' }, [
            el('span', { html: HW.icon('hanger_and_towels', 48) }),
            el('span', { class: 'hero-photo__empty-text', text: '暂无照片' })
          ])
        );
      }
      inner.appendChild(hero);

      /* 摘要卡 */
      var summary = el('div', { class: 'card stack stack--md' }, [
        el('div', { class: 'row row--top' }, [
          el('div', { class: 'stack', style: { flex: '1', minWidth: '0', gap: '4px' } }, [
            el('div', {
              style: { fontSize: '22px', lineHeight: '28px' },
              text: helpers.displayOutfitTitle(outfit)
            }),
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '13px' },
              text: categoryText(outfit) + ' · ' + photoCountText(outfit)
            })
          ]),
          el('div', {
            class: 'pill',
            text: (outfit.clothingItemIds || []).length + ' 件单品'
          })
        ])
      ]);

      var note = (outfit.note || '').trim();
      if (note.length > 0) {
        summary.appendChild(
          el('div', {
            style: {
              width: '100%',
              padding: '12px',
              fontSize: '15px',
              background: 'var(--card-soft-gray)',
              borderRadius: 'var(--radius-lg)'
            },
            text: note
          })
        );
      }
      inner.appendChild(summary);

      /* 搭配单品 */
      var itemsCard = el('div', { class: 'card stack stack--md' }, [
        el('div', { class: 'card__title', text: '搭配单品' })
      ]);

      var linkedItems = (outfit.clothingItemIds || [])
        .map(function (clothingId) {
          return state.clothingItems.filter(function (item) {
            return item.id === clothingId;
          })[0];
        })
        .filter(function (item) {
          return item !== undefined;
        });

      if (linkedItems.length === 0) {
        itemsCard.appendChild(
          el('div', {
            style: {
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              padding: '0 14px',
              fontSize: '14px',
              color: 'var(--text-secondary)',
              background: 'var(--card-soft-gray)',
              borderRadius: 'var(--radius-lg)'
            },
            text: '暂未关联衣柜单品'
          })
        );
      } else {
        linkedItems.forEach(function (item) {
          var row = el('div', { class: 'row', style: { height: '52px', gap: '12px' } });
          if (item.photoUris && item.photoUris.length > 0) {
            row.appendChild(
              helpers.photoImage(item.photoUris[0], 'list-row__thumb list-row__thumb--sm', item.name)
            );
          } else {
            row.appendChild(
              el('div', { class: 'list-row__thumb-placeholder list-row__thumb-placeholder--sm' }, [
                el('span', { html: HW.icon('shirt', 20) })
              ])
            );
          }
          row.appendChild(
            el('div', {
              class: 'grow ellipsis',
              style: { fontSize: '15px' },
              text: item.name
            })
          );
          itemsCard.appendChild(row);
        });
      }
      inner.appendChild(itemsCard);

      /* 删除 */
      var deleteButton = el('button', {
        class: 'btn btn--danger',
        type: 'button',
        text: '删除穿搭',
        disabled: state.isDeleting,
        onclick: confirmDelete
      });
      if (state.isDeleting) {
        deleteButton.innerHTML = '';
        deleteButton.appendChild(el('div', { class: 'spinner spinner--light' }));
      }

      var deleteWrap = el('div', { class: 'stack stack--sm' }, [deleteButton]);
      if (state.deleteErrorMessage) {
        deleteWrap.appendChild(
          el('div', {
            class: 'text-danger',
            style: { width: '100%', fontSize: '13px', textAlign: 'center' },
            text: state.deleteErrorMessage
          })
        );
      }
      inner.appendChild(deleteWrap);

      scroll.appendChild(inner);
      helpers.resolvePhotos(scroll);
      return scroll;
    }

    function render() {
      ui.clear(root);

      if (state.loading) {
        root.appendChild(
          ui.secondaryPageHeader({
            title: '穿搭详情',
            backAccessibilityText: '返回穿搭',
            onBack: function () {
              HW.App.back();
            }
          })
        );
        root.appendChild(ui.loadingBlock(''));
        return;
      }

      if (!state.outfit) {
        renderNotFound().forEach(function (node) {
          root.appendChild(node);
        });
        return;
      }

      root.appendChild(
        ui.secondaryPageHeader({
          title: '穿搭详情',
          showEditAction: true,
          backAccessibilityText: '返回穿搭',
          onBack: function () {
            HW.App.back();
          },
          onEdit: function () {
            HW.App.navigate(HW.App.RouteKind.OutfitEditor, models.AppMainTab.Outfit, {
              outfitId: state.outfit.id
            });
          }
        })
      );
      root.appendChild(renderContent());
    }

    Promise.all([
      ctx.repositories.outfit.getOutfitById(route.params.outfitId),
      ctx.repositories.clothing.listClothing()
    ])
      .then(function (results) {
        state.outfit = results[0];
        state.clothingItems = results[1];
        state.loading = false;
        render();
      })
      .catch(function () {
        state.outfit = undefined;
        state.loading = false;
        render();
      });

    return { el: root, destroy: function () {} };
  };
})(window);
