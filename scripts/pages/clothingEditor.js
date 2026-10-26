/* 衣不缺 Web 版 — 添加/编辑衣物 / ClothingEditPage
   对应鸿蒙端 entry/src/main/ets/pages/ClothingEditPage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  HW.pages.clothingEditor = function (route, ctx) {
    var state = {
      initialItem: undefined,
      name: '',
      category: models.ClothingCategory.Top,
      photoUris: [],
      note: '',
      storeName: '',
      price: '',
      purchaseDate: '',
      purchaseNote: '',
      isSaving: false,
      isChoosingPhotos: false,
      errorMessage: ''
    };

    var root = el('div', { class: 'page' });
    var headerHost = el('div');
    var scrollHost = el('div', { class: 'page__body scroll-y' });
    var contentHost = el('div', {
      class: 'stack',
      style: { padding: '20px 20px 32px' }
    });
    var actionHost = el('div', { class: 'action-bar' });

    /* ---------- 派生值 ---------- */
    function labelForCategory(category) {
      return models.CLOTHING_CATEGORY_LABEL[category] || models.CLOTHING_CATEGORY_LABEL.Top;
    }

    function visibleCategoryOptions() {
      var options = models.DISPLAY_CATEGORY_OPTIONS.slice();
      if (
        state.category === models.ClothingCategory.HalfSkirt &&
        !options.some(function (option) {
          return option.value === models.ClothingCategory.HalfSkirt;
        })
      ) {
        options.push(models.LEGACY_HALF_SKIRT_OPTION);
      }
      return options;
    }

    function generatedName() {
      return helpers.generatedClothingName(state.category);
    }

    function normalizedName() {
      var trimmed = state.name.trim();
      return trimmed.length > 0 ? trimmed : generatedName();
    }

    function purchasePrice() {
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

    function purchaseInfo() {
      var info = {
        storeName: utils_optional(state.storeName),
        price: purchasePrice(),
        purchaseDate: utils_optional(state.purchaseDate),
        note: utils_optional(state.purchaseNote)
      };
      var hasAny =
        info.storeName !== undefined ||
        info.price !== undefined ||
        info.purchaseDate !== undefined ||
        info.note !== undefined;
      return hasAny ? info : undefined;
    }

    function utils_optional(value) {
      var trimmed = String(value || '').trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }

    function canSave() {
      return (
        !state.isSaving &&
        !state.isChoosingPhotos &&
        state.photoUris.length > 0
      );
    }

    /* ---------- 照片选择 ---------- */
    function pickGalleryPhotos() {
      if (state.isSaving || state.isChoosingPhotos) {
        return;
      }
      var slots = HW.utils.remainingPhotoSlots(state.photoUris);
      if (slots === 0) {
        state.errorMessage = '最多添加 ' + models.MAX_USER_PHOTOS + ' 张照片。';
        renderError();
        return;
      }

      state.isChoosingPhotos = true;
      state.errorMessage = '';
      renderAction();

      HW.PhotoPickerAdapter.pickFromGallery(slots)
        .then(function (photoUris) {
          state.isChoosingPhotos = false;
          if (!photoUris.length) {
            renderAction();
            return;
          }
          state.photoUris = HW.utils.appendPhotoUris(state.photoUris, photoUris);
          if (state.name.trim().length === 0) {
            state.name = generatedName();
          }
          render();
        })
        .catch(function (error) {
          state.isChoosingPhotos = false;
          state.errorMessage = HW.utils.userFacingError(error, '选择照片失败');
          render();
        });
    }

    /* ---------- 保存 ---------- */
    function saveClothing() {
      if (!canSave()) {
        return;
      }
      state.isSaving = true;
      state.errorMessage = '';
      renderAction();

      var input = {
        name: normalizedName(),
        category: state.category,
        photoUris: state.photoUris,
        note: utils_optional(state.note),
        purchaseInfo: purchaseInfo()
      };

      var promise = state.initialItem
        ? ctx.repositories.clothing.updateClothing(
            Object.assign({ id: state.initialItem.id }, input)
          )
        : ctx.repositories.clothing.createClothing(input);

      promise
        .then(function (savedItem) {
          state.isSaving = false;
          ctx.showToast('衣物已保存');
          /* 返回列表页：App.back() 会重建列表并重新加载数据 */
          HW.App.back();
        })
        .catch(function (error) {
          state.isSaving = false;
          state.errorMessage = HW.utils.userFacingError(error, '保存衣物失败');
          renderAction();
          renderError();
        });
    }

    /* ---------- 渲染 ---------- */
    function renderError() {
      var existing = contentHost.querySelector('.editor-error');
      if (existing) {
        existing.parentNode.removeChild(existing);
      }
      if (!state.errorMessage) {
        return;
      }
      contentHost.appendChild(
        el('div', {
          class: 'editor-error text-danger',
          style: { fontSize: '13px' },
          text: state.errorMessage
        })
      );
    }

    function renderAction() {
      ui.clear(actionHost);

      if (state.isSaving) {
        actionHost.appendChild(
          el('div', {
            class: 'btn',
            style: { cursor: 'default' }
          }, [el('div', { class: 'spinner spinner--light' })])
        );
        return;
      }

      if (canSave()) {
        actionHost.appendChild(
          el('button', {
            class: 'btn',
            type: 'button',
            text: '保存衣物',
            onclick: saveClothing
          })
        );
        return;
      }

      actionHost.appendChild(
        el('div', {
          class: 'btn',
          style: { cursor: 'default', background: 'var(--text-disabled)', color: 'var(--text-primary)' },
          text: state.photoUris.length > 0 ? '保存衣物' : '先选择照片'
        })
      );
    }

    function renderPhotoHero() {
      var hero = el('div', {
        class: 'photo-hero photo-hero--square',
        role: 'button',
        tabindex: '0',
        'aria-label': '选择衣物照片',
        onclick: pickGalleryPhotos,
        onkeydown: function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            pickGalleryPhotos();
          }
        }
      });

      if (state.photoUris.length > 0) {
        hero.appendChild(
          helpers.photoCarousel(state.photoUris, {
            alt: '衣物照片',
            className: ''
          })
        );
      } else {
        hero.appendChild(
          el('img', {
            class: 'photo-hero__image',
            src: 'assets/default_fashion_cover.jpg',
            alt: '默认封面'
          })
        );
      }

      hero.appendChild(
        el('div', {
          class: 'photo-hero__content',
          style: { pointerEvents: 'none' }
        }, [
          el('span', { html: HW.icon('picture', 18) }),
          el('span', {
            style: { fontSize: '15px', color: 'var(--text-primary)' },
            text: state.isChoosingPhotos ? '选择中...' : '选择照片'
          })
        ])
      );

      return hero;
    }

    function renderContent() {
      ui.clear(contentHost);
      contentHost.appendChild(renderPhotoHero());

      /* 项目详情 */
      var nameInput = el('input', {
        class: 'name-card__input',
        type: 'text',
        placeholder: '衣物名称',
        'aria-label': '衣物名称'
      });
      nameInput.value = state.name;
      nameInput.addEventListener('input', function (event) {
        state.name = event.target.value;
      });

      contentHost.appendChild(
        el('div', { class: 'name-card' }, [
          el('div', { class: 'name-card__label', text: '项目详情' }),
          nameInput
        ])
      );

      /* 分类 */
      var categoryRow = helpers.optionChips({
        options: visibleCategoryOptions(),
        getValue: function () {
          return state.category;
        },
        onSelect: function (value) {
          state.category = value;
          renderContent();
        }
      });

      contentHost.appendChild(
        el('div', { class: 'stack', style: { gap: '14px' } }, [
          el('div', { class: 'row row--between' }, [
            el('div', { style: { fontSize: '16px' }, text: '分类' }),
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '13px' },
              text: '已选：' + labelForCategory(state.category)
            })
          ]),
          categoryRow
        ])
      );

      /* 备注 */
      var noteArea = helpers.textArea({
        value: state.note,
        placeholder: '输入关于这件衣服的描述...',
        onInput: function (value) {
          state.note = value;
        }
      });

      contentHost.appendChild(
        el('div', { class: 'stack', style: { gap: '14px' } }, [
          el('div', { style: { fontSize: '16px' }, text: '备注' }),
          noteArea
        ])
      );

      /* 购买信息 */
      var storeField = helpers.textField({
        icon: 'store_fill',
        value: state.storeName,
        placeholder: '购买门店',
        onInput: function (value) {
          state.storeName = value;
        }
      });

      var priceField = helpers.textField({
        icon: 'creditcard',
        value: state.price,
        placeholder: '价格',
        inputmode: 'decimal',
        onInput: function (value) {
          state.price = value;
        }
      });

      var dateInput = el('input', {
        class: 'input__text',
        type: 'date',
        min: '2000-01-01',
        max: HW.utils.todayIsoDate(),
        'aria-label': '购买日期'
      });
      dateInput.value = state.purchaseDate;
      dateInput.addEventListener('change', function (event) {
        state.purchaseDate = event.target.value;
      });

      var dateRow = el('div', { class: 'input input--tall' }, [
        el('span', { class: 'input__icon', html: HW.icon('calendar', 20) }),
        el('div', { class: 'stack', style: { flex: '1', minWidth: '0', gap: '2px' } }, [
          el('div', { class: 'text-secondary', style: { fontSize: '12px' }, text: '购买日期' }),
          dateInput
        ]),
        state.purchaseDate
          ? el(
              'button',
              {
                class: 'icon-button',
                type: 'button',
                'aria-label': '清除日期',
                html: HW.icon('xmark', 16),
                style: { width: '44px', height: '44px', color: 'var(--text-secondary)' },
                onclick: function (event) {
                  event.stopPropagation();
                  state.purchaseDate = '';
                  renderContent();
                }
              },
              []
            )
          : el('span', { class: 'input__icon', html: HW.icon('chevron_down', 17) })
      ]);

      var purchaseNoteField = helpers.textField({
        icon: 'list_bullet',
        value: state.purchaseNote,
        placeholder: '购买备注',
        onInput: function (value) {
          state.purchaseNote = value;
        }
      });

      contentHost.appendChild(
        el('div', { class: 'stack', style: { gap: '16px' } }, [
          el('div', { class: 'stack', style: { gap: '4px' } }, [
            el('div', { style: { fontSize: '16px' }, text: '购买信息' }),
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '13px' },
              text: '可选，方便以后回想在哪里买。'
            })
          ]),
          storeField.wrap,
          priceField.wrap,
          dateRow,
          purchaseNoteField.wrap
        ])
      );

      if (state.errorMessage) {
        contentHost.appendChild(
          el('div', {
            class: 'editor-error text-danger',
            style: { fontSize: '13px' },
            text: state.errorMessage
          })
        );
      }
    }

    function renderHeader() {
      ui.clear(headerHost);
      headerHost.appendChild(
        ui.secondaryPageHeader({
          title: state.initialItem ? '编辑衣物' : '添加衣物',
          backAccessibilityText: '返回衣柜',
          onBack: function () {
            HW.App.back();
          }
        })
      );
    }

    function render() {
      renderHeader();
      renderContent();
      renderAction();
    }

    /* ---------- 初始化 ---------- */
    root.appendChild(headerHost);
    root.appendChild(scrollHost);
    root.appendChild(actionHost);
    scrollHost.appendChild(contentHost);

    if (route.params.clothingId) {
      ctx.repositories.clothing
        .getClothingById(route.params.clothingId)
        .then(function (item) {
          state.initialItem = item;
          if (item) {
            state.name = item.name;
            state.category = item.category;
            state.photoUris = (item.photoUris || []).slice();
            state.note = item.note || '';
            state.storeName = (item.purchaseInfo && item.purchaseInfo.storeName) || '';
            state.price =
              item.purchaseInfo && item.purchaseInfo.price !== undefined
                ? String(item.purchaseInfo.price)
                : '';
            state.purchaseDate = (item.purchaseInfo && item.purchaseInfo.purchaseDate) || '';
            state.purchaseNote = (item.purchaseInfo && item.purchaseInfo.note) || '';
          }
          render();
        })
        .catch(function () {
          render();
        });
    } else {
      render();
    }

    return { el: root, destroy: function () {} };
  };
})(window);
