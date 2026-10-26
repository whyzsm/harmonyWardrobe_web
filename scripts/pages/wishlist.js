/* 衣不缺 Web 版 — 心愿清单 / WishlistPage + WishlistEditPage
   对应鸿蒙端 entry/src/main/ets/pages/WishlistPage.ets 与 WishlistEditPage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  /* ===================================================================
     心愿清单列表 / WishlistPage
     =================================================================== */
  HW.pages.wishlist = function (route, ctx) {
    var state = {
      items: [],
      searchQuery: '',
      loading: true,
      errorMessage: ''
    };

    var root = el('div', { class: 'page' });
    var scrollHost = el('div', { class: 'page__body scroll-y' });
    var contentHost = el('div', {
      class: 'stack',
      style: { padding: '20px 20px 20px' }
    });

    /* 搜索框：页头与列表区共用同一实例 */
    var searchInput = el('input', {
      class: 'input__text',
      type: 'text',
      placeholder: '搜索心仪单品、门店、备注',
      'aria-label': '搜索心仪单品、门店、备注'
    });
    searchInput.value = state.searchQuery;
    searchInput.addEventListener('input', function (event) {
      state.searchQuery = event.target.value;
      renderList();
    });
    searchInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        HW.App.navigate(HW.App.RouteKind.Search, models.AppMainTab.Profile, {
          query: state.searchQuery,
          scope: models.SearchEntityType.Wishlist
        });
      }
    });

    function filteredItems() {
      var query = state.searchQuery.trim().toLowerCase();
      if (query === '') {
        return state.items;
      }
      return state.items.filter(function (item) {
        return (
          String(item.title).toLowerCase().indexOf(query) >= 0 ||
          (item.storeName && String(item.storeName).toLowerCase().indexOf(query) >= 0) ||
          (item.note && String(item.note).toLowerCase().indexOf(query) >= 0)
        );
      });
    }

    function renderHeader() {
      return el('div', { class: 'row row--between', style: { gap: '12px' } }, [
        el(
          'button',
          {
            class: 'icon-button',
            type: 'button',
            'aria-label': '返回我的',
            html: HW.icon('arrow_left', 22),
            onclick: function () {
              HW.App.switchTab(models.AppMainTab.Profile);
            }
          },
          []
        ),
        el('div', { class: 'stack', style: { flex: '1', minWidth: '0', gap: '4px' } }, [
          el('div', { style: { fontSize: '24px', lineHeight: '32px' }, text: '心仪单品' }),
          el('div', {
            class: 'text-secondary',
            style: { fontSize: '15px' },
            text: '记录想买的衣物、门店、价格和试穿照片。'
          })
        ]),
        el('button', {
          class: 'btn btn--sm',
          type: 'button',
          style: { width: 'auto', height: '40px', padding: '0 14px', fontSize: '14px', flex: '0 0 auto' },
          text: '添加心愿',
          onclick: function () {
            HW.App.navigate(HW.App.RouteKind.WishlistEditor, models.AppMainTab.Profile, {});
          }
        })
      ]);
    }

    function renderList() {
      var items = filteredItems();
      var listHost = contentHost.querySelector('#wishlist-list');
      ui.clear(listHost);

      if (state.loading) {
        listHost.appendChild(
          el('div', {
            class: 'text-secondary',
            style: { fontSize: '14px' },
            text: '正在加载心愿...'
          })
        );
        return;
      }

      if (state.errorMessage) {
        listHost.appendChild(
          el('div', { class: 'row', style: { gap: '8px' } }, [
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

      if (items.length === 0) {
        listHost.appendChild(
          ui.emptyState(
            '还没有心仪单品',
            '添加心愿后会在这里显示，也可以按门店和关键词搜索。'
          )
        );
        return;
      }

      items.forEach(function (item) {
        var card = el(
          'button',
          {
            class: 'list-row',
            type: 'button',
            style: { borderRadius: 'var(--radius-md)', borderColor: 'var(--border-medium)' },
            onclick: function () {
              HW.App.navigate(HW.App.RouteKind.WishlistEditor, models.AppMainTab.Profile, {
                wishlistItemId: item.id
              });
            }
          },
          []
        );

        if (item.photoUris && item.photoUris.length > 0) {
          card.appendChild(
            helpers.photoImage(item.photoUris[0], 'wall-card__image', item.title)
          );
          card.querySelector('img').style.width = '72px';
          card.querySelector('img').style.height = '72px';
          card.querySelector('img').style.borderRadius = 'var(--radius-md)';
          card.querySelector('img').style.objectFit = 'cover';
          card.querySelector('img').style.flex = '0 0 auto';
        } else {
          card.appendChild(
            el('div', {
              style: {
                width: '72px',
                height: '72px',
                flex: '0 0 auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--card-surface)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--action-black)'
              },
              html: HW.icon('heart_fill', 26)
            })
          );
        }

        var priceText = HW.utils.formatPrice(item.price);
        card.appendChild(
          el('div', { class: 'list-row__body', style: { gap: '6px' } }, [
            el('div', { class: 'list-row__title', style: { fontSize: '16px' }, text: item.title }),
            el('div', {
              class: 'list-row__meta',
              style: { fontSize: '13px' },
              text: item.storeName && item.storeName.length > 0 ? item.storeName : '未记录门店'
            }),
            el('div', {
              class: 'list-row__meta',
              style: {
                fontSize: '13px',
                color: priceText ? 'var(--success)' : 'var(--text-disabled)'
              },
              text: priceText ? priceText : '未记录价格'
            })
          ])
        );

        listHost.appendChild(el('div', { style: { marginBottom: '10px' } }, [card]));
      });

      helpers.resolvePhotos(listHost);
    }

    function load() {
      state.loading = true;
      state.errorMessage = '';
      renderList();

      ctx.repositories.wishlist
        .listWishlistItems()
        .then(function (items) {
          state.items = items;
          state.loading = false;
          renderList();
        })
        .catch(function (error) {
          state.loading = false;
          state.errorMessage = error && error.message ? error.message : '加载心愿失败';
          renderList();
        });
    }

    contentHost.appendChild(renderHeader());
    contentHost.appendChild(
      el('div', {
        class: 'input',
        style: { height: '48px', borderColor: 'var(--border-medium)' }
      }, [searchInput])
    );
    var listHost = el('div', { id: 'wishlist-list', class: 'stack', style: { gap: '0' } });
    contentHost.appendChild(listHost);

    root.appendChild(scrollHost);
    scrollHost.appendChild(contentHost);

    renderList();
    load();

    return { el: root, destroy: function () {} };
  };

  /* ===================================================================
     添加/编辑心愿 / WishlistEditPage
     =================================================================== */
  HW.pages.wishlistEditor = function (route, ctx) {
    var state = {
      initialItem: undefined,
      title: '',
      storeName: '',
      price: '',
      note: '',
      photoUris: [],
      isSaving: false,
      isChoosingPhotos: false,
      isDeleting: false,
      errorMessage: ''
    };

    var root = el('div', { class: 'page' });
    var headerHost = el('div');
    var scrollHost = el('div', { class: 'page__body scroll-y' });
    var contentHost = el('div', { class: 'stack', style: { padding: '20px 20px 20px' } });
    var saveButtonHost = el('div');

    function canSave() {
      return (
        !state.isSaving &&
        !state.isChoosingPhotos &&
        !state.isDeleting &&
        state.title.trim().length > 0
      );
    }

    function wishlistPrice() {
      var trimmed = state.price.trim();
      if (trimmed.length === 0) {
        return undefined;
      }
      var value = Number(trimmed);
      if (!Number.isFinite(value) || value < 0) {
        return undefined;
      }
      return value;
    }

    function pickGalleryPhotos() {
      if (state.isSaving || state.isChoosingPhotos) {
        return;
      }
      var slots = HW.utils.remainingPhotoSlots(state.photoUris);
      if (slots === 0) {
        state.errorMessage = '最多添加 ' + models.MAX_USER_PHOTOS + ' 张照片。';
        renderContent();
        return;
      }
      state.isChoosingPhotos = true;
      state.errorMessage = '';
      renderContent();

      HW.PhotoPickerAdapter.pickFromGallery(slots)
        .then(function (photoUris) {
          state.isChoosingPhotos = false;
          if (photoUris.length) {
            state.photoUris = HW.utils.appendPhotoUris(state.photoUris, photoUris);
          }
          renderContent();
        })
        .catch(function (error) {
          state.isChoosingPhotos = false;
          state.errorMessage = error && error.message ? error.message : '选择照片失败';
          renderContent();
        });
    }

    function capturePhoto() {
      if (state.isSaving || state.isChoosingPhotos) {
        return;
      }
      state.isChoosingPhotos = true;
      state.errorMessage = '';
      renderContent();

      HW.PhotoPickerAdapter.captureFromCamera()
        .then(function (photoUris) {
          state.isChoosingPhotos = false;
          if (photoUris.length) {
            state.photoUris = HW.utils.appendPhotoUris(state.photoUris, photoUris);
          }
          renderContent();
        })
        .catch(function (error) {
          state.isChoosingPhotos = false;
          state.errorMessage = error && error.message ? error.message : '拍照失败';
          renderContent();
        });
    }

    function saveWishlistItem() {
      if (!canSave()) {
        return;
      }
      state.isSaving = true;
      state.errorMessage = '';
      renderContent();

      var input = {
        title: state.title.trim(),
        storeName: HW.utils.optionalText(state.storeName),
        price: wishlistPrice(),
        note: HW.utils.optionalText(state.note),
        photoUris: state.photoUris
      };

      var promise = state.initialItem
        ? ctx.repositories.wishlist.updateWishlistItem(
            Object.assign({ id: state.initialItem.id }, input)
          )
        : ctx.repositories.wishlist.createWishlistItem(input);

      promise
        .then(function () {
          state.isSaving = false;
          ctx.showToast('心愿已保存');
          HW.App.back();
        })
        .catch(function (error) {
          state.isSaving = false;
          state.errorMessage = error && error.message ? error.message : '保存心愿失败';
          renderContent();
        });
    }

    function confirmDeleteWishlistItem() {
      ui.showConfirm({
        title: '删除心愿',
        message: '确定要删除这条心愿吗？照片也会一并移除。',
        confirmText: '删除',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) {
          return;
        }
        state.isDeleting = true;
        renderContent();

        ctx.repositories.wishlist
          .deleteWishlistItem(state.initialItem.id)
          .then(function () {
            HW.App.back();
            ctx.showToast('心愿已删除');
          })
          .catch(function (error) {
            state.isDeleting = false;
            state.errorMessage = error && error.message ? error.message : '删除心愿失败';
            renderContent();
          });
      });
    }

    function renderContent() {
      ui.clear(contentHost);

      /* 照片网格 */
      var photoGrid = el('div', { class: 'photo-grid' });
      if (state.photoUris.length === 0) {
        photoGrid.style.gridTemplateColumns = '1fr';
        photoGrid.appendChild(
          el('img', {
            class: 'photo-grid__item',
            src: 'assets/default_fashion_cover.jpg',
            alt: '默认封面'
          })
        );
      } else {
        photoGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
        state.photoUris.forEach(function (photoId) {
          photoGrid.appendChild(
            helpers.photoImage(photoId, 'photo-grid__item', '心愿照片')
          );
        });
      }
      contentHost.appendChild(photoGrid);

      contentHost.appendChild(
        ui.photoActionButtons({
          pickText: '从相册选择',
          captureText: '拍照',
          isChoosing: state.isChoosingPhotos,
          disabled: state.isSaving || state.isChoosingPhotos,
          onPick: pickGalleryPhotos,
          onCapture: capturePhoto
        })
      );

      function textField(label, placeholder, key, inputMode) {
        var input = el('input', {
          class: 'input__text',
          type: 'text',
          placeholder: placeholder,
          inputmode: inputMode || null,
          'aria-label': label
        });
        input.value = state[key];
        input.addEventListener('input', function (event) {
          state[key] = event.target.value;
          if (key === 'title') {
            renderSaveButton();
          }
        });
        return el('div', { class: 'stack', style: { gap: '6px' } }, [
          el('div', { class: 'field__label', text: label }),
          el('div', { class: 'input', style: { height: '44px' } }, [input])
        ]);
      }

      contentHost.appendChild(textField('商品名称', '输入心仪单品名称', 'title'));
      contentHost.appendChild(textField('门店', '输入门店或品牌', 'storeName'));
      contentHost.appendChild(textField('期望价格', '输入价格', 'price', 'decimal'));
      contentHost.appendChild(
        textField('备注', '记录尺码、试穿感受或购买理由', 'note')
      );

      if (state.errorMessage) {
        contentHost.appendChild(
          el('div', {
            class: 'text-danger',
            style: { fontSize: '13px' },
            text: state.errorMessage
          })
        );
      }

      /* 删除 */
      if (state.initialItem) {
        var deleteButton = el('button', {
          class: 'btn btn--sm btn--danger',
          type: 'button',
          text: '删除心愿',
          disabled: state.isDeleting,
          onclick: confirmDeleteWishlistItem
        });
        if (state.isDeleting) {
          deleteButton.innerHTML = '';
          deleteButton.appendChild(el('div', { class: 'spinner spinner--light' }));
        }
        contentHost.appendChild(deleteButton);
      }

      /* 保存 */
      contentHost.appendChild(saveButtonHost);
      renderSaveButton();

      helpers.resolvePhotos(contentHost);
    }

    function renderSaveButton() {
      ui.clear(saveButtonHost);
      var button = el('button', {
        class: 'btn btn--sm',
        type: 'button',
        text: '保存心愿',
        disabled: !canSave(),
        style: canSave()
          ? {}
          : { background: 'var(--text-disabled)', color: 'var(--text-inverse)' },
        onclick: saveWishlistItem
      });
      if (state.isSaving) {
        button.innerHTML = '';
        button.appendChild(el('div', { class: 'spinner spinner--light' }));
      }
      saveButtonHost.appendChild(button);
    }

    function renderHeader() {
      ui.clear(headerHost);
      headerHost.appendChild(
        ui.secondaryPageHeader({
          title: state.initialItem ? '编辑心愿' : '添加心愿',
          backAccessibilityText: '返回心愿',
          onBack: function () {
            HW.App.back();
          }
        })
      );
    }

    function renderAll() {
      renderHeader();
      renderContent();
    }

    root.appendChild(headerHost);
    root.appendChild(scrollHost);
    scrollHost.appendChild(contentHost);

    if (route.params.wishlistItemId) {
      ctx.repositories.wishlist
        .getWishlistItemById(route.params.wishlistItemId)
        .then(function (item) {
          state.initialItem = item;
          if (item) {
            state.title = item.title || '';
            state.storeName = item.storeName || '';
            state.price = item.price === undefined ? '' : String(item.price);
            state.note = item.note || '';
            state.photoUris = (item.photoUris || []).slice();
          }
          renderAll();
        })
        .catch(function () {
          renderAll();
        });
    } else {
      renderAll();
    }

    return { el: root, destroy: function () {} };
  };
})(window);
