/* 衣不缺 Web 版 — 逛店详情 / StoreVisitDetailPage
   对应鸿蒙端 entry/src/main/ets/pages/StoreVisitDetailPage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  HW.pages.storeVisitDetail = function (route, ctx) {
    var state = {
      visit: undefined,
      loading: true,
      isDeleting: false,
      deleteErrorMessage: ''
    };

    var root = el('div', { class: 'page' });

    function tagsText(visit) {
      if (!visit || !visit.focusTags || visit.focusTags.length === 0) {
        return '未记录';
      }
      return visit.focusTags.join(' · ');
    }

    function locationText(visit) {
      if (!visit) {
        return '未记录';
      }
      var location = (visit.districtOrAddress || '').trim();
      return location.length > 0 ? location : '未记录';
    }

    function photoCountText(visit) {
      if (!visit || !visit.photoUris || visit.photoUris.length === 0) {
        return '暂无照片';
      }
      return visit.photoUris.length + ' 张照片';
    }

    function confirmDelete() {
      ui.showConfirm({
        title: '删除逛店记录',
        message: '确定要删除这条逛店记录吗？照片也会一并移除。',
        confirmText: '删除',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) {
          return;
        }
        state.isDeleting = true;
        state.deleteErrorMessage = '';
        render();

        ctx.repositories.store
          .deleteStoreVisit(state.visit.id)
          .then(function () {
            HW.App.back();
            ctx.showToast('逛店记录已删除');
          })
          .catch(function (error) {
            state.isDeleting = false;
            state.deleteErrorMessage = HW.utils.userFacingError(error, '删除逛店记录失败');
            render();
          });
      });
    }

    function renderContent() {
      var visit = state.visit;
      var scroll = el('div', { class: 'page__body scroll-y' });
      var inner = el('div', { class: 'stack stack--lg', style: { padding: '8px 20px 28px' } });

      /* 主图 */
      var hero = el('div', { class: 'hero-photo' });
      if (visit.photoUris && visit.photoUris.length > 0) {
        hero.appendChild(
          helpers.photoCarousel(visit.photoUris, {
            alt: visit.storeNameSnapshot,
            className: ''
          })
        );
        hero.addEventListener('click', function () {
          ctx.showPhotoPreview({
            photos: visit.photoUris,
            index: 0,
            title: visit.storeNameSnapshot
          });
        });
      } else {
        hero.appendChild(
          el('div', { class: 'hero-photo__empty' }, [
            el('span', { html: HW.icon('store_fill', 48) }),
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
              text: visit.storeNameSnapshot || '逛店记录'
            }),
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '13px' },
              text: photoCountText(visit)
            })
          ]),
          el('div', { class: 'pill', text: helpers.visitBadge(visit) })
        ]),
        ui.detailRow('商圈', locationText(visit), true),
        ui.detailRow('日期', visit.visitDate || '未记录', true),
        ui.detailRow('标签', tagsText(visit), true)
      ]);

      var note = (visit.note || '').trim();
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

      /* 删除 */
      var deleteButton = el('button', {
        class: 'btn btn--danger',
        type: 'button',
        text: '删除逛店记录',
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
            title: '逛店详情',
            backAccessibilityText: '返回逛店',
            onBack: function () {
              HW.App.back();
            }
          })
        );
        root.appendChild(ui.loadingBlock(''));
        return;
      }

      if (!state.visit) {
        root.appendChild(
          ui.secondaryPageHeader({
            title: '逛店详情',
            backAccessibilityText: '返回逛店',
            onBack: function () {
              HW.App.back();
            }
          })
        );
        root.appendChild(
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
              el('div', { style: { fontSize: '24px' }, text: '逛店记录不存在' }),
              el('div', {
                class: 'text-secondary',
                style: { fontSize: '14px' },
                text: '可能已经被删除，请返回逛店重新选择。'
              })
            ]
          )
        );
        return;
      }

      root.appendChild(
        ui.secondaryPageHeader({
          title: '逛店详情',
          showEditAction: true,
          backAccessibilityText: '返回逛店',
          onBack: function () {
            HW.App.back();
          },
          onEdit: function () {
            HW.App.navigate(HW.App.RouteKind.StoreEditor, models.AppMainTab.Store, {
              storeVisitId: state.visit.id
            });
          }
        })
      );
      root.appendChild(renderContent());
    }

    ctx.repositories.store
      .getStoreVisitById(route.params.storeVisitId)
      .then(function (visit) {
        state.visit = visit;
        state.loading = false;
        render();
      })
      .catch(function () {
        state.visit = undefined;
        state.loading = false;
        render();
      });

    return { el: root, destroy: function () {} };
  };
})(window);
