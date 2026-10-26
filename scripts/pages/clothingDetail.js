/* 衣不缺 Web 版 — 衣物详情 / ClothingDetailPage
   对应鸿蒙端 entry/src/main/ets/pages/ClothingDetailPage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  HW.pages.clothingDetail = function (route, ctx) {
    var state = {
      item: undefined,
      loading: true,
      deleteErrorMessage: '',
      isDeleting: false
    };

    var root = el('div', { class: 'page' });

    function categoryLabel(item) {
      if (!item) {
        return '衣物';
      }
      return models.CLOTHING_CATEGORY_LABEL[item.category] || '衣物';
    }

    function itemName(item) {
      if (!item) {
        return '衣物详情';
      }
      return helpers.displayItemTitle(item);
    }

    function photoCountText(item) {
      if (!item || !item.photoUris || item.photoUris.length === 0) {
        return '暂无照片';
      }
      return item.photoUris.length + ' 张照片';
    }

    function purchaseInfoHasContent(purchaseInfo) {
      if (!purchaseInfo) {
        return false;
      }
      return !!(
        (purchaseInfo.storeName && purchaseInfo.storeName.length) ||
        purchaseInfo.price !== undefined ||
        (purchaseInfo.purchaseDate && purchaseInfo.purchaseDate.length) ||
        (purchaseInfo.note && purchaseInfo.note.length)
      );
    }

    function renderNotFound() {
      return el('div', { class: 'page__body', style: { display: 'flex', flexDirection: 'column' } }, [
        ui.secondaryPageHeader({
          title: '衣物详情',
          backAccessibilityText: '返回衣柜',
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
            el('div', { style: { fontSize: '24px' }, text: '衣物不存在' }),
            el('div', { class: 'text-secondary', style: { fontSize: '14px' }, text: '可能已经被删除，请返回衣柜重新选择。' }),
            el('button', {
              class: 'btn btn--sm',
              type: 'button',
              style: { width: 'auto', padding: '0 24px' },
              text: '返回',
              onclick: function () {
                HW.App.back();
              }
            })
          ]
        )
      ]);
    }

    function renderContent() {
      var item = state.item;
      var scroll = el('div', { class: 'page__body scroll-y' });
      var inner = el('div', {
        class: 'stack stack--lg',
        style: { padding: '8px 20px 28px' }
      });

      /* ---- 主图 ---- */
      var hero = el('div', { class: 'hero-photo' });
      if (item.photoUris && item.photoUris.length > 0) {
        hero.appendChild(
          helpers.photoCarousel(item.photoUris, {
            activeIndex: 0,
            alt: itemName(item),
            className: ''
          })
        );
        hero.addEventListener('click', function () {
          ctx.showPhotoPreview({
            photos: item.photoUris,
            index: 0,
            title: itemName(item)
          });
        });
      } else {
        hero.appendChild(
          el('div', { class: 'hero-photo__empty' }, [
            el('span', { html: HW.icon('shirt', 48) }),
            el('span', { class: 'hero-photo__empty-text', text: '暂无照片' })
          ])
        );
      }
      inner.appendChild(hero);

      /* ---- 摘要卡 ---- */
      var summary = el('div', { class: 'card' }, [
        el('div', { class: 'row row--top' }, [
          el('div', { class: 'stack', style: { flex: '1', minWidth: '0', gap: '4px' } }, [
            el('div', { style: { fontSize: '22px', lineHeight: '28px' }, text: itemName(item) }),
            el('div', { class: 'text-secondary', style: { fontSize: '13px' }, text: photoCountText(item) })
          ]),
          el('div', { class: 'pill', text: categoryLabel(item) })
        ])
      ]);

      var note = (item.note || '').trim();
      if (note.length > 0) {
        summary.appendChild(
          el('div', {
            style: {
              width: '100%',
              minHeight: '72px',
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

      /* ---- 购买信息 ---- */
      var purchaseInfo = item.purchaseInfo;
      if (purchaseInfoHasContent(purchaseInfo)) {
        var purchase = el('div', { class: 'card stack stack--md' }, [
          el('div', { class: 'card__title', text: '购买信息' })
        ]);
        purchase.appendChild(
          ui.detailRow('门店', purchaseInfo.storeName || '未记录')
        );
        purchase.appendChild(
          ui.detailRow('价格', HW.utils.formatPrice(purchaseInfo.price) || '未记录')
        );
        purchase.appendChild(
          ui.detailRow('日期', purchaseInfo.purchaseDate || '未记录')
        );
        if (purchaseInfo.note && purchaseInfo.note.trim().length > 0) {
          purchase.appendChild(ui.detailRow('备注', purchaseInfo.note.trim()));
        }
        inner.appendChild(purchase);
      }

      /* ---- 记录信息 ---- */
      inner.appendChild(
        el('div', { class: 'card stack stack--md' }, [
          el('div', { class: 'card__title', text: '记录信息' }),
          ui.detailRow('创建', item.createdAt ? HW.utils.formatDateTime(item.createdAt) : '未记录'),
          ui.detailRow('更新', item.updatedAt ? HW.utils.formatDateTime(item.updatedAt) : '未记录')
        ])
      );

      /* ---- 删除 ---- */
      var deleteButton = el('button', {
        class: 'btn btn--danger',
        type: 'button',
        text: '删除衣物',
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
      return scroll;
    }

    function confirmDelete() {
      ui.showConfirm({
        title: '删除衣物',
        message: '确定要删除这件衣物吗？照片也会一并移除。',
        confirmText: '删除',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) {
          return;
        }
        state.isDeleting = true;
        state.deleteErrorMessage = '';
        render();

        ctx.repositories.clothing
          .deleteClothing(state.item.id)
          .then(function () {
            HW.App.back();
            ctx.showToast('衣物已删除');
          })
          .catch(function (error) {
            state.isDeleting = false;
            state.deleteErrorMessage = HW.utils.userFacingError(error, '删除衣物失败');
            render();
          });
      });
    }

    var contentHost = el('div', { class: 'page__body' });

    function render() {
      ui.clear(root);

      if (state.loading) {
        root.appendChild(
          ui.secondaryPageHeader({
            title: '衣物详情',
            backAccessibilityText: '返回衣柜',
            onBack: function () {
              HW.App.back();
            }
          })
        );
        root.appendChild(ui.loadingBlock(''));
        return;
      }

      if (!state.item) {
        root.appendChild(renderNotFound());
        return;
      }

      root.appendChild(
        ui.secondaryPageHeader({
          title: '衣物详情',
          showEditAction: true,
          backAccessibilityText: '返回衣柜',
          onBack: function () {
            HW.App.back();
          },
          onEdit: function () {
            HW.App.navigate(HW.App.RouteKind.ClothingEditor, models.AppMainTab.Wardrobe, {
              clothingId: state.item.id
            });
          }
        })
      );
      root.appendChild(renderContent());
    }

    ctx.repositories.clothing
      .getClothingById(route.params.clothingId)
      .then(function (item) {
        state.item = item;
        state.loading = false;
        render();
      })
      .catch(function () {
        state.item = undefined;
        state.loading = false;
        render();
      });

    return { el: root, destroy: function () {} };
  };
})(window);
