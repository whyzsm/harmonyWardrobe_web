/* 衣不缺 Web 版 — 新增/编辑逛店 / StoreVisitEditPage
   对应鸿蒙端 entry/src/main/ets/pages/StoreVisitEditPage.ets。
   滚动内容：padding {left:20, right:20, top:20, bottom:28/112}，Column space 32。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  var VISIT_STATUS_OPTIONS = [
    { label: '已去', value: models.StoreVisitStatus.Visited },
    { label: '想去', value: models.StoreVisitStatus.WantToVisit },
    { label: '回购', value: models.StoreVisitStatus.Repurchase }
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
    var contentHost = el('div', {
      class: 'stack',
      style: { padding: '20px 20px 112px', gap: '32px' }
    });
    var actionHost = el('div', { class: 'action-bar action-bar--sheet' });

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
      state.errorMessage = valid ? '' : '还有信息没填完';
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

    /* ---------- 渲染：照片区（有照片时才有 scrim + 叠加文字） ---------- */
    function renderPhotoUploader() {
      var hero = el('div', { class: 'photo-hero' });
      var hasPhoto = state.photoUris.length > 0;

      if (hasPhoto) {
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

      if (hasPhoto) {
        hero.appendChild(el('div', { class: 'photo-hero__scrim' }));
        hero.appendChild(
          el('div', { class: 'photo-hero__overlay' }, [
            el('div', { class: 'photo-hero__title', text: '拍下这家店的第一眼' }),
            el('div', {
              class: 'photo-hero__desc',
              text: '招牌、试衣间或想回看的单品都可以'
            })
          ])
        );
      }

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
        el(
          'button',
          {
            class: 'photo-picker-btn photo-picker-btn--corner',
            type: 'button',
            'aria-label': '选择照片',
            onclick: pickGalleryPhotos
          },
          [
            el('span', { html: HW.icon('picture', 18) }),
            el('span', { text: albumText })
          ]
        )
      );

      return hero;
    }

    /* ---------- 渲染：基础信息（图标在标签行，输入框独立） ---------- */
    function renderBasicInfo() {
      function field(options) {
        var input = el('input', {
          class: 'input-standalone__text',
          type: 'text',
          placeholder: options.placeholder,
          'aria-label': options.label
        });
        input.value = state[options.key];
        input.addEventListener('input', function (event) {
          state[options.key] = event.target.value;
          if (state.submitted) {
            state.errorMessage = '';
          }
          renderErrorBanner();
        });

        var invalid = options.invalid();

        return el('div', { class: 'stack', style: { gap: '10px' } }, [
          el('div', { class: 'field__label-row' }, [
            el('span', { class: 'field__label-icon', html: HW.icon(options.icon, 18) }),
            el('span', { class: 'field__label', text: options.label })
          ]),
          el('div', {
            class: 'input-standalone' + (invalid ? ' input-standalone--invalid' : '')
          }, [input]),
          invalid
            ? el('div', {
                class: 'field__error',
                text: options.errorText
              })
            : null
        ]);
      }

      return el('div', { class: 'stack', style: { gap: '24px' } }, [
        field({
          icon: 'store_fill',
          label: '店名 / 品牌',
          placeholder: '例如：静安嘉里 COS',
          key: 'storeName',
          invalid: isStoreNameInvalid,
          errorText: '请输入这家店或品牌名称。'
        }),
        field({
          icon: 'mappin_and_rectangle',
          label: '商圈 / 地址',
          placeholder: '例如：静安寺 · 二楼女装区',
          key: 'districtOrAddress',
          invalid: isAddressInvalid,
          errorText: '请输入商圈、商场或大概位置。'
        })
      ]);
    }

    /* ---------- 渲染：分区标签（竖条） ---------- */
    function sectionLabel(text) {
      return el('div', { class: 'section-label' }, [
        el('span', { class: 'section-label__bar' }),
        el('span', { class: 'section-label__text', text: text })
      ]);
    }

    /* ---------- 渲染：逛店状态 ---------- */
    function renderStatusSection() {
      var row = el('div', { class: 'status-row' });

      VISIT_STATUS_OPTIONS.forEach(function (option) {
        var isActive = state.status === option.value;
        row.appendChild(
          el(
            'button',
            {
              class: 'status-chip' + (isActive ? ' status-chip--active' : ''),
              type: 'button',
              'aria-label': option.label + (isActive ? '，已选中' : ''),
              text: option.label,
              onclick: function () {
                state.status = option.value;
                renderContent();
              }
            },
            []
          )
        );
      });

      return el('div', { class: 'stack', style: { gap: '16px' } }, [
        sectionLabel('逛店状态'),
        row
      ]);
    }

    /* ---------- 渲染：这次要记什么（2×2 标签网格） ---------- */
    function renderFocusTagSection() {
      var grid = el('div', { class: 'tag-grid' });

      VISIT_FOCUS_TAGS.forEach(function (tag) {
        var isActive = state.focusTags.indexOf(tag.label) >= 0;
        grid.appendChild(
          el(
            'button',
            {
              class: 'tag-cell' + (isActive ? ' tag-cell--active' : ''),
              type: 'button',
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
              el('span', { class: 'tag-cell__icon', html: HW.icon(tag.icon, 18) }),
              el('span', { text: tag.label })
            ]
          )
        );
      });

      return el('div', { class: 'stack', style: { gap: '16px' } }, [
        sectionLabel('这次要记什么'),
        grid
      ]);
    }

    /* ---------- 顶部错误横幅 ---------- */
    var errorHost = el('div', { style: { width: '100%' } });

    function renderErrorBanner() {
      ui.clear(errorHost);
      if (!state.submitted) {
        return;
      }
      if (isStoreNameInvalid() || isAddressInvalid()) {
        errorHost.appendChild(
          el('div', {
            style: {
              width: '100%',
              padding: '12px 13px',
              background: 'var(--bg-gray)',
              border: '1px solid var(--danger)',
              borderRadius: 'var(--radius-md)',
              boxSizing: 'border-box'
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

    /* ---------- 渲染主体 ---------- */
    function renderContent() {
      ui.clear(contentHost);
      contentHost.appendChild(renderPhotoUploader());
      contentHost.appendChild(errorHost);
      renderErrorBanner();
      contentHost.appendChild(renderBasicInfo());
      contentHost.appendChild(renderStatusSection());
      contentHost.appendChild(renderFocusTagSection());
      helpers.resolvePhotos(contentHost);
    }

    function renderAction() {
      ui.clear(actionHost);

      if (state.isSaving) {
        actionHost.appendChild(
          el('div', { class: 'save-btn save-btn--sm-font' }, [
            el('div', { class: 'spinner spinner--light' })
          ])
        );
        return;
      }

      actionHost.appendChild(
        el('button', {
          class: 'save-btn save-btn--sm-font',
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
