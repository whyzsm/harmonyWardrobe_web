/* 衣不缺 Web 版 — 记录每日穿搭 / WearLogEditPage
   对应鸿蒙端 entry/src/main/ets/pages/WearLogEditPage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  HW.pages.wearLogEditor = function (route, ctx) {
    var state = {
      initialWearLog: undefined,
      outfits: [],
      outfitTemplateId: route.params.outfitId || '',
      wornDate: HW.utils.todayIsoDate(),
      photoUris: [],
      placeText: '',
      note: '',
      isSaving: false,
      isChoosingPhotos: false,
      isDeleting: false,
      errorMessage: ''
    };

    var root = el('div', { class: 'page' });
    var headerHost = el('div');
    var scrollHost = el('div', { class: 'page__body scroll-y' });
    var contentHost = el('div', { class: 'stack', style: { padding: '20px 20px 20px' } });

    function canSave() {
      return (
        !state.isSaving &&
        !state.isChoosingPhotos &&
        !state.isDeleting &&
        state.wornDate.trim().length > 0 &&
        (state.photoUris.length > 0 || state.note.trim().length > 0)
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
          state.errorMessage = HW.utils.userFacingError(error, '选择照片失败');
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
          state.errorMessage = HW.utils.userFacingError(error, '拍照失败');
          renderContent();
        });
    }

    /* ---------- 保存 / 删除 ---------- */
    function saveWearLog() {
      if (!canSave()) {
        return;
      }
      state.isSaving = true;
      state.errorMessage = '';
      renderContent();

      var input = {
        outfitTemplateId: state.outfitTemplateId,
        wornDate: state.wornDate,
        photoUris: state.photoUris,
        placeText: HW.utils.optionalText(state.placeText),
        note: HW.utils.optionalText(state.note)
      };

      var promise = state.initialWearLog
        ? ctx.repositories.wearLog.updateWearLog(
            Object.assign({ id: state.initialWearLog.id }, input)
          )
        : ctx.repositories.wearLog.createWearLog(input);

      promise
        .then(function () {
          state.isSaving = false;
          ctx.showToast('穿着记录已保存');
          HW.App.back();
        })
        .catch(function (error) {
          state.isSaving = false;
          state.errorMessage = HW.utils.userFacingError(error, '保存穿着记录失败');
          renderContent();
        });
    }

    function confirmDeleteWearLog() {
      ui.showConfirm({
        title: '删除穿着记录',
        message: '确定要删除这条穿着记录吗？照片也会一并移除。',
        confirmText: '删除',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) {
          return;
        }
        state.isDeleting = true;
        renderContent();

        ctx.repositories.wearLog
          .deleteWearLog(state.initialWearLog.id)
          .then(function () {
            HW.App.back();
            ctx.showToast('穿着记录已删除');
          })
          .catch(function (error) {
            state.isDeleting = false;
            state.errorMessage = HW.utils.userFacingError(error, '删除穿着记录失败');
            renderContent();
          });
      });
    }

    /* ---------- 渲染 ---------- */
    function renderOutfitPicker() {
      var children = [el('div', { style: { fontSize: '16px' }, text: '选择穿搭' })];

      if (!state.outfits.length) {
        children.push(
          el('div', {
            class: 'text-secondary',
            style: { fontSize: '14px' },
            text: '暂无穿搭，可先记录一套穿搭。'
          })
        );
        return el('div', { class: 'stack', style: { gap: '8px' } }, children);
      }

      var list = el('div', { class: 'stack', style: { gap: '8px' } });

      state.outfits.forEach(function (outfit) {
        var selected = state.outfitTemplateId === outfit.id;
        var row = el(
          'button',
          {
            class: 'list-row' + (selected ? ' list-row--selected' : ''),
            type: 'button',
            style: { padding: '10px', borderRadius: 'var(--radius-lg)' },
            onclick: function () {
              state.outfitTemplateId = outfit.id;
              renderContent();
            }
          },
          []
        );

        row.appendChild(
          el('div', { class: 'list-row__body' }, [
            el('div', { class: 'list-row__title', text: outfit.title }),
            el('div', {
              class: 'list-row__meta',
              text: (outfit.clothingItemIds || []).length + ' 件单品'
            })
          ])
        );

        row.appendChild(
          el('span', {
            class: 'list-row__action' + (selected ? ' list-row__action--active' : ''),
            text: selected ? '已选' : '选择'
          })
        );

        list.appendChild(row);
      });

      children.push(list);
      return el('div', { class: 'stack', style: { gap: '8px' } }, children);
    }

    function renderContent() {
      ui.clear(contentHost);

      contentHost.appendChild(renderOutfitPicker());

      /* 穿搭日期 */
      var dateInput = el('input', {
        class: 'input__text',
        type: 'date',
        min: '2000-01-01',
        max: HW.utils.todayIsoDate(),
        'aria-label': '穿搭日期'
      });
      dateInput.value = state.wornDate;
      dateInput.addEventListener('change', function (event) {
        state.wornDate = event.target.value;
        renderContent();
      });

      contentHost.appendChild(
        el('div', { class: 'stack', style: { gap: '6px' } }, [
          el('div', { class: 'field__label', text: '穿搭日期' }),
          el('div', { class: 'input', style: { height: '44px' } }, [dateInput])
        ])
      );

      /* 图片区 */
      var photoArea = el('div', {
        style: {
          width: '100%',
          height: '220px',
          borderRadius: 'var(--radius-xs)',
          overflow: 'hidden',
          background: 'var(--card-muted)'
        }
      });

      if (state.photoUris.length > 0) {
        photoArea.appendChild(
          helpers.photoCarousel(state.photoUris, { alt: '穿着照片', className: '' })
        );
      } else {
        photoArea.appendChild(
          el('img', {
            class: 'photo-hero__image',
            src: 'assets/default_fashion_cover.jpg',
            alt: '默认封面'
          })
        );
      }
      contentHost.appendChild(photoArea);

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

      /* 地点 */
      var placeInput = el('input', {
        class: 'input__text',
        type: 'text',
        placeholder: '地点',
        'aria-label': '地点'
      });
      placeInput.value = state.placeText;
      placeInput.addEventListener('input', function (event) {
        state.placeText = event.target.value;
      });

      contentHost.appendChild(
        el('div', { class: 'stack', style: { gap: '6px' } }, [
          el('div', { class: 'field__label', text: '地点' }),
          el('div', { class: 'input', style: { height: '44px' } }, [placeInput])
        ])
      );

      /* 小记 */
      var noteArea = helpers.textArea({
        value: state.note,
        placeholder: '小记',
        onInput: function (value) {
          state.note = value;
        }
      });
      noteArea.style.height = '96px';

      contentHost.appendChild(
        el('div', { class: 'stack', style: { gap: '6px' } }, [
          el('div', { class: 'field__label', text: '小记' }),
          noteArea
        ])
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
      if (state.initialWearLog) {
        var deleteButton = el('button', {
          class: 'btn btn--sm btn--danger',
          type: 'button',
          text: '删除记录',
          disabled: state.isDeleting,
          onclick: confirmDeleteWearLog
        });
        if (state.isDeleting) {
          deleteButton.innerHTML = '';
          deleteButton.appendChild(el('div', { class: 'spinner spinner--light' }));
        }
        contentHost.appendChild(deleteButton);
      }

      /* 保存 */
      var saveButton = el('button', {
        class: 'btn btn--sm',
        type: 'button',
        text: '保存记录',
        disabled: !canSave(),
        style: canSave()
          ? {}
          : { background: 'var(--text-disabled)', color: 'var(--text-primary)' },
        onclick: saveWearLog
      });
      if (state.isSaving) {
        saveButton.innerHTML = '';
        saveButton.appendChild(el('div', { class: 'spinner spinner--light' }));
      }
      contentHost.appendChild(saveButton);

      helpers.resolvePhotos(contentHost);
    }

    function renderHeader() {
      ui.clear(headerHost);
      headerHost.appendChild(
        ui.secondaryPageHeader({
          title: state.initialWearLog ? '编辑每日穿搭' : '记录每日穿搭',
          backAccessibilityText: '返回穿搭',
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

    Promise.all([
      ctx.repositories.outfit.listOutfits(),
      route.params.wearLogId
        ? ctx.repositories.wearLog.getWearLogById(route.params.wearLogId)
        : Promise.resolve(undefined)
    ])
      .then(function (results) {
        state.outfits = results[0];
        state.initialWearLog = results[1];
        if (state.initialWearLog) {
          state.outfitTemplateId = state.initialWearLog.outfitTemplateId || '';
          state.wornDate = state.initialWearLog.wornDate || HW.utils.todayIsoDate();
          state.photoUris = (state.initialWearLog.photoUris || []).slice();
          state.placeText = state.initialWearLog.placeText || '';
          state.note = state.initialWearLog.note || '';
        }
        renderAll();
      })
      .catch(function () {
        renderAll();
      });

    return { el: root, destroy: function () {} };
  };
})(window);
