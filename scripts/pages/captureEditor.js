/* 衣不缺 Web 版 — 拍照录入 / CaptureEditPage
   对应鸿蒙端 entry/src/main/ets/pages/CaptureEditPage.ets。
   一次拍照可分别保存到衣柜 / 穿搭 / 逛店三个目标。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  var CAPTURE_MODE_OPTIONS = [
    { label: '衣物', value: '单品', target: '衣橱', icon: 'shirt' },
    { label: '穿搭', value: '试穿', target: '美搭', icon: 'hanger_and_towels' },
    { label: '逛店', value: '吊牌', target: '店铺', icon: 'bag' }
  ];

  HW.pages.captureEditor = function (route, ctx) {
    var state = {
      captureMode: '单品',
      captureType: '衣橱',
      photoUris: (route.params.photoUris || []).slice(),
      capturedAt: route.params.capturedAt || new Date().toISOString(),
      name: '',
      category: models.ClothingCategory.Top,
      note: '',
      storeName: '',
      price: '',
      purchaseDate: '',
      purchaseNote: '',
      outfitTitle: '',
      selectedClothingItemIds: [],
      districtOrAddress: '',
      visitDate: HW.utils.todayIsoDate(),
      clothingItems: [],
      isSaving: false,
      isChoosingPhotos: false,
      errorMessage: ''
    };

    var root = el('div', { class: 'page' });
    var headerHost = el('div');
    var scrollHost = el('div', { class: 'page__body scroll-y' });
    var contentHost = el('div', {
      class: 'stack',
      style: { padding: '14px 20px 116px', gap: '14px' }
    });

    /* ---------- 派生 ---------- */
    function categoryLabel() {
      return models.CAPTURE_CATEGORY_LABEL[state.category] || '上衣';
    }

    function generatedClothingName() {
      return helpers.generatedClothingName(state.category, new Date(state.capturedAt));
    }

    function generatedOutfitTitle() {
      return helpers.generatedOutfitTitle(new Date(state.capturedAt));
    }

    function generatedStoreVisitName() {
      return helpers.generatedStoreVisitName(new Date(state.capturedAt));
    }

    function canSave() {
      return !state.isSaving && state.photoUris.length > 0;
    }

    function saveButtonLabel() {
      if (state.isSaving) {
        return '保存中...';
      }
      if (state.captureType === '美搭') {
        return '保存穿搭';
      }
      if (state.captureType === '店铺') {
        return '保存逛店记录';
      }
      return state.photoUris.length > 0 ? '保存衣物' : '先添加照片';
    }

    function selectMode(value) {
      var option = CAPTURE_MODE_OPTIONS.filter(function (candidate) {
        return candidate.value === value;
      })[0];
      if (!option) {
        return;
      }
      state.captureMode = option.value;
      state.captureType = option.target;
      renderContent();
    }

    /* ---------- 照片 ---------- */
    function choosePhotos() {
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
          state.errorMessage = HW.utils.userFacingError(error, '选择照片失败，请重试');
          renderContent();
        });
    }

    /* ---------- 保存 ---------- */
    function saveCapture() {
      if (!canSave()) {
        return;
      }
      state.isSaving = true;
      state.errorMessage = '';
      renderContent();

      var promise;
      if (state.captureType === '衣橱') {
        promise = ctx.repositories.clothing.createClothing({
          name: HW.utils.optionalText(state.name) || generatedClothingName(),
          category: state.category,
          photoUris: state.photoUris,
          note: HW.utils.optionalText(state.note),
          purchaseInfo: buildPurchaseInfo()
        });
      } else if (state.captureType === '美搭') {
        promise = ctx.repositories.outfit.createOutfit({
          title:
            HW.utils.optionalText(state.outfitTitle) ||
            HW.utils.optionalText(state.name) ||
            generatedOutfitTitle(),
          photoUris: state.photoUris,
          clothingItemIds: state.selectedClothingItemIds,
          note: HW.utils.optionalText(state.note)
        });
      } else {
        promise = ctx.repositories.store.createStoreVisitWithOptionalStore({
          storeName: HW.utils.optionalText(state.storeName),
          storeNameSnapshot:
            HW.utils.optionalText(state.storeName) ||
            HW.utils.optionalText(state.name) ||
            generatedStoreVisitName(),
          districtOrAddress: HW.utils.optionalText(state.districtOrAddress),
          visitDate: HW.utils.optionalText(state.visitDate) || state.visitDate,
          photoUris: state.photoUris,
          note: HW.utils.optionalText(state.note)
        });
      }

      promise
        .then(function () {
          state.isSaving = false;
          if (state.captureType === '店铺') {
            HW.App.switchTab(models.AppMainTab.Store);
          } else if (state.captureType === '美搭') {
            HW.App.switchTab(models.AppMainTab.Outfit);
          } else {
            HW.App.switchTab(models.AppMainTab.Wardrobe);
          }
        })
        .catch(function (error) {
          state.isSaving = false;
          state.errorMessage = HW.utils.userFacingError(error, '保存失败');
          renderContent();
        });
    }

    function buildPurchaseInfo() {
      var price;
      var trimmedPrice = state.price.trim();
      if (trimmedPrice.length > 0) {
        var numeric = Number(trimmedPrice);
        if (Number.isFinite(numeric) && numeric >= 0) {
          price = numeric;
        }
      }

      var info = {
        storeName: HW.utils.optionalText(state.storeName),
        price: price,
        purchaseDate: HW.utils.optionalText(state.purchaseDate),
        note: HW.utils.optionalText(state.purchaseNote)
      };

      var hasAny =
        info.storeName !== undefined ||
        info.price !== undefined ||
        info.purchaseDate !== undefined ||
        info.note !== undefined;
      return hasAny ? info : undefined;
    }

    /* ---------- 渲染 ---------- */
    function renderModeTabs() {
      var row = el('div', { class: 'row', style: { gap: '10px' } });
      CAPTURE_MODE_OPTIONS.forEach(function (option) {
        var isActive = state.captureMode === option.value;
        row.appendChild(
          el(
            'button',
            {
              class: 'chip' + (isActive ? ' chip--active' : ''),
              type: 'button',
              style: {
                height: '44px',
                borderRadius: 'var(--radius-xxxl)',
                fontSize: '12px',
                padding: '0 15px'
              },
              'aria-label': option.label + (isActive ? '，已选中' : ''),
              onclick: function () {
                selectMode(option.value);
              }
            },
            [
              el('span', { html: HW.icon(option.icon, 14) }),
              el('span', { text: option.label })
            ]
          )
        );
      });
      return el('div', { style: { overflowX: 'auto' } }, [row]);
    }

    function renderCapturePreview() {
      var stack = el('div', {
        style: {
          position: 'relative',
          width: '100%',
          height: '372px',
          borderRadius: 'var(--radius-xs)',
          overflow: 'hidden',
          border: '1px solid var(--border-light)',
          background: 'var(--bg-gray)'
        }
      });

      if (state.photoUris.length > 0) {
        stack.appendChild(
          helpers.photoCarousel(state.photoUris, { alt: '拍摄照片', className: '' })
        );
      } else {
        stack.appendChild(
          el('img', {
            class: 'photo-hero__image',
            src: 'assets/default_fashion_cover.jpg',
            alt: '默认封面'
          })
        );
      }

      stack.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            width: '91%',
            height: '336px',
            left: '15px',
            bottom: '18px',
            border: '1px solid var(--glass-medium)',
            borderRadius: 'var(--radius-xs)',
            pointerEvents: 'none'
          }
        })
      );

      stack.appendChild(
        el('div', {
          style: {
            position: 'absolute',
            left: '12px',
            bottom: '12px',
            height: '32px',
            padding: '0 12px',
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-inverse)',
            background: 'var(--overlay-dark)',
            borderRadius: 'var(--radius-xl)'
          },
          text: '自动识别：' + categoryLabel()
        })
      );

      return stack;
    }

    function renderCategoryTabs() {
      var grid = el('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          height: '46px'
        }
      });

      models.CAPTURE_CATEGORY_OPTIONS.forEach(function (option) {
        var isActive = state.category === option.value;
        grid.appendChild(
          el('button', {
            class: 'chip chip--wide' + (isActive ? ' chip--active' : ''),
            type: 'button',
            style: { height: '46px' },
            'aria-label': option.label + (isActive ? '，已选中' : ''),
            text: option.label,
            onclick: function () {
              state.category = option.value;
              renderContent();
            }
          })
        );
      });

      return grid;
    }

    function renderNameField() {
      var input = el('input', {
        class: 'input__text',
        type: 'text',
        placeholder: generatedClothingName(),
        'aria-label': '衣物名称'
      });
      input.value = state.name;
      input.addEventListener('input', function (event) {
        state.name = event.target.value;
      });

      return el('div', { class: 'stack', style: { gap: '6px' } }, [
        el('div', { class: 'field__label', text: '衣物名称' }),
        el('div', {
          class: 'input',
          style: { height: '48px', borderColor: 'var(--border-medium)' }
        }, [
          el('span', { class: 'input__icon', html: HW.icon('shirt', 18) }),
          input
        ])
      ]);
    }

    function renderNoteField() {
      var area = el('textarea', {
        class: 'input__textarea--compact',
        placeholder: '颜色、尺码、在哪里买的…',
        'aria-label': '备注'
      });
      area.value = state.note;
      area.addEventListener('input', function (event) {
        state.note = event.target.value;
      });

      return el('div', { class: 'stack', style: { gap: '6px' } }, [
        el('div', { class: 'field__label', text: '备注' }),
        area
      ]);
    }

    function renderPurchaseFields() {
      function field(label, placeholder, key, inputMode) {
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
        });
        return el('div', { class: 'stack', style: { gap: '6px' } }, [
          el('div', { class: 'field__label', text: label }),
          el('div', {
            class: 'input',
            style: { height: '48px', background: 'var(--card-soft-gray)' }
          }, [input])
        ]);
      }

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
        renderContent();
      });

      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        field('购买店铺', '购买店铺（选填）', 'storeName'),
        el('div', { class: 'row', style: { gap: '10px' } }, [
          el('div', { class: 'stack', style: { flex: '1', gap: '6px' } }, [
            el('div', { class: 'field__label', text: '价格' }),
            (function () {
              var input = el('input', {
                class: 'input__text',
                type: 'text',
                placeholder: '价格',
                inputmode: 'decimal',
                'aria-label': '价格'
              });
              input.value = state.price;
              input.addEventListener('input', function (event) {
                state.price = event.target.value;
              });
              return el('div', {
                class: 'input',
                style: { height: '48px', background: 'var(--card-soft-gray)' }
              }, [input]);
            })()
          ]),
          el('div', { class: 'stack', style: { flex: '1', gap: '6px' } }, [
            el('div', { class: 'field__label', text: '购买日期' }),
            el('div', {
              class: 'input',
              style: { height: '48px', background: 'var(--card-soft-gray)', padding: '0 12px' }
            }, [dateInput])
          ])
        ]),
        field('购买备注', '购买备注', 'purchaseNote')
      ]);
    }

    function renderOutfitFields() {
      var input = el('input', {
        class: 'input__text',
        type: 'text',
        placeholder: generatedOutfitTitle(),
        'aria-label': '穿搭名称'
      });
      input.value = state.outfitTitle;
      input.addEventListener('input', function (event) {
        state.outfitTitle = event.target.value;
      });

      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        el('div', { class: 'stack', style: { gap: '6px' } }, [
          el('div', { class: 'field__label', text: '穿搭名称' }),
          el('div', {
            class: 'input',
            style: { height: '48px', background: 'var(--card-soft-gray)' }
          }, [input])
        ]),
        renderClothingPicker()
      ]);
    }

    function renderClothingPicker() {
      var children = [
        el('div', { class: 'row row--between' }, [
          el('div', { style: { fontSize: '16px' }, text: '选择衣物' }),
          state.selectedClothingItemIds.length > 0
            ? el('div', {
                style: { fontSize: '12px', color: 'var(--action-black)' },
                text: state.selectedClothingItemIds.length + ' 件已选'
              })
            : null
        ])
      ];

      if (!state.clothingItems.length) {
        children.push(
          el('div', {
            class: 'text-secondary',
            style: { fontSize: '14px' },
            text: '暂无衣物，可先去衣柜添加。'
          })
        );
        return el('div', { class: 'stack', style: { gap: '8px' } }, children);
      }

      var list = el('div', { class: 'stack', style: { gap: '8px' } });

      state.clothingItems.forEach(function (item) {
        var selected = state.selectedClothingItemIds.indexOf(item.id) >= 0;
        var row = el(
          'button',
          {
            class: 'list-row' + (selected ? ' list-row--selected' : ''),
            type: 'button',
            onclick: function () {
              var index = state.selectedClothingItemIds.indexOf(item.id);
              if (index >= 0) {
                state.selectedClothingItemIds.splice(index, 1);
              } else {
                state.selectedClothingItemIds.push(item.id);
              }
              renderContent();
            }
          },
          []
        );

        if (item.photoUris && item.photoUris.length > 0) {
          row.appendChild(
            helpers.photoImage(item.photoUris[0], 'list-row__thumb', item.name)
          );
        } else {
          row.appendChild(
            el('div', { class: 'list-row__thumb-placeholder' }, [
              el('span', { html: HW.icon('shirt', 28) })
            ])
          );
        }

        row.appendChild(
          el('div', { class: 'list-row__body' }, [
            el('div', { class: 'list-row__title', text: item.name }),
            el('div', {
              class: 'list-row__meta',
              text: models.CLOTHING_PICKER_CATEGORY_LABEL[item.category]
            })
          ])
        );

        if (selected) {
          row.appendChild(
            el('span', {
              style: {
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-inverse)'
              },
              html: HW.icon('checkmark_circle_fill', 26)
            })
          );
        } else {
          row.appendChild(el('span', { class: 'list-row__action', text: '选择' }));
        }

        list.appendChild(row);
      });

      children.push(list);
      return el('div', { class: 'stack', style: { gap: '8px' } }, children);
    }

    function renderStoreFields() {
      function field(label, placeholder, key) {
        var input = el('input', {
          class: 'input__text',
          type: 'text',
          placeholder: placeholder,
          'aria-label': label
        });
        input.value = state[key];
        input.addEventListener('input', function (event) {
          state[key] = event.target.value;
        });
        return el('div', { class: 'stack', style: { gap: '6px' } }, [
          el('div', { class: 'field__label', text: label }),
          el('div', {
            class: 'input',
            style: { height: '48px', background: 'var(--card-soft-gray)' }
          }, [input])
        ]);
      }

      var dateInput = el('input', {
        class: 'input__text',
        type: 'date',
        min: '2000-01-01',
        max: HW.utils.todayIsoDate(),
        'aria-label': '逛店日期'
      });
      dateInput.value = state.visitDate;
      dateInput.addEventListener('change', function (event) {
        state.visitDate = event.target.value;
        renderContent();
      });

      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        field('店铺名', generatedStoreVisitName(), 'storeName'),
        field('地点', '商场、商圈或地址', 'districtOrAddress'),
        el('div', { class: 'stack', style: { gap: '6px' } }, [
          el('div', { class: 'field__label', text: '逛店日期' }),
          el('div', {
            class: 'input',
            style: { height: '48px', background: 'var(--card-soft-gray)', padding: '0 12px' }
          }, [dateInput])
        ])
      ]);
    }

    function renderRecentCaptures() {
      if (!state.photoUris.length) {
        return null;
      }
      var grid = el('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          width: '100%',
          height: '112px'
        }
      });
      state.photoUris.slice(0, 3).forEach(function (photoId) {
        grid.appendChild(helpers.photoImage(photoId, 'photo-grid__item', '刚录入'));
      });

      return el('div', { class: 'stack', style: { gap: '10px', marginTop: '4px' } }, [
        el('div', { style: { fontSize: '19px' }, text: '刚录入' }),
        grid
      ]);
    }

    function renderContent() {
      ui.clear(contentHost);

      contentHost.appendChild(renderModeTabs());
      contentHost.appendChild(renderCapturePreview());

      /* 操作行 */
      var actionRow = el('div', { class: 'row', style: { gap: '10px' } });
      actionRow.appendChild(
        el('button', {
          class: 'btn btn--sm btn--secondary',
          type: 'button',
          style: { flex: '1' },
          text: state.isChoosingPhotos ? '选择中...' : '选择照片',
          disabled: state.isSaving || state.isChoosingPhotos,
          onclick: choosePhotos
        })
      );
      actionRow.appendChild(
        el('button', {
          class: 'btn btn--sm',
          type: 'button',
          style: {
            flex: '1',
            background: canSave() ? 'var(--action-black)' : 'var(--text-tertiary)'
          },
          disabled: !canSave(),
          onclick: saveCapture
        }, [
          state.isSaving
            ? el('div', { class: 'spinner spinner--light' })
            : el('span', { text: saveButtonLabel() })
        ])
      );
      contentHost.appendChild(actionRow);

      if (state.captureType === '衣橱') {
        contentHost.appendChild(renderCategoryTabs());
      }

      contentHost.appendChild(renderNameField());
      contentHost.appendChild(renderNoteField());

      if (state.captureType === '美搭') {
        contentHost.appendChild(renderOutfitFields());
      } else if (state.captureType === '店铺') {
        contentHost.appendChild(renderStoreFields());
      } else {
        contentHost.appendChild(renderPurchaseFields());
      }

      if (state.errorMessage) {
        contentHost.appendChild(
          el('div', {
            class: 'text-danger',
            style: { fontSize: '12px' },
            text: state.errorMessage
          })
        );
      }

      var recent = renderRecentCaptures();
      if (recent) {
        contentHost.appendChild(recent);
      }

      helpers.resolvePhotos(contentHost);
    }

    function renderHeader() {
      ui.clear(headerHost);
      headerHost.appendChild(
        ui.secondaryPageHeader({
          title: '拍照录入',
          backAccessibilityText: '返回',
          onBack: function () {
            HW.App.back();
          }
        })
      );
    }

    root.appendChild(headerHost);
    root.appendChild(scrollHost);
    scrollHost.appendChild(contentHost);

    renderHeader();
    renderContent();

    ctx.repositories.clothing.listClothing().then(function (items) {
      state.clothingItems = items;
      renderContent();
    });

    return { el: root, destroy: function () {} };
  };
})(window);
