/* 衣不缺 Web 版 — 新增/编辑逛店 / StoreVisitEditPage
   对应鸿蒙端 entry/src/main/ets/pages/StoreVisitEditPage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  var VISIT_STATUS_OPTIONS = [
    { label: '已去', value: models.StoreVisitStatus.Visited, icon: 'store_fill' },
    { label: '想去', value: models.StoreVisitStatus.WantToVisit, icon: 'heart' },
    { label: '回购', value: models.StoreVisitStatus.Repurchase, icon: 'arrow_clockwise' }
  ];

  var VISIT_FOCUS_TAGS = [
    { label: '试穿', icon: 'shirt' },
    { label: '想回看', icon: 'eye' },
    { label: '需比价', icon: 'creditcard' },
    { label: '已购买', icon: 'bag' }
  ];

  HW.pages.storeEditor = function (route, ctx) {
    var state = {
      initialVisit: undefined,
      storeName: '',
      districtOrAddress: '',
      visitDate: HW.utils.todayIsoDate(),
      photoUris: [],
      status: models.StoreVisitStatus.Visited,
      focusTags: [],
      note: '',
      submitted: false,
      isSaving: false,
      isChoosingPhotos: false,
      errorMessage: ''
    };

    var root = el('div', { class: 'page' });
    var headerHost = el('div');
    var scrollHost = el('div', { class: 'page__body scroll-y' });
    var contentHost = el('div', { class: 'stack', style: { padding: '28px 20px 112px' } });
    var actionHost = el('div', { class: 'action-bar' });

    /* ---------- 校验 ---------- */
    function isStoreNameInvalid() {
      return state.submitted && state.storeName.trim().length === 0;
    }

    function isAddressInvalid() {
      return state.submitted && state.districtOrAddress.trim().length === 0;
    }

    function validateForm() {
      state.submitted = true;
      var valid =
        state.storeName.trim().length > 0 && state.districtOrAddress.trim().length > 0;
      if (!valid) {
        state.errorMessage = '先补上店名和商圈，再保存这条逛店记录。';
      } else {
        state.errorMessage = '';
      }
      return valid;
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
          if (photoUris.length) {
            state.photoUris = HW.utils.appendPhotoUris(state.photoUris, photoUris);
          }
          renderContent();
          renderAction();
        })
        .catch(function (error) {
          state.isChoosingPhotos = false;
          state.errorMessage = HW.utils.userFacingError(error, '选择照片失败，请重试');
          renderContent();
          renderAction();
        });
    }

    function captureStorePhoto() {
      if (state.isSaving || state.isChoosingPhotos) {
        return;
      }
      state.isChoosingPhotos = true;
      state.errorMessage = '';
      renderAction();

      HW.PhotoPickerAdapter.captureFromCamera()
        .then(function (photoUris) {
          state.isChoosingPhotos = false;
          if (photoUris.length) {
            state.photoUris = HW.utils.appendPhotoUris(state.photoUris, photoUris);
          }
          renderContent();
          renderAction();
        })
        .catch(function (error) {
          state.isChoosingPhotos = false;
          state.errorMessage = HW.utils.userFacingError(error, '拍照失败，请重试');
          renderContent();
          renderAction();
        });
    }

    /* ---------- 保存 ---------- */
    function saveStoreVisit() {
      if (!validateForm()) {
        renderContent();
        return;
      }
      if (state.isSaving) {
        return;
      }
      state.isSaving = true;
      state.errorMessage = '';
      renderAction();

      var input = {
        storeName: state.storeName.trim(),
        storeNameSnapshot: state.storeName.trim(),
        districtOrAddress: state.districtOrAddress.trim(),
        visitDate: state.visitDate || HW.utils.todayIsoDate(),
        photoUris: state.photoUris,
        status: state.status,
        focusTags: state.focusTags,
        note: HW.utils.optionalText(state.note)
      };

      var promise = state.initialVisit
        ? ctx.repositories.store.updateStoreVisitWithOptionalStore(
            Object.assign({ id: state.initialVisit.id }, input)
          )
        : ctx.repositories.store.createStoreVisitWithOptionalStore(input);

      promise
        .then(function () {
          state.isSaving = false;
          ctx.showToast('逛店记录已保存');
          HW.App.back();
        })
        .catch(function (error) {
          state.isSaving = false;
          state.errorMessage = HW.utils.userFacingError(error, '保存逛店失败');
          renderContent();
          renderAction();
        });
    }

    /* ---------- 渲染 ---------- */
    function renderPhotoUploader() {
      var hero = el('div', { class: 'photo-hero' });

      if (state.photoUris.length > 0) {
        hero.appendChild(
          helpers.photoCarousel(state.photoUris, {
            alt: '店铺照片',
            className: ''
          })
        );
      } else {
        hero.appendChild(
          el('img', {
            class: 'photo-hero__image',
            src: 'assets/default_store_cover.jpg',
            alt: '默认封面'
          })
        );
      }

      hero.appendChild(el('div', { class: 'photo-hero__scrim' }));
      hero.appendChild(
        el(
          'button',
          {
            class: 'photo-hero__camera',
            type: 'button',
            'aria-label': '拍照',
            html: HW.icon('camera_fill', 24),
            onclick: captureStorePhoto
          },
          []
        )
      );

      var albumText = state.isChoosingPhotos
        ? '选择中...'
        : state.photoUris.length > 1
        ? '已选择 ' + state.photoUris.length + ' 张'
        : '选择照片';

      hero.appendChild(
        el('div', { class: 'photo-hero__content' }, [
          el('div', { class: 'photo-hero__text' }, [
            el('div', { class: 'photo-hero__title', text: '拍下这家店的第一眼' }),
            el('div', {
              class: 'photo-hero__desc',
              text: '招牌、试衣间或想回看的单品都可以'
            })
          ]),
          el(
            'button',
            {
              class: 'photo-picker-btn',
              type: 'button',
              'aria-label': '选择照片',
              text: albumText,
              onclick: pickGalleryPhotos
            },
            []
          )
        ])
      );

      return hero;
    }

    function renderBasicInfo() {
      var storeInput = el('input', {
        class: 'input__text',
        type: 'text',
        placeholder: '例如：静安嘉里 COS',
        'aria-label': '店名 / 品牌'
      });
      storeInput.value = state.storeName;
      storeInput.addEventListener('input', function (event) {
        state.storeName = event.target.value;
        if (state.submitted) {
          state.errorMessage = '';
        }
        renderError();
      });

      var addressInput = el('input', {
        class: 'input__text',
        type: 'text',
        placeholder: '例如：静安寺 · 二楼女装区',
        'aria-label': '商圈 / 地址'
      });
      addressInput.value = state.districtOrAddress;
      addressInput.addEventListener('input', function (event) {
        state.districtOrAddress = event.target.value;
        if (state.submitted) {
          state.errorMessage = '';
        }
        renderError();
      });

      var children = [];

      children.push(
        el('div', { class: 'stack', style: { gap: '8px' } }, [
          el('div', { class: 'row', style: { gap: '8px' } }, [
            el('span', { class: 'text-secondary', html: HW.icon('store_fill', 18) }),
            el('span', { style: { fontSize: '14px' }, text: '店名 / 品牌' })
          ]),
          el('div', {
            class: 'input' + (isStoreNameInvalid() ? ' input--invalid' : ''),
            style: { height: '56px' }
          }, [storeInput]),
          isStoreNameInvalid()
            ? el('div', {
                class: 'text-danger',
                style: { fontSize: '12px' },
                text: '请输入这家店或品牌名称。'
              })
            : null
        ])
      );

      children.push(
        el('div', { class: 'stack', style: { gap: '8px' } }, [
          el('div', { class: 'row', style: { gap: '8px' } }, [
            el('span', { class: 'text-secondary', html: HW.icon('mappin_and_rectangle', 18) }),
            el('span', { style: { fontSize: '14px' }, text: '商圈 / 地址' })
          ]),
          el('div', {
            class: 'input' + (isAddressInvalid() ? ' input--invalid' : ''),
            style: { height: '56px' }
          }, [addressInput]),
          isAddressInvalid()
            ? el('div', {
                class: 'text-danger',
                style: { fontSize: '12px' },
                text: '请输入商圈、商场或大概位置。'
              })
            : null
        ])
      );

      return el('div', { class: 'stack', style: { gap: '24px' } }, children);
    }

    function renderStatusCard() {
      var statusRow = el('div', { class: 'row', style: { gap: '12px' } });
      VISIT_STATUS_OPTIONS.forEach(function (option) {
        var isActive = state.status === option.value;
        statusRow.appendChild(
          el(
            'button',
            {
              class: 'chip chip--wide' + (isActive ? ' chip--active' : ''),
              type: 'button',
              style: { height: '48px', borderRadius: 'var(--radius-full)' },
              'aria-label': option.label + (isActive ? '，已选中' : ''),
              onclick: function () {
                state.status = option.value;
                renderContent();
              }
            },
            [
              el('span', { html: HW.icon(option.icon, 14) }),
              el('span', { text: option.label })
            ]
          )
        );
      });

      var tagGrid = el('div', {
        style: {
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px'
        }
      });
      VISIT_FOCUS_TAGS.forEach(function (tag) {
        var isActive = state.focusTags.indexOf(tag.label) >= 0;
        tagGrid.appendChild(
          el(
            'button',
            {
              class: 'chip chip--wide' + (isActive ? ' chip--active' : ''),
              type: 'button',
              style: { height: '52px', borderRadius: 'var(--radius-full)' },
              'aria-label': tag.label + (isActive ? '，已选中' : ''),
              onclick: function () {
                var index = state.focusTags.indexOf(tag.label);
                if (index >= 0) {
                  state.focusTags.splice(index, 1);
                } else {
                  state.focusTags.push(tag.label);
                }
                renderContent();
              }
            },
            [
              el('span', { html: HW.icon(tag.icon, 14) }),
              el('span', { text: tag.label })
            ]
          )
        );
      });

      function sectionLabel(text) {
        return el('div', { class: 'row', style: { gap: '8px' } }, [
          el('span', {
            style: {
              width: '2px',
              height: '20px',
              background: 'var(--action-black)',
              borderRadius: '1px'
            }
          }),
          el('span', { style: { fontSize: '14px' }, text: text })
        ]);
      }

      return el('div', { class: 'stack', style: { gap: '32px' } }, [
        el('div', { class: 'stack', style: { gap: '12px' } }, [
          sectionLabel('逛店状态'),
          statusRow
        ]),
        el('div', { class: 'stack', style: { gap: '12px' } }, [
          sectionLabel('这次要记什么'),
          tagGrid
        ])
      ]);
    }

    var errorHost = el('div');

    function renderError() {
      ui.clear(errorHost);

      if (state.submitted && (isStoreNameInvalid() || isAddressInvalid())) {
        errorHost.appendChild(
          el('div', {
            style: {
              padding: '12px 13px',
              background: 'var(--bg-gray)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)'
            }
          }, [
            el('div', {
              class: 'text-danger',
              style: { fontSize: '13px' },
              text: '还有信息没填完'
            }),
            el('div', {
              style: { fontSize: '12px', marginTop: '2px' },
              text: '先补上店名和商圈，再保存这条逛店记录。'
            })
          ])
        );
        return;
      }

      if (state.errorMessage) {
        errorHost.appendChild(
          el('div', {
            class: 'text-danger',
            style: { fontSize: '12px' },
            text: state.errorMessage
          })
        );
      }
    }

    function renderContent() {
      ui.clear(contentHost);
      contentHost.appendChild(renderPhotoUploader());
      contentHost.appendChild(errorHost);
      renderError();
      contentHost.appendChild(renderBasicInfo());
      contentHost.appendChild(renderStatusCard());
      helpers.resolvePhotos(contentHost);
    }

    function renderAction() {
      ui.clear(actionHost);

      if (state.isSaving) {
        actionHost.appendChild(
          el('div', { class: 'btn', style: { cursor: 'default' } }, [
            el('div', { class: 'spinner spinner--light' })
          ])
        );
        return;
      }

      actionHost.appendChild(
        el('button', {
          class: 'btn',
          type: 'button',
          text: '保存记录',
          onclick: saveStoreVisit
        })
      );
    }

    function renderHeader() {
      ui.clear(headerHost);
      headerHost.appendChild(
        ui.secondaryPageHeader({
          title: state.initialVisit ? '编辑逛店' : '新增逛店',
          backAccessibilityText: '返回逛店记录',
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

    if (route.params.storeVisitId) {
      ctx.repositories.store
        .getStoreVisitById(route.params.storeVisitId)
        .then(function (visit) {
          state.initialVisit = visit;
          if (visit) {
            state.storeName = visit.storeNameSnapshot || '';
            state.districtOrAddress = visit.districtOrAddress || '';
            state.visitDate = visit.visitDate || HW.utils.todayIsoDate();
            state.photoUris = (visit.photoUris || []).slice();
            state.status = visit.status || models.StoreVisitStatus.Visited;
            state.focusTags = (visit.focusTags || []).slice();
            state.note = visit.note || '';
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
