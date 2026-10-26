/* 衣不缺 Web 版 — 创建/编辑穿搭 / OutfitEditPage
   对应鸿蒙端 entry/src/main/ets/pages/OutfitEditPage.ets。
   滚动内容：padding {left:20, right:20, top:20, bottom:16/112}，Column space 16。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  HW.pages.outfitEditor = function (route, ctx) {
    var state = {
      initialOutfit: undefined,
      title: '',
      note: '',
      photoUris: [],
      clothingItemIds: [],
      displaySource: models.OutfitDisplaySource.Photo,
      selectedCategoryNames: [],
      categories: [],
      categoryDraft: '',
      showCustomCategoryInput: false,
      selectedPhotoIndex: 0,
      isSaving: false,
      isChoosingPhotos: false,
      deletingCategoryId: '',
      errorMessage: ''
    };

    var root = el('div', { class: 'page' });
    var headerHost = el('div');
    var scrollHost = el('div', { class: 'page__body scroll-y' });
    var contentHost = el('div', {
      class: 'stack',
      style: { padding: '20px 20px 112px', gap: '16px' }
    });
    var actionHost = el('div', { class: 'action-bar action-bar--sheet' });

    /* ---------- 派生值 ---------- */
    function linkedClothingPhotoUris() {
      var uris = [];
      (state.clothingItemIds || []).forEach(function (clothingId) {
        if (uris.length > 0) {
          return;
        }
        var item = state.clothingItems.filter(function (candidate) {
          return candidate.id === clothingId;
        })[0];
        if (item && item.photoUris && item.photoUris.length > 0) {
          var first = String(item.photoUris[0]).trim();
          if (first) {
            uris.push(first);
          }
        }
      });
      return uris;
    }

    function hasRequiredSourcePhoto() {
      if (state.displaySource === models.OutfitDisplaySource.Wardrobe) {
        return linkedClothingPhotoUris().length > 0;
      }
      return state.photoUris.length > 0;
    }

    function categoryValidationError() {
      var draft = String(state.categoryDraft || '')
        .normalize('NFKC')
        .trim()
        .replace(/\s+/g, ' ');
      if (draft.length === 0) {
        return '';
      }
      if (draft.length > models.OUTFIT_CATEGORY_MAX_LENGTH) {
        return '分类名称最多 ' + models.OUTFIT_CATEGORY_MAX_LENGTH + ' 个字符';
      }
      var normalized = HW.utils.normalizeSearchText(draft);
      if (
        normalized === HW.utils.normalizeSearchText('全部') ||
        normalized === HW.utils.normalizeSearchText('未分类')
      ) {
        return '不能使用“全部”或“未分类”';
      }
      return '';
    }

    function canSave() {
      return (
        !state.isSaving &&
        !state.isChoosingPhotos &&
        hasRequiredSourcePhoto() &&
        state.deletingCategoryId === '' &&
        categoryValidationError() === ''
      );
    }

    function saveButtonLabel() {
      if (categoryValidationError() !== '') {
        return '检查分类名称';
      }
      if (hasRequiredSourcePhoto()) {
        return '保存穿搭';
      }
      if (state.displaySource === models.OutfitDisplaySource.Wardrobe) {
        return '先选有照片的衣物';
      }
      return '先添加照片';
    }

    function categoryNamesForSave() {
      var names = state.selectedCategoryNames.slice();
      var draft = String(state.categoryDraft || '').trim();
      if (draft.length > 0) {
        var normalizedDraft = HW.utils.normalizeSearchText(draft);
        var alreadyIncluded = names.some(function (name) {
          return HW.utils.normalizeSearchText(name) === normalizedDraft;
        });
        if (!alreadyIncluded) {
          names.push(draft);
        }
      }
      return names;
    }

    function toggleClothingItem(clothingId) {
      var index = state.clothingItemIds.indexOf(clothingId);
      if (index >= 0) {
        state.clothingItemIds.splice(index, 1);
      } else {
        state.clothingItemIds.push(clothingId);
      }
      renderContent();
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
          state.errorMessage = HW.utils.userFacingError(error, '选择照片失败');
          renderContent();
          renderAction();
        });
    }

    function capturePhoto() {
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
          state.errorMessage = HW.utils.userFacingError(error, '拍照失败');
          renderContent();
          renderAction();
        });
    }

    function removePhoto(index) {
      state.photoUris.splice(index, 1);
      if (state.selectedPhotoIndex >= state.photoUris.length) {
        state.selectedPhotoIndex = Math.max(0, state.photoUris.length - 1);
      }
      renderContent();
      renderAction();
    }

    /* ---------- 分类管理 ---------- */
    function addCustomCategory() {
      state.showCustomCategoryInput = true;
      renderContent();
      var input = contentHost.querySelector('#outfit_custom_category_input');
      if (input) {
        input.focus();
      }
    }

    function confirmDeleteCategory(category) {
      var message =
        category.usageCount > 0
          ? '该分类下有 ' + category.usageCount + ' 套穿搭，删除后会移除这些穿搭与该分类的关联。'
          : '确定删除“' + category.name + '”分类吗？';

      ui.showConfirm({
        title: '删除分类',
        message: message,
        confirmText: '删除',
        danger: true
      }).then(function (confirmed) {
        if (!confirmed) {
          return;
        }
        state.deletingCategoryId = category.id;
        renderContent();

        ctx.repositories.outfit
          .deleteOutfitCategory(category.id)
          .then(function () {
            state.selectedCategoryNames = state.selectedCategoryNames.filter(function (name) {
              return name !== category.name;
            });
            if (
              HW.utils.normalizeSearchText(state.categoryDraft) ===
              HW.utils.normalizeSearchText(category.name)
            ) {
              state.categoryDraft = '';
            }
            state.deletingCategoryId = '';
            return ctx.repositories.outfit.listOutfitCategories();
          })
          .then(function (categories) {
            state.categories = categories;
            renderContent();
            ctx.showToast('分类已删除');
          })
          .catch(function (error) {
            state.deletingCategoryId = '';
            renderContent();
            ctx.showToast(HW.utils.userFacingError(error, '删除分类失败'), true);
          });
      });
    }

    /* ---------- 保存 ---------- */
    function saveOutfit() {
      if (!canSave()) {
        return;
      }
      state.isSaving = true;
      state.errorMessage = '';
      renderAction();

      var input = {
        title: state.title.trim() || '穿搭',
        categoryNames: categoryNamesForSave(),
        photoUris: state.photoUris,
        clothingItemIds: state.clothingItemIds,
        displaySource: state.displaySource,
        note: HW.utils.optionalText(state.note)
      };

      var promise = state.initialOutfit
        ? ctx.repositories.outfit.updateOutfit(
            Object.assign({ id: state.initialOutfit.id }, input)
          )
        : ctx.repositories.outfit.createOutfit(input);

      promise
        .then(function () {
          state.isSaving = false;
          ctx.showToast('穿搭已保存');
          HW.App.back();
        })
        .catch(function (error) {
          state.isSaving = false;
          state.errorMessage = HW.utils.userFacingError(error, '保存穿搭失败');
          renderContent();
          renderAction();
        });
    }

    /* ---------- 渲染：展示来源分段控件 ---------- */
    function renderDisplaySourceSelector() {
      function seg(options) {
        var isActive = state.displaySource === options.value;
        return el(
          'button',
          {
            class: 'seg' + (isActive ? ' seg--active' : ''),
            type: 'button',
            'aria-label': options.label + (isActive ? '，已选中' : ''),
            onclick: function () {
              state.displaySource = options.value;
              renderContent();
              renderAction();
            }
          },
          [
            el('span', { class: 'seg__title', text: options.label }),
            el('span', { class: 'seg__desc', text: options.description })
          ]
        );
      }

      return el('div', { class: 'seg-card' }, [
        el('div', { class: 'seg-card__title', text: '展示内容' }),
        el('div', { class: 'seg-row' }, [
          seg({
            label: '上传照片',
            description: '展示穿搭实拍图',
            value: models.OutfitDisplaySource.Photo
          }),
          seg({
            label: '选衣柜单品',
            description: '展示衣柜单品图',
            value: models.OutfitDisplaySource.Wardrobe
          })
        ])
      ]);
    }

    /* ---------- 渲染：照片选择器（scrim + 叠加文字始终存在） ---------- */
    function renderPhotoSelector(title, description) {
      var hero = el('div', { class: 'photo-hero photo-hero--sheet' });

      if (state.photoUris.length > 0) {
        hero.appendChild(
          helpers.photoCarousel(state.photoUris, {
            activeIndex: state.selectedPhotoIndex,
            onSelect: function (index) {
              state.selectedPhotoIndex = index;
            },
            alt: title
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

      hero.appendChild(el('div', { class: 'photo-hero__scrim' }));
      hero.appendChild(
        el('div', { class: 'photo-hero__overlay' }, [
          el('div', { class: 'photo-hero__title', text: title }),
          el('div', { class: 'photo-hero__desc', text: description }),
          el(
            'button',
            {
              class: 'photo-picker-btn',
              type: 'button',
              'aria-label': '选择照片',
              onclick: pickGalleryPhotos
            },
            [
              el('span', { html: HW.icon('picture', 18) }),
              el('span', { text: photoAlbumLabel() })
            ]
          )
        ])
      );

      hero.appendChild(
        el(
          'button',
          {
            class: 'photo-hero__camera',
            type: 'button',
            'aria-label': '拍照',
            html: HW.icon('camera_fill', 24),
            onclick: capturePhoto
          },
          []
        )
      );

      var children = [hero];

      if (state.photoUris.length > 0) {
        children.push(
          el('div', { class: 'stack', style: { gap: '8px' } }, [
            el('div', {
              style: { fontSize: '13px', color: 'var(--text-secondary)' },
              text: '已选照片 ' + state.photoUris.length + '/' + models.MAX_USER_PHOTOS
            }),
            helpers.photoThumbnails(state.photoUris, {
              activeIndex: state.selectedPhotoIndex,
              onSelect: function (index) {
                state.selectedPhotoIndex = index;
                renderContent();
              },
              onRemove: removePhoto
            })
          ])
        );
      }

      return el('div', { class: 'stack', style: { gap: '12px' } }, children);
    }

    function photoAlbumLabel() {
      if (state.isChoosingPhotos) {
        return '选择中...';
      }
      if (state.photoUris.length > 1) {
        return '已选择 ' + state.photoUris.length + ' 张';
      }
      if (state.photoUris.length === 1) {
        return '继续选图';
      }
      return '选择照片';
    }

    /* ---------- 渲染：分类字段（带 × 的 pill chip） ---------- */
    function renderCategoryField() {
      var children = [
        el('div', { style: { width: '100%', fontSize: '14px', color: 'var(--text-secondary)' }, text: '分类（选填）' })
      ];

      var chipWrap = el('div', {
        class: 'row',
        style: { flexWrap: 'wrap', gap: '0 12px', width: '100%' }
      });

      state.selectedCategoryNames.forEach(function (name) {
        var category = state.categories.filter(function (candidate) {
          return candidate.name === name;
        })[0];
        var isDeleting = state.deletingCategoryId && category && state.deletingCategoryId === category.id;

        var chip = el(
          'button',
          {
            class: 'cat-chip cat-chip--active',
            type: 'button',
            'aria-label': name + '，已选中',
            onclick: function () {
              var index = state.selectedCategoryNames.indexOf(name);
              if (index >= 0) {
                state.selectedCategoryNames.splice(index, 1);
              }
              renderContent();
            }
          },
          [el('span', { class: 'cat-chip__name', text: name })]
        );

        chip.appendChild(
          el(
            'span',
            {
              class: 'cat-chip__del',
              role: 'button',
              'aria-label': '删除分类 ' + name,
              onclick: function (event) {
                event.stopPropagation();
                if (category) {
                  confirmDeleteCategory(category);
                } else {
                  var index = state.selectedCategoryNames.indexOf(name);
                  if (index >= 0) {
                    state.selectedCategoryNames.splice(index, 1);
                  }
                  renderContent();
                }
              }
            },
            [el('span', { html: HW.icon('xmark', 11) })]
          )
        );

        chipWrap.appendChild(chip);
      });

      chipWrap.appendChild(
        el('button', {
          class: 'cat-add' + (state.showCustomCategoryInput ? ' cat-add--active' : ''),
          type: 'button',
          text: '自定义分类',
          onclick: addCustomCategory
        })
      );

      children.push(chipWrap);

      if (state.showCustomCategoryInput) {
        var error = categoryValidationError();
        var input = el('input', {
          id: 'outfit_custom_category_input',
          class: 'input__text',
          type: 'text',
          placeholder: '输入分类名称',
          'aria-label': '输入分类名称'
        });
        input.value = state.categoryDraft;
        input.addEventListener('input', function (event) {
          state.categoryDraft = event.target.value;
          var currentError = categoryValidationError();

          if (currentError) {
            input.parentNode.classList.add('input--invalid');
          } else {
            input.parentNode.classList.remove('input--invalid');
          }

          var errNode = contentHost.querySelector('#outfit_custom_category_error');
          if (currentError) {
            if (errNode) {
              errNode.textContent = currentError;
            } else {
              var newErrNode = el('div', {
                id: 'outfit_custom_category_error',
                class: 'text-danger',
                style: { fontSize: '12px' },
                text: currentError
              });
              input.parentNode.parentNode.insertBefore(newErrNode, input.parentNode.nextSibling);
            }
          } else if (errNode) {
            errNode.remove();
          }

          renderAction();
        });

        var inputWrap = el('div', {
          class: 'input' + (error ? ' input--invalid' : ''),
          style: { height: '48px' }
        }, [input]);

        children.push(inputWrap);

        if (error) {
          children.push(
            el('div', {
              id: 'outfit_custom_category_error',
              class: 'text-danger',
              style: { fontSize: '12px' },
              text: error
            })
          );
        }
      }

      return el('div', { class: 'stack', style: { gap: '10px' } }, children);
    }

    /* ---------- 渲染：衣物选择器 ---------- */
    function renderClothingPicker(title, description) {
      var children = [
        el('div', { class: 'picker__head-row' }, [
          el('div', { class: 'picker__head-title', text: title }),
          state.clothingItemIds.length > 0
            ? el('div', {
                class: 'picker__head-count',
                text: state.clothingItemIds.length + ' 件已选'
              })
            : null
        ])
      ];

      if (description) {
        children.push(el('div', { class: 'picker__head-desc', text: description }));
      }

      if (!state.clothingItems.length) {
        children.push(
          el('div', {
            class: 'picker__head-desc',
            text: '暂无衣物，可先去衣柜添加。'
          })
        );
        return el('div', { class: 'picker' }, children);
      }

      var list = el('div', { class: 'picker__list' });

      state.clothingItems.forEach(function (item) {
        var selected = state.clothingItemIds.indexOf(item.id) >= 0;

        var row = el(
          'button',
          {
            class: 'picker-item' + (selected ? ' picker-item--selected' : ''),
            type: 'button',
            'aria-label':
              item.name + '，' + (selected ? '已选择' : '未选择'),
            onclick: function () {
              toggleClothingItem(item.id);
            }
          },
          []
        );

        if (item.photoUris && item.photoUris.length > 0) {
          row.appendChild(
            helpers.photoImage(item.photoUris[0], 'picker-item__thumb', item.name)
          );
        } else {
          row.appendChild(
            el('div', { class: 'picker-item__thumb-placeholder' }, [
              el('span', { html: HW.icon('shirt', 28) })
            ])
          );
        }

        row.appendChild(
          el('div', { class: 'picker-item__body' }, [
            el('div', { class: 'picker-item__name', text: item.name }),
            el('div', {
              class: 'picker-item__cat',
              text: models.CLOTHING_PICKER_CATEGORY_LABEL[item.category]
            })
          ])
        );

        if (selected) {
          row.appendChild(
            el('span', {
              class: 'picker-item__check',
              html: HW.icon('checkmark_circle_fill', 26)
            })
          );
        } else {
          row.appendChild(el('span', { class: 'list-row__action', text: '选择' }));
        }

        list.appendChild(row);
      });

      children.push(list);
      return el('div', { class: 'picker' }, children);
    }

    /* ---------- 渲染主体 ---------- */
    function renderContent() {
      ui.clear(contentHost);

      contentHost.appendChild(renderDisplaySourceSelector());

      var isPhotoMode = state.displaySource === models.OutfitDisplaySource.Photo;

      function buildInfoCard() {
        var titleInput = el('input', {
        class: 'input__text',
        type: 'text',
        placeholder: '穿搭名称，可不填',
        'aria-label': '穿搭名称'
      });
        titleInput.value = state.title;
        titleInput.addEventListener('input', function (event) {
          state.title = event.target.value;
        });

        var noteArea = el('textarea', {
          class: 'input__textarea input__textarea--compact',
          placeholder: '记录场景、试穿感受或搭配想法',
          'aria-label': '小记'
        });
        noteArea.value = state.note;
        noteArea.addEventListener('input', function (event) {
          state.note = event.target.value;
        });

        return el('div', { class: 'card' }, [
          el('div', { class: 'card__title', text: '穿搭信息（选填）' }),
          el('div', { class: 'input' }, [titleInput]),
          renderCategoryField(),
          isPhotoMode
            ? renderClothingPicker(
                '关联衣柜单品（选填）',
                '可以把这套穿搭关联到已有衣服，方便以后回看。'
              )
            : renderClothingPicker(
                '选择衣柜单品',
                '至少选择一件有照片的衣物，也可以补充上传穿搭照片。'
              ),
          el('div', { class: 'stack', style: { gap: '8px', width: '100%' } }, [
            el('div', {
              style: { fontSize: '14px', color: 'var(--text-secondary)' },
              text: '小记（选填）'
            }),
            noteArea
          ])
        ]);
      }

      if (isPhotoMode) {
        contentHost.appendChild(
          renderPhotoSelector('上传这套穿搭照片', '整体、细节或上身效果都可以')
        );
        contentHost.appendChild(buildInfoCard());
      } else {
        contentHost.appendChild(buildInfoCard());
        contentHost.appendChild(
          renderPhotoSelector('补充穿搭照片（选填）', '有整体照或上身照时可以放这里')
        );
      }

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
          el('div', { class: 'save-btn' }, [el('div', { class: 'spinner spinner--light' })])
        );
        return;
      }

      if (canSave()) {
        actionHost.appendChild(
          el('button', {
            class: 'save-btn',
            type: 'button',
            text: '保存穿搭',
            onclick: saveOutfit
          })
        );
        return;
      }

      actionHost.appendChild(
        el('div', { class: 'save-btn save-btn--off', text: saveButtonLabel() })
      );
    }

    function renderHeader() {
      ui.clear(headerHost);
      headerHost.appendChild(
        ui.secondaryPageHeader({
          title: state.initialOutfit ? '编辑穿搭' : '创建穿搭',
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
      renderAction();
    }

    /* ---------- 初始化 ---------- */
    root.appendChild(headerHost);
    root.appendChild(scrollHost);
    root.appendChild(actionHost);
    scrollHost.appendChild(contentHost);

    Promise.all([
      ctx.repositories.clothing.listClothing(),
      ctx.repositories.outfit.listOutfitCategories()
    ])
      .then(function (results) {
        state.clothingItems = results[0];
        state.categories = results[1];

        if (route.params.outfitId) {
          return ctx.repositories.outfit.getOutfitById(route.params.outfitId);
        }
        return undefined;
      })
      .then(function (outfit) {
        if (outfit) {
          state.initialOutfit = outfit;
          state.title = helpers.editableOutfitTitle(outfit);
          state.note = outfit.note || '';
          state.photoUris = (outfit.photoUris || []).slice();
          state.clothingItemIds = (outfit.clothingItemIds || []).slice();
          state.displaySource = outfit.displaySource || models.OutfitDisplaySource.Photo;
          state.selectedCategoryNames = (outfit.categoryNames || []).slice();

          /* 编辑回填：无照片但有关联单品时，强制切到衣柜单品模式 */
          if (state.photoUris.length === 0 && state.clothingItemIds.length > 0) {
            state.displaySource = models.OutfitDisplaySource.Wardrobe;
          }
        } else {
          /* 新建：默认选中「通勤」分类；无分类时展开自定义输入 */
          var tongbu = state.categories.filter(function (category) {
            return (
              HW.utils.normalizeSearchText(category.name) ===
              HW.utils.normalizeSearchText('通勤')
            );
          })[0];
          if (tongbu) {
            state.selectedCategoryNames = [tongbu.name];
          }
          if (state.categories.length === 0) {
            state.showCustomCategoryInput = true;
          }
        }
        renderAll();
      })
      .catch(function (error) {
        state.errorMessage = HW.utils.userFacingError(error, '加载分类失败');
        renderAll();
      });

    return { el: root, destroy: function () {} };
  };
})(window);
