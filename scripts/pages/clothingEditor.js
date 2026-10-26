/* 衣不缺 Web 版 — 添加/编辑衣物 / ClothingEditPage
   对应鸿蒙端 entry/src/main/ets/pages/ClothingEditPage.ets。
   滚动内容：padding {left:20, right:20, top:20, bottom:20/32}，Column space 28。 */
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
      style: { padding: '20px 20px 20px', gap: '28px' }
    });
    var actionHost = el('div', { class: 'action-bar action-bar--plain' });

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
        storeName: utilsOptional(state.storeName),
        price: purchasePrice(),
        purchaseDate: utilsOptional(state.purchaseDate),
        note: utilsOptional(state.purchaseNote)
      };
      var hasAny =
        info.storeName !== undefined ||
        info.price !== undefined ||
        info.purchaseDate !== undefined ||
        info.note !== undefined;
      return hasAny ? info : undefined;
    }

    function utilsOptional(value) {
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

    /* ---------- 照片 ---------- */
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
          renderContent();
          renderAction();
        })
        .catch(function (error) {
          state.isChoosingPhotos = false;
          state.errorMessage = HW.utils.userFacingError(error, '选择照片失败');
          renderContent();
          renderAction();
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
        note: utilsOptional(state.note),
        purchaseInfo: purchaseInfo()
      };

      var promise = state.initialItem
        ? ctx.repositories.clothing.updateClothing(
            Object.assign({ id: state.initialItem.id }, input)
          )
        : ctx.repositories.clothing.createClothing(input);

      promise
        .then(function () {
          state.isSaving = false;
          ctx.showToast('衣物已保存');
          HW.App.back();
        })
        .catch(function (error) {
          state.isSaving = false;
          state.errorMessage = HW.utils.userFacingError(error, '保存衣物失败');
          renderContent();
          renderAction();
        });
    }

    /* ---------- 渲染：照片区（无 scrim / 无叠加标题 / 无相机按钮） ---------- */
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
          style: {
            position: 'absolute',
            left: '24px',
            bottom: '24px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            height: '44px',
            padding: '0 18px',
            background: 'var(--card-white)',
            borderRadius: 'var(--radius-full)',
            boxShadow: 'var(--shadow-soft)',
            fontSize: '15px',
            color: 'var(--text-primary)'
          }
        }, [
          el('span', { html: HW.icon('picture', 18) }),
          el('span', { text: state.isChoosingPhotos ? '选择中...' : '选择照片' })
        ])
      );

      return hero;
    }

    /* ---------- 渲染：项目详情卡 ---------- */
    function renderNameCard() {
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

      return el('div', { class: 'name-card' }, [
        el('div', { class: 'name-card__label', text: '项目详情' }),
        nameInput
      ]);
    }

    /* ---------- 渲染：分类 ---------- */
    function renderCategorySection() {
      var row = el('div', {
        class: 'row',
        style: { gap: '12px', width: '100%' }
      });

      visibleCategoryOptions().forEach(function (option) {
        var isActive = state.category === option.value;
        row.appendChild(
          el(
            'button',
            {
              class: 'chip-opt' + (isActive ? ' chip-opt--active' : ''),
              type: 'button',
              'aria-label': option.label + (isActive ? '，已选中' : ''),
              text: option.label,
              onclick: function () {
                state.category = option.value;
                renderContent();
              }
            },
            []
          )
        );
      });

      return el('div', { class: 'stack', style: { gap: '14px' } }, [
        el('div', { class: 'row row--between', style: { width: '100%' } }, [
          el('div', { style: { fontSize: '16px' }, text: '分类' }),
          el('div', {
            style: { fontSize: '13px', color: 'var(--text-secondary)' },
            text: '已选：' + labelForCategory(state.category)
          })
        ]),
        row
      ]);
    }

    /* ---------- 渲染：备注 ---------- */
    function renderNoteSection() {
      var area = el('textarea', {
        class: 'input__textarea',
        placeholder: '输入关于这件衣服的描述...',
        'aria-label': '备注'
      });
      area.value = state.note;
      area.addEventListener('input', function (event) {
        state.note = event.target.value;
      });

      return el('div', { class: 'stack', style: { gap: '14px' } }, [
        el('div', { style: { fontSize: '16px' }, text: '备注' }),
        area
      ]);
    }

    /* ---------- 渲染：购买信息 ---------- */
    function renderPurchaseSection() {
      function row(options) {
        var input = el('input', {
          class: 'input-row__text',
          type: 'text',
          placeholder: options.placeholder,
          inputmode: options.inputmode || null,
          'aria-label': options.label
        });
        input.value = state[options.key];
        input.addEventListener('input', function (event) {
          state[options.key] = event.target.value;
        });

        return el('div', { class: 'input-row' }, [
          el('span', { class: 'input-row__icon', html: HW.icon(options.icon, 20) }),
          input
        ]);
      }

      var dateInput = el('input', {
        class: 'input-row__text',
        type: 'date',
        min: '2000-01-01',
        max: HW.utils.todayIsoDate(),
        'aria-label': '购买日期'
      });
      dateInput.value = state.purchaseDate;
      dateInput.addEventListener('change', function (event) {
        state.purchaseDate = event.target.value;
        renderContent();
      });

      var dateRow = el('div', { class: 'input-row input-row--tall' }, [
        el('span', { class: 'input-row__icon', html: HW.icon('calendar', 20) }),
        el('div', { class: 'input-row__stack' }, [
          el('div', { class: 'input-row__hint', text: '购买日期' }),
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
                style: {
                  width: '44px',
                  height: '44px',
                  flex: '0 0 auto',
                  color: 'var(--text-secondary)'
                },
                onclick: function (event) {
                  event.stopPropagation();
                  state.purchaseDate = '';
                  renderContent();
                }
              },
              []
            )
          : el('span', {
              class: 'input-row__icon',
              html: HW.icon('chevron_down', 17)
            })
      ]);

      return el('div', { class: 'stack', style: { gap: '16px' } }, [
        el('div', { class: 'stack', style: { gap: '4px' } }, [
          el('div', { style: { fontSize: '16px' }, text: '购买信息' }),
          el('div', {
            style: { fontSize: '13px', color: 'var(--text-secondary)' },
            text: '可选，方便以后回想在哪里买。'
          })
        ]),
        row({ icon: 'store_fill', label: '购买门店', placeholder: '购买门店', key: 'storeName' }),
        row({ icon: 'creditcard', label: '价格', placeholder: '价格', key: 'price', inputmode: 'decimal' }),
        dateRow,
        row({ icon: 'list_bullet', label: '购买备注', placeholder: '购买备注', key: 'purchaseNote' })
      ]);
    }

    /* ---------- 渲染主体 ---------- */
    function renderContent() {
      ui.clear(contentHost);
      contentHost.appendChild(renderPhotoHero());
      contentHost.appendChild(renderNameCard());
      contentHost.appendChild(renderCategorySection());
      contentHost.appendChild(renderNoteSection());
      contentHost.appendChild(renderPurchaseSection());

      if (state.errorMessage) {
        contentHost.appendChild(
          el('div', {
            class: 'text-danger',
            style: { fontSize: '13px' },
            text: state.errorMessage
          })
        );
      }

      helpers.resolvePhotos(contentHost);
    }

    function renderAction() {
      ui.clear(actionHost);

      if (state.isSaving) {
        actionHost.appendChild(
          el('div', { class: 'save-btn save-btn--sm' }, [
            el('div', { class: 'spinner spinner--light' })
          ])
        );
        return;
      }

      if (canSave()) {
        actionHost.appendChild(
          el('button', {
            class: 'save-btn save-btn--sm',
            type: 'button',
            text: '保存衣物',
            onclick: saveClothing
          })
        );
        return;
      }

      actionHost.appendChild(
        el('div', {
          class: 'save-btn save-btn--sm save-btn--off',
          text: state.photoUris.length > 0 ? '保存衣物' : '先选择照片'
        })
      );
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

    function renderAll() {
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
