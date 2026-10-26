/* 衣不缺 Web 版 — 我的 / ProfilePage
   对应鸿蒙端 entry/src/main/ets/pages/ProfilePage.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var helpers = HW.pageHelpers;
  var models = HW.models;

  HW.pages = HW.pages || {};

  HW.pages.profile = function (route, ctx) {
    var state = {
      profile: null,
      wardrobeItemCount: 0,
      storeVisitCount: 0,
      outfitCount: 0,
      monthlySpent: 0,
      loading: true,
      errorMessage: '',
      savedMessage: ''
    };

    var root = el('div', { class: 'page' });
    var scrollHost = el('div', { class: 'page__body scroll-y' });
    var contentHost = el('div', {
      class: 'stack',
      style: { padding: '2px 20px 132px' }
    });

    /* ---------- 派生值 ---------- */
    function currentMeasurementSummary() {
      var profile = state.profile || {};
      var sizes = [];
      if (profile.upperSize) {
        sizes.push('上衣 ' + profile.upperSize);
      }
      if (profile.lowerSize) {
        sizes.push('裤装 ' + profile.lowerSize);
      }
      if (profile.shoeSize) {
        sizes.push('鞋 ' + profile.shoeSize);
      }
      if (sizes.length > 0) {
        return sizes.join(' · ');
      }

      var body = [];
      if (profile.heightCm !== undefined) {
        body.push('身高 ' + profile.heightCm + 'cm');
      }
      if (profile.weightKg !== undefined) {
        body.push('体重 ' + profile.weightKg + 'kg');
      }
      if (profile.waistCm !== undefined) {
        body.push('腰围 ' + profile.waistCm + 'cm');
      }
      if (body.length > 0) {
        return body.join(' · ');
      }
      return '填写身形信息后可用于试穿记录';
    }

    function currentDistrictSummary() {
      var profile = state.profile || {};
      var districts = profile.frequentDistricts || [];
      if (districts.length === 0) {
        return '尚未设置';
      }
      return districts.join(' · ');
    }

    function budgetRemaining() {
      var budget = state.profile && state.profile.monthlyBudget;
      if (budget === undefined || budget < 0) {
        return 0;
      }
      return Math.max(0, budget - state.monthlySpent);
    }

    function budgetProgressPercent() {
      var budget = state.profile && state.profile.monthlyBudget;
      if (budget === undefined || budget < 0 || budget === 0) {
        return 0;
      }
      return Math.min(100, Math.round((state.monthlySpent / budget) * 100));
    }

    function budgetStatusText() {
      var budget = state.profile && state.profile.monthlyBudget;
      if (budget === undefined || budget < 0) {
        if (state.storeVisitCount > 0) {
          return '已记录 ' + state.storeVisitCount + ' 次逛店，预算尚未设置。';
        }
        return '预算尚未设置。';
      }
      if (budgetRemaining() > 0) {
        return '还可用 ' + HW.utils.formatBudgetAmount(budgetRemaining()) + '，适合再留一件主单品。';
      }
      return '已达到本月预算。';
    }

    function localSummary() {
      var profile = state.profile || {};
      if (!profile.updatedAt) {
        return '衣柜照片、穿搭和逛店记录都保存在本机。';
      }
      return (
        '身形信息更新于 ' +
        HW.utils.formatDateTime(profile.updatedAt) +
        '，衣柜照片和记录保存在本机。'
      );
    }

    /* ---------- 加载 ---------- */
    function load() {
      state.loading = true;
      state.errorMessage = '';
      render();

      Promise.all([
        ctx.repositories.profile.getProfile(),
        ctx.repositories.clothing.getClothingSummary(HW.utils.monthKey(new Date())),
        ctx.repositories.store.getStoreVisitCount(),
        ctx.repositories.outfit.getOutfitCount()
      ])
        .then(function (results) {
          state.profile = results[0];
          state.wardrobeItemCount = results[1].totalCount;
          state.monthlySpent = results[1].monthlySpent;
          state.storeVisitCount = results[2];
          state.outfitCount = results[3];
          state.loading = false;
          render();
        })
        .catch(function (error) {
          state.loading = false;
          state.errorMessage = HW.utils.userFacingError(error, '加载个人信息失败');
          render();
        });
    }

    /* ---------- 尺码编辑 ---------- */
    function openMeasurementEditor() {
      var draft = {
        heightCm: state.profile.heightCm,
        weightKg: state.profile.weightKg,
        waistCm: state.profile.waistCm,
        upperSize: state.profile.upperSize || '',
        lowerSize: state.profile.lowerSize || '',
        shoeSize: state.profile.shoeSize || ''
      };
      var errorMessage = '';

      function measurementError(value, min, max, unit) {
        var trimmed = String(value == null ? '' : value).trim();
        if (trimmed.length === 0) {
          return '';
        }
        var numeric = Number(trimmed);
        if (!Number.isFinite(numeric)) {
          return '请输入数字';
        }
        if (numeric < min || numeric > max) {
          return '请输入 ' + min + '-' + max + unit;
        }
        return '';
      }

      function hasInvalidMeasurements() {
        return !!(
          measurementError(draft.heightCm, models.PROFILE_HEIGHT_MIN_CM, models.PROFILE_HEIGHT_MAX_CM, 'cm') ||
          measurementError(draft.weightKg, models.PROFILE_WEIGHT_MIN_KG, models.PROFILE_WEIGHT_MAX_KG, 'kg') ||
          measurementError(draft.waistCm, models.PROFILE_WAIST_MIN_CM, models.PROFILE_WAIST_MAX_CM, 'cm')
        );
      }

      ui.showSheet({
        title: '编辑常用尺码',
        render: function (close) {
          var wrap = el('div', { class: 'stack', style: { gap: '20px' } });

          wrap.appendChild(
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '12px', lineHeight: '17px' },
              text: '保存后用于试穿记录和衣柜信息。'
            })
          );

          function numericField(label, key, unit, min, max) {
            var input = el('input', {
              class: 'input__text',
              type: 'text',
              inputmode: 'decimal',
              placeholder: unit,
              'aria-label': label
            });
            input.value = draft[key] === undefined ? '' : String(draft[key]);
            input.addEventListener('input', function (event) {
              draft[key] = event.target.value;
              errorNode.textContent = '';
              var error = measurementError(draft[key], min, max, unit);
              input.parentNode.classList.toggle('input--invalid', !!error);
              saveButton.disabled = hasInvalidMeasurements();
            });

            return el('div', { class: 'stack', style: { gap: '6px' } }, [
              el('div', { class: 'field__label', text: label }),
              el('div', { class: 'input', style: { height: '48px' } }, [input])
            ]);
          }

          function sizeField(label, key, placeholder) {
            var input = el('input', {
              class: 'input__text',
              type: 'text',
              placeholder: placeholder,
              'aria-label': label
            });
            input.value = draft[key] || '';
            input.addEventListener('input', function (event) {
              draft[key] = event.target.value;
            });
            return el('div', { class: 'stack', style: { gap: '6px' } }, [
              el('div', { class: 'field__label', text: label }),
              el('div', { class: 'input', style: { height: '48px' } }, [input])
            ]);
          }

          wrap.appendChild(
            el('div', { class: 'field-grid field-grid--3' }, [
              numericField('身高', 'heightCm', 'cm', models.PROFILE_HEIGHT_MIN_CM, models.PROFILE_HEIGHT_MAX_CM),
              numericField('体重', 'weightKg', 'kg', models.PROFILE_WEIGHT_MIN_KG, models.PROFILE_WEIGHT_MAX_KG),
              numericField('腰围', 'waistCm', 'cm', models.PROFILE_WAIST_MIN_CM, models.PROFILE_WAIST_MAX_CM)
            ])
          );

          wrap.appendChild(
            el('div', { class: 'field__label', style: { fontSize: '13px' }, text: '常用衣物尺码' })
          );

          wrap.appendChild(
            el('div', { class: 'field-grid field-grid--3' }, [
              sizeField('上衣', 'upperSize', '例如 M'),
              sizeField('裤装', 'lowerSize', '例如 27'),
              sizeField('鞋', 'shoeSize', '例如 38')
            ])
          );

          wrap.appendChild(
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '12px', lineHeight: '17px' },
              text: '保存后会显示在“我的偏好”的常用尺码中。'
            })
          );

          var errorNode = el('div', {
            class: 'text-danger',
            style: { fontSize: '12px', lineHeight: '18px' }
          });
          wrap.appendChild(errorNode);

          var saveButton = el('button', {
            class: 'btn btn--sm',
            type: 'button',
            text: '保存',
            onclick: function () {
              if (hasInvalidMeasurements()) {
                errorNode.textContent = '请检查身高、体重、腰围，填写合理数字。';
                return;
              }
              ctx.repositories.profile
                .saveProfile({
                  heightCm: draft.heightCm === '' ? undefined : Number(draft.heightCm),
                  weightKg: draft.weightKg === '' ? undefined : Number(draft.weightKg),
                  waistCm: draft.waistCm === '' ? undefined : Number(draft.waistCm),
                  upperSize: draft.upperSize,
                  lowerSize: draft.lowerSize,
                  shoeSize: draft.shoeSize,
                  frequentDistricts: state.profile.frequentDistricts,
                  monthlyBudget: state.profile.monthlyBudget,
                  commonBudgets: state.profile.commonBudgets
                })
                .then(function (profile) {
                  state.profile = profile;
                  state.savedMessage = '已保存个人信息';
                  state.errorMessage = '';
                  close();
                  render();
                })
                .catch(function (error) {
                  errorNode.textContent = HW.utils.userFacingError(error, '保存个人信息失败');
                });
            }
          });

          wrap.appendChild(
            el('div', { class: 'sheet__actions' }, [
              el('button', {
                class: 'btn btn--sm btn--secondary',
                type: 'button',
                text: '稍后',
                onclick: close
              }),
              saveButton
            ])
          );

          saveButton.disabled = hasInvalidMeasurements();

          return wrap;
        }
      });
    }

    /* ---------- 商圈编辑 ---------- */
    function openDistrictEditor() {
      var draft = (state.profile.frequentDistricts || []).slice();
      var districtInput = '';

      ui.showSheet({
        title: '管理常逛商圈',
        render: function (close) {
          var wrap = el('div', { class: 'stack', style: { gap: '20px' } });

          wrap.appendChild(
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '12px', lineHeight: '17px' },
              text: '保存后可在逛店记录页快速筛选路线。'
            })
          );

          var chipWrap = el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } });

          function renderChips() {
            ui.clear(chipWrap);
            draft.forEach(function (district) {
              chipWrap.appendChild(
                el(
                  'button',
                  {
                    class: 'chip chip--round chip--active',
                    type: 'button',
                    'aria-label': district + '，删除已选地点',
                    style: {
                      background: 'var(--action-black)',
                      color: 'var(--text-inverse)',
                      borderColor: 'var(--action-black)'
                    },
                    onclick: function () {
                      var index = draft.indexOf(district);
                      if (index >= 0) {
                        draft.splice(index, 1);
                      }
                      renderChips();
                    }
                  },
                  [el('span', { text: district })]
                )
              );
            });
          }
          renderChips();

          wrap.appendChild(
            el('div', { class: 'stack', style: { gap: '8px' } }, [
              el('div', { class: 'field__label', text: '常逛地点' }),
              chipWrap
            ])
          );

          var area = el('textarea', {
            class: 'input__textarea--compact',
            style: { height: '86px' },
            placeholder: '例如：安福路、长乐路、武康路',
            'aria-label': '补充地点'
          });
          area.value = districtInput;
          area.addEventListener('input', function (event) {
            districtInput = event.target.value;
          });

          wrap.appendChild(
            el('div', { class: 'stack', style: { gap: '8px' } }, [
              el('div', { class: 'field__label', text: '补充地点' }),
              area
            ])
          );

          wrap.appendChild(
            el('div', { class: 'sheet__actions' }, [
              el('button', {
                class: 'btn btn--sm btn--secondary',
                type: 'button',
                text: '稍后',
                onclick: close
              }),
              el('button', {
                class: 'btn btn--sm',
                type: 'button',
                text: '保存',
                onclick: function () {
                  var parsed = districtInput
                    .split(/[\n,，、]/)
                    .map(function (item) {
                      return item.trim();
                    })
                    .filter(function (item) {
                      return item.length > 0;
                    });

                  var merged = HW.utils.uniquePreservingOrder(parsed.concat(draft)).slice(
                    0,
                    models.MAX_COMMON_ITEMS
                  );

                  ctx.repositories.profile
                    .saveProfile({
                      heightCm: state.profile.heightCm,
                      weightKg: state.profile.weightKg,
                      waistCm: state.profile.waistCm,
                      upperSize: state.profile.upperSize,
                      lowerSize: state.profile.lowerSize,
                      shoeSize: state.profile.shoeSize,
                      frequentDistricts: merged,
                      monthlyBudget: state.profile.monthlyBudget,
                      commonBudgets: state.profile.commonBudgets
                    })
                    .then(function (profile) {
                      state.profile = profile;
                      state.savedMessage = '常逛商圈已保存。';
                      close();
                      render();
                    })
                    .catch(function (error) {
                      state.errorMessage = HW.utils.userFacingError(error, '保存个人偏好失败');
                      close();
                      render();
                    });
                }
              })
            ])
          );

          return wrap;
        }
      });
    }

    /* ---------- 预算编辑 ---------- */
    function openBudgetEditor() {
      var commonBudgets = (state.profile.commonBudgets || []).slice();
      var budgetDraft =
        state.profile.monthlyBudget === undefined ? '' : String(state.profile.monthlyBudget);
      var budgetError = '';

      ui.showSheet({
        title: '调整本月预算',
        render: function (close) {
          var wrap = el('div', { class: 'stack', style: { gap: '20px' } });

          wrap.appendChild(
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '12px', lineHeight: '17px' },
              text: '保存后可以查看本月预算余量。'
            })
          );

          var chipWrap = el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } });

          function renderChips() {
            ui.clear(chipWrap);
            commonBudgets.forEach(function (amount) {
              var chip = el(
                'button',
                {
                  class: 'chip chip--round chip--active',
                  type: 'button',
                  'aria-label': HW.utils.formatBudgetAmount(amount) + '，选择预算',
                  style: {
                    background: 'var(--action-black)',
                    color: 'var(--text-inverse)',
                    borderColor: 'var(--action-black)'
                  },
                  onclick: function () {
                    budgetDraft = String(amount);
                    input.value = String(amount);
                    budgetError = '';
                    hintNode.textContent = defaultHint();
                    renderChips();
                  }
                },
                [el('span', { text: HW.utils.formatBudgetAmount(amount) })]
              );

              chip.appendChild(
                el(
                  'span',
                  {
                    role: 'button',
                    'aria-label': '删除常用预算 ' + HW.utils.formatBudgetAmount(amount),
                    style: { marginLeft: '6px', display: 'inline-flex' },
                    onclick: function (event) {
                      event.stopPropagation();
                      var index = commonBudgets.indexOf(amount);
                      if (index >= 0) {
                        commonBudgets.splice(index, 1);
                      }
                      if (String(budgetDraft) === String(amount)) {
                        budgetDraft = '';
                        input.value = '';
                      }
                      renderChips();
                    }
                  },
                  [el('span', { html: HW.icon('xmark', 12) })]
                )
              );

              chipWrap.appendChild(chip);
            });
          }
          renderChips();

          wrap.appendChild(
            el('div', { class: 'stack', style: { gap: '8px' } }, [
              el('div', { class: 'field__label', text: '常用预算' }),
              chipWrap
            ])
          );

          var input = el('input', {
            class: 'input__text',
            type: 'text',
            inputmode: 'decimal',
            placeholder: '输入预算金额',
            'aria-label': '自定义金额'
          });
          input.value = budgetDraft;
          input.addEventListener('input', function (event) {
            budgetDraft = event.target.value;
            var trimmed = String(budgetDraft).trim();
            budgetError = '';
            if (trimmed.length > 0) {
              var numeric = Number(trimmed);
              if (!Number.isFinite(numeric)) {
                budgetError = '请输入数字';
              } else if (numeric < models.PROFILE_BUDGET_MIN) {
                budgetError = '预算至少为 ¥500。';
              }
            }
            input.parentNode.classList.toggle('input--invalid', !!budgetError);
            hintNode.textContent = budgetError || defaultHint();
          });

          wrap.appendChild(
            el('div', { class: 'stack', style: { gap: '8px' } }, [
              el('div', { class: 'field__label', text: '自定义金额' }),
              el('div', { class: 'input', style: { height: '48px' } }, [input])
            ])
          );

          function defaultHint() {
            return '至少 ¥500。保存后会更新本月预算余量和进度条。';
          }

          var hintNode = el('div', {
            class: 'text-secondary',
            style: { fontSize: '12px', lineHeight: '17px' },
            text: defaultHint()
          });
          wrap.appendChild(hintNode);

          wrap.appendChild(
            el('div', { class: 'sheet__actions' }, [
              el('button', {
                class: 'btn btn--sm btn--secondary',
                type: 'button',
                text: '稍后',
                onclick: close
              }),
              el('button', {
                class: 'btn btn--sm',
                type: 'button',
                text: '保存',
                onclick: function () {
                  var trimmed = String(budgetDraft).trim();
                  var monthlyBudget;

                  if (trimmed.length > 0) {
                    var numeric = Number(trimmed);
                    if (!Number.isFinite(numeric)) {
                      budgetError = '请输入数字';
                      hintNode.textContent = budgetError;
                      hintNode.className = 'text-danger';
                      hintNode.style.fontSize = '12px';
                      hintNode.style.lineHeight = '17px';
                      return;
                    }
                    if (numeric < models.PROFILE_BUDGET_MIN) {
                      budgetError = '预算至少为 ¥500。';
                      hintNode.textContent = budgetError;
                      hintNode.className = 'text-danger';
                      hintNode.style.fontSize = '12px';
                      hintNode.style.lineHeight = '17px';
                      return;
                    }
                    monthlyBudget = numeric;
                    if (commonBudgets.indexOf(Math.round(numeric)) < 0) {
                      commonBudgets.push(Math.round(numeric));
                      commonBudgets = commonBudgets.slice(0, models.MAX_COMMON_ITEMS);
                    }
                  }

                  ctx.repositories.profile
                    .saveProfile({
                      heightCm: state.profile.heightCm,
                      weightKg: state.profile.weightKg,
                      waistCm: state.profile.waistCm,
                      upperSize: state.profile.upperSize,
                      lowerSize: state.profile.lowerSize,
                      shoeSize: state.profile.shoeSize,
                      frequentDistricts: state.profile.frequentDistricts,
                      monthlyBudget: monthlyBudget,
                      commonBudgets: commonBudgets
                    })
                    .then(function (profile) {
                      state.profile = profile;
                      state.savedMessage = '本月预算已保存。';
                      close();
                      render();
                    })
                    .catch(function (error) {
                      state.errorMessage = HW.utils.userFacingError(error, '保存预算失败');
                      close();
                      render();
                    });
                }
              })
            ])
          );

          return wrap;
        }
      });
    }

    /* ---------- 备份 ---------- */
    function exportLocalBackup() {
      HW.LocalBackupService.exportBackup()
        .then(function (summary) {
          ctx.showToast('已导出本地备份，包含 ' + summary.photoCount + ' 张照片。');
        })
        .catch(function (error) {
          ctx.showToast(HW.utils.userFacingError(error, '导出本地备份失败'), true);
        });
    }

    function confirmImportLocalBackup() {
      ui.showConfirm({
        title: '导入本地备份',
        message: '导入会替换当前应用内的本地记录。请确认已选择正确的备份文件。',
        confirmText: '继续导入',
        cancelText: '取消',
        danger: false
      }).then(function (confirmed) {
        if (!confirmed) {
          return;
        }
        HW.LocalBackupService.selectImportFile()
          .then(function (file) {
            if (!file) {
              return;
            }
            return HW.LocalBackupService.importBackup(file).then(function (summary) {
              ctx.showToast('已导入本地备份，恢复 ' + summary.photoCount + ' 张照片。');
              load();
            });
          })
          .catch(function (error) {
            ctx.showToast(HW.utils.userFacingError(error, '导入本地备份失败'), true);
          });
      });
    }

    /* ---------- 渲染 ---------- */
    function renderHero() {
      return el('div', { class: 'profile-hero' }, [
        el('div', { class: 'profile-hero__badge', text: '我的衣柜档案' }),
        el('div', { class: 'profile-hero__title', text: '周末逛店计划' }),
        el('div', {
          class: 'profile-hero__desc',
          text: '尺码、预算、常逛商圈和购买备注，都集中在这里管理。'
        })
      ]);
    }

    function renderStats() {
      function statItem(value, label) {
        return el('div', { class: 'stat-item' }, [
          el('div', { class: 'stat-item__value', text: String(value) }),
          el('div', { class: 'stat-item__label', text: label })
        ]);
      }

      return el('div', { class: 'stat-row', style: { margin: '14px 0' } }, [
        statItem(state.wardrobeItemCount, '件单品'),
        statItem(state.storeVisitCount, '次逛店'),
        statItem(state.outfitCount, '套搭配')
      ]);
    }

    function renderPreferenceSection() {
      function preferenceRow(options) {
        return el('div', { class: 'preference-row' }, [
          el('span', { class: 'preference-row__icon', html: HW.icon(options.icon, 20) }),
          el('div', { class: 'preference-row__body' }, [
            el('div', { class: 'preference-row__title', text: options.title }),
            el('div', { class: 'preference-row__desc', text: options.desc })
          ]),
          el('button', {
            class: 'btn btn--link',
            type: 'button',
            text: options.buttonText || '编辑',
            onclick: options.onClick
          })
        ]);
      }

      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        el('div', { class: 'row row--between' }, [
          el('div', { class: 'section__title', text: '我的偏好' }),
          el('div', { class: 'section__meta', text: '用于记录和整理' })
        ]),
        el('div', { class: 'stack', style: { gap: '1px' } }, [
          preferenceRow({
            icon: 'shirt',
            title: '常用尺码',
            desc: currentMeasurementSummary(),
            onClick: openMeasurementEditor
          }),
          el('div', { class: 'divider' }),
          preferenceRow({
            icon: 'mappin_and_rectangle',
            title: '常逛商圈',
            desc: currentDistrictSummary(),
            onClick: openDistrictEditor
          })
        ])
      ]);
    }

    /**
     * 我的清单 / 心愿清单入口
     * 鸿蒙端 ProfilePage.ets 定义了 WishlistSection() 但未在 build() 中调用，
     * 导致心愿清单页没有入口；Web 版按原设计补上该入口。
     */
    function renderWishlistSection() {
      return el('div', { class: 'stack', style: { gap: '10px', marginTop: '14px' } }, [
        el('div', { class: 'row row--between' }, [
          el('div', { class: 'section__title', text: '我的清单' }),
          el('div', { class: 'section__meta', text: '计划购买' })
        ]),
        el('div', { class: 'preference-row' }, [
          el('span', { class: 'preference-row__icon', html: HW.icon('heart_fill', 19) }),
          el('div', { class: 'preference-row__body' }, [
            el('div', { class: 'preference-row__title', text: '心愿清单' }),
            el('div', {
              class: 'preference-row__desc',
              text: '记录想买的单品、门店和价格'
            })
          ]),
          el('button', {
            class: 'btn btn--link',
            type: 'button',
            text: '查看',
            onclick: function () {
              HW.App.navigate(HW.App.RouteKind.Wishlist, models.AppMainTab.Profile, {});
            }
          })
        ])
      ]);
    }

    function renderBudgetSection() {
      var budget = state.profile && state.profile.monthlyBudget;
      var hasBudget = budget !== undefined && budget >= 0;

      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        el('div', { class: 'row row--between' }, [
          el('div', { class: 'section__title', text: '预算提醒' }),
          el('div', {
            class: 'section__meta',
            text: hasBudget ? '本月 ' + HW.utils.formatBudgetAmount(budget) : '未设置'
          })
        ]),
        el('div', { class: 'budget-card' }, [
          el('div', { class: 'budget-card__top' }, [
            el('div', { class: 'stack', style: { gap: '2px' } }, [
              el('div', { style: { fontSize: '14px' }, text: '本月逛店预算' }),
              el('div', {
                class: 'text-secondary',
                style: { fontSize: '12px' },
                text: budgetStatusText()
              })
            ]),
            el('div', {
              class: 'budget-card__amount',
              'aria-label': hasBudget
                ? '本月剩余预算 ' + HW.utils.formatBudgetAmount(budgetRemaining())
                : '尚未设置预算',
              text: hasBudget ? HW.utils.formatBudgetAmount(budgetRemaining()) : '--'
            })
          ]),
          hasBudget
            ? el('div', { class: 'budget-progress' }, [
                el('div', {
                  class: 'budget-progress__fill',
                  style: { width: budgetProgressPercent() + '%' }
                })
              ])
            : null,
          el('div', { class: 'budget-card__bottom' }, [
            el('div', {
              class: 'text-secondary',
              style: { fontSize: '12px' },
              text: hasBudget
                ? '预算 ' + HW.utils.formatBudgetAmount(budget)
                : '消费记录将用于预算统计'
            }),
            el('button', {
              class: 'btn btn--link',
              type: 'button',
              text: '调整',
              onclick: openBudgetEditor
            })
          ])
        ])
      ]);
    }

    function renderLocalStorageSection() {
      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        el('div', { class: 'row row--between' }, [
          el('div', { class: 'section__title', text: '本地存储' }),
          el('div', { class: 'section__meta', text: '本地保存正常' })
        ]),
        el('div', { class: 'preference-row' }, [
          el('span', { class: 'preference-row__icon', html: HW.icon('info', 20) }),
          el('div', { class: 'preference-row__body' }, [
            el('div', { class: 'preference-row__title', text: '本地照片与记录' }),
            el('div', { class: 'preference-row__desc', text: localSummary() })
          ])
        ])
      ]);
    }

    function renderDataMigrationSection() {
      function migrationRow(title, desc, buttonText, onClick) {
        return el('div', { class: 'preference-row' }, [
          el('div', { class: 'preference-row__body' }, [
            el('div', { class: 'preference-row__title', text: title }),
            el('div', { class: 'preference-row__desc', text: desc })
          ]),
          el('button', {
            class: 'btn btn--sm btn--outline',
            type: 'button',
            style: { width: '68px', height: '40px', flex: '0 0 auto' },
            text: buttonText,
            onclick: onClick
          })
        ]);
      }

      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        el('div', { class: 'row row--between' }, [
          el('div', { class: 'section__title', text: '数据迁移' }),
          el('div', { class: 'section__meta', text: '换机或安装商店版' })
        ]),
        el('div', { class: 'stack', style: { gap: '1px' } }, [
          migrationRow('导出本地备份', '保存当前记录和私有照片', '导出', exportLocalBackup),
          el('div', { class: 'divider' }),
          migrationRow('导入本地备份', '替换当前应用内的本地记录', '导入', confirmImportLocalBackup)
        ])
      ]);
    }

    function render() {
      ui.clear(contentHost);

      if (state.loading) {
        contentHost.appendChild(ui.loadingBlock(''));
        return;
      }

      contentHost.appendChild(renderHero());
      contentHost.appendChild(renderStats());
      contentHost.appendChild(renderPreferenceSection());
      contentHost.appendChild(renderWishlistSection());

      if (state.errorMessage) {
        contentHost.appendChild(
          el('div', {
            class: 'text-danger',
            style: { fontSize: '13px' },
            text: state.errorMessage
          })
        );
      }

      if (state.savedMessage) {
        contentHost.appendChild(
          el('div', {
            style: { fontSize: '13px', color: 'var(--action-black)' },
            text: state.savedMessage
          })
        );
      }

      contentHost.appendChild(renderBudgetSection());
      contentHost.appendChild(renderLocalStorageSection());
      contentHost.appendChild(renderDataMigrationSection());
    }

    root.appendChild(scrollHost);
    scrollHost.appendChild(contentHost);

    render();
    load();

    return { el: root, destroy: function () {} };
  };
})(window);
