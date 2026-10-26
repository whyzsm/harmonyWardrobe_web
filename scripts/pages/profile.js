/* 衣不缺 Web 版 — 我的 / ProfilePage
   对应鸿蒙端 entry/src/main/ets/pages/ProfilePage.ets。
   内容列：padding {left:20, right:20, top:2, bottom:132/156}。 */
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
      style: { padding: '2px 20px 156px', gap: '14px' }
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

    /* ---------- 尺码编辑 Sheet ---------- */
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
        subtitle: '保存后用于试穿记录和衣柜信息。',
        render: function (close) {
          var wrap = el('div', { class: 'stack', style: { gap: '14px' } });

          function numericField(label, key, unit, min, max) {
            var errorNode = el('div', {
              style: { width: '100%', fontSize: '11px', lineHeight: '15px', color: 'var(--danger)' }
            });

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
              var error = measurementError(draft[key], min, max, unit);
              errorNode.textContent = error;
              input.parentNode.classList.toggle('input--invalid', !!error);
              saveButton.disabled = hasInvalidMeasurements();
            });

            return el('div', { class: 'stack', style: { gap: '6px', flex: '1', minWidth: '0' } }, [
              el('div', { style: { fontSize: '12px', color: 'var(--text-primary)' }, text: label }),
              el('div', {
                class: 'input',
                style: { height: '44px', background: 'var(--card-soft-gray)', borderColor: 'var(--border-medium)' }
              }, [input]),
              errorNode
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
            return el('div', { class: 'stack', style: { gap: '6px', flex: '1', minWidth: '0' } }, [
              el('div', { style: { fontSize: '12px', color: 'var(--text-primary)' }, text: label }),
              el('div', {
                class: 'input',
                style: { height: '44px', background: 'var(--card-soft-gray)', borderColor: 'var(--border-medium)' }
              }, [input])
            ]);
          }

          wrap.appendChild(
            el('div', { class: 'row', style: { gap: '10px', width: '100%' } }, [
              numericField('身高', 'heightCm', 'cm', models.PROFILE_HEIGHT_MIN_CM, models.PROFILE_HEIGHT_MAX_CM),
              numericField('体重', 'weightKg', 'kg', models.PROFILE_WEIGHT_MIN_KG, models.PROFILE_WEIGHT_MAX_KG),
              numericField('腰围', 'waistCm', 'cm', models.PROFILE_WAIST_MIN_CM, models.PROFILE_WAIST_MAX_CM)
            ])
          );

          wrap.appendChild(
            el('div', {
              style: { width: '100%', fontSize: '13px', color: 'var(--text-primary)', margin: '16px 0 2px' },
              text: '常用衣物尺码'
            })
          );

          wrap.appendChild(
            el('div', { class: 'row', style: { gap: '10px', width: '100%' } }, [
              sizeField('上衣', 'upperSize', '例如 M'),
              sizeField('裤装', 'lowerSize', '例如 27'),
              sizeField('鞋', 'shoeSize', '例如 38')
            ])
          );

          wrap.appendChild(
            el('div', {
              style: { width: '100%', fontSize: '12px', lineHeight: '17px', color: 'var(--text-secondary)', marginTop: '8px' },
              text: '保存后会显示在“我的偏好”的常用尺码中。'
            })
          );

          var errorNode = el('div', {
            style: { width: '100%', fontSize: '12px', lineHeight: '18px', color: 'var(--danger)', marginTop: '10px' }
          });
          wrap.appendChild(errorNode);

          var saveButton = el('button', {
            class: 'btn',
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
                class: 'btn btn--secondary',
                type: 'button',
                text: '稍后',
                onclick: close
              }),
              saveButton
            ])
          );

          saveButton.disabled = hasInvalidMeasurements();

          return el('div', { class: 'sheet__card' }, [wrap]);
        }
      });
    }

    /* ---------- 商圈编辑 Sheet ---------- */
    function openDistrictEditor() {
      var draft = (state.profile.frequentDistricts || []).slice();
      var districtInput = '';

      ui.showSheet({
        title: '管理常逛商圈',
        subtitle: '保存后可在逛店记录页快速筛选路线。',
        render: function (close) {
          var wrap = el('div', { class: 'stack', style: { gap: '13px' } });

          var chipWrap = el('div', {
            class: 'row',
            style: { flexWrap: 'wrap', gap: '0 8px', width: '100%' }
          });

          function renderChips() {
            ui.clear(chipWrap);
            draft.forEach(function (district) {
              var chip = el(
                'button',
                {
                  class: 'cat-chip cat-chip--active',
                  type: 'button',
                  'aria-label': district + '，已选中',
                  onclick: function () {
                    var index = draft.indexOf(district);
                    if (index >= 0) {
                      draft.splice(index, 1);
                    }
                    renderChips();
                  }
                },
                [el('span', { class: 'cat-chip__name', text: district })]
              );
              chip.appendChild(
                el(
                  'span',
                  {
                    class: 'cat-chip__del',
                    role: 'button',
                    'aria-label': '删除 ' + district,
                    onclick: function (event) {
                      event.stopPropagation();
                      var index = draft.indexOf(district);
                      if (index >= 0) {
                        draft.splice(index, 1);
                      }
                      renderChips();
                    }
                  },
                  [el('span', { html: HW.icon('xmark', 11) })]
                )
              );
              chipWrap.appendChild(chip);
            });
          }
          renderChips();

          wrap.appendChild(
            el('div', { style: { width: '100%', fontSize: '12px', color: 'var(--text-primary)' }, text: '常逛地点' })
          );
          wrap.appendChild(chipWrap);

          var area = el('textarea', {
            style: {
              width: '100%',
              height: '86px',
              padding: '12px',
              fontSize: '14px',
              color: 'var(--text-primary)',
              background: 'var(--bg-default)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              resize: 'none',
              boxSizing: 'border-box'
            },
            placeholder: '例如：安福路、长乐路、武康路',
            'aria-label': '补充地点'
          });
          area.value = districtInput;
          area.addEventListener('input', function (event) {
            districtInput = event.target.value;
          });

          wrap.appendChild(
            el('div', { style: { width: '100%', fontSize: '12px', color: 'var(--text-primary)' }, text: '补充地点' })
          );
          wrap.appendChild(area);

          wrap.appendChild(
            el('div', { class: 'sheet__actions' }, [
              el('button', {
                class: 'btn btn--secondary',
                type: 'button',
                text: '稍后',
                onclick: close
              }),
              el('button', {
                class: 'btn',
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

          return el('div', { class: 'sheet__card' }, [wrap]);
        }
      });
    }

    /* ---------- 预算编辑 Sheet ---------- */
    function openBudgetEditor() {
      var commonBudgets = (state.profile.commonBudgets || []).slice();
      var budgetDraft =
        state.profile.monthlyBudget === undefined ? '' : String(state.profile.monthlyBudget);
      var budgetError = '';

      ui.showSheet({
        title: '调整本月预算',
        subtitle: '保存后可以查看本月预算余量。',
        render: function (close) {
          var wrap = el('div', { class: 'stack', style: { gap: '13px' } });

          var chipWrap = el('div', {
            class: 'row',
            style: { flexWrap: 'wrap', gap: '0 8px', width: '100%' }
          });

          function renderChips() {
            ui.clear(chipWrap);
            commonBudgets.forEach(function (amount) {
              var chip = el(
                'button',
                {
                  class: 'cat-chip cat-chip--active',
                  type: 'button',
                  'aria-label': HW.utils.formatBudgetAmount(amount) + '，选择预算',
                  onclick: function () {
                    budgetDraft = String(amount);
                    input.value = String(amount);
                    budgetError = '';
                    hintNode.textContent = defaultHint();
                    renderChips();
                  }
                },
                [el('span', { class: 'cat-chip__name', text: HW.utils.formatBudgetAmount(amount) })]
              );
              chip.appendChild(
                el(
                  'span',
                  {
                    class: 'cat-chip__del',
                    role: 'button',
                    'aria-label': '删除常用预算 ' + HW.utils.formatBudgetAmount(amount),
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
                  [el('span', { html: HW.icon('xmark', 11) })]
                )
              );
              chipWrap.appendChild(chip);
            });
          }
          renderChips();

          wrap.appendChild(
            el('div', { style: { width: '100%', fontSize: '12px', color: 'var(--text-primary)' }, text: '常用预算' })
          );
          wrap.appendChild(chipWrap);

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
            hintNode.style.color = budgetError ? 'var(--danger)' : 'var(--text-secondary)';
          });

          wrap.appendChild(
            el('div', { style: { width: '100%', fontSize: '12px', color: 'var(--text-primary)' }, text: '自定义金额' })
          );
          wrap.appendChild(
            el('div', {
              class: 'input',
              style: { height: '48px', background: 'var(--bg-default)', borderColor: 'var(--border-medium)' }
            }, [input])
          );

          function defaultHint() {
            return '至少 ¥500。保存后会更新本月预算余量和进度条。';
          }

          var hintNode = el('div', {
            style: { width: '100%', fontSize: '12px', lineHeight: '17px', color: 'var(--text-secondary)' },
            text: defaultHint()
          });
          wrap.appendChild(hintNode);

          wrap.appendChild(
            el('div', { class: 'sheet__actions' }, [
              el('button', {
                class: 'btn btn--secondary',
                type: 'button',
                text: '稍后',
                onclick: close
              }),
              el('button', {
                class: 'btn',
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
                      hintNode.style.color = 'var(--danger)';
                      return;
                    }
                    if (numeric < models.PROFILE_BUDGET_MIN) {
                      budgetError = '预算至少为 ¥500。';
                      hintNode.textContent = budgetError;
                      hintNode.style.color = 'var(--danger)';
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

          return el('div', { class: 'sheet__card' }, [wrap]);
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

      return el('div', { class: 'stat-row' }, [
        statItem(state.wardrobeItemCount, '件单品'),
        statItem(state.storeVisitCount, '次逛店'),
        statItem(state.outfitCount, '套搭配')
      ]);
    }

    function sectionHeading(title, meta) {
      return el('div', { class: 'section-heading' }, [
        el('div', { class: 'section-heading__title', text: title }),
        el('div', { class: 'section-heading__meta', text: meta })
      ]);
    }

    function renderPreferenceSection() {
      function preferenceRow(options) {
        return el('div', { class: 'preference-row' }, [
          el('span', { class: 'preference-row__icon', html: HW.icon(options.icon, 19) }),
          el('div', { class: 'preference-row__body' }, [
            el('div', { class: 'preference-row__title', text: options.title }),
            el('div', { class: 'preference-row__desc', text: options.desc })
          ]),
          el('button', {
            class: 'btn--outline-pill btn--outline-pill--sm',
            type: 'button',
            text: options.buttonText || '编辑',
            onclick: options.onClick
          })
        ]);
      }

      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        sectionHeading('我的偏好', '用于记录和整理'),
        el('div', { class: 'preference-card' }, [
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
      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        sectionHeading('我的清单', '计划购买'),
        el('div', { class: 'preference-card' }, [
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
              class: 'btn--outline-pill btn--outline-pill--sm',
              type: 'button',
              text: '查看',
              onclick: function () {
                HW.App.navigate(HW.App.RouteKind.Wishlist, models.AppMainTab.Profile, {});
              }
            })
          ])
        ])
      ]);
    }

    function renderBudgetSection() {
      var budget = state.profile && state.profile.monthlyBudget;
      var hasBudget = budget !== undefined && budget >= 0;

      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        sectionHeading('预算提醒', hasBudget ? '本月 ' + HW.utils.formatBudgetAmount(budget) : '未设置'),
        el('div', { class: 'budget-card' }, [
          el('div', { class: 'budget-card__top' }, [
            el('div', { class: 'budget-card__label' }, [
              el('div', { class: 'budget-card__title', text: '本月逛店预算' }),
              el('div', { class: 'budget-card__desc', text: budgetStatusText() })
            ]),
            el('div', {
              class: 'budget-card__amount',
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
              class: 'budget-card__bottom-text',
              text: hasBudget
                ? '预算 ' + HW.utils.formatBudgetAmount(budget)
                : '消费记录将用于预算统计'
            }),
            el('button', {
              class: 'btn--outline-pill',
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
        sectionHeading('本地存储', '本地保存正常'),
        el('div', { class: 'preference-card' }, [
          el('div', { class: 'local-state-row' }, [
            el('div', { class: 'local-state-row__title', text: '本地照片与记录' }),
            el('div', { class: 'local-state-row__desc', text: localSummary() })
          ])
        ])
      ]);
    }

    function renderDataMigrationSection() {
      function migrationRow(title, desc, buttonText, onClick) {
        return el('div', { class: 'migration-row' }, [
          el('div', { class: 'migration-row__body' }, [
            el('div', { class: 'migration-row__title', text: title }),
            el('div', { class: 'migration-row__desc', text: desc })
          ]),
          el('button', {
            class: 'btn--outline-pill btn--outline-pill--fixed',
            type: 'button',
            text: buttonText,
            onclick: onClick
          })
        ]);
      }

      return el('div', { class: 'stack', style: { gap: '10px' } }, [
        sectionHeading('数据迁移', '换机或安装商店版'),
        el('div', { class: 'preference-card' }, [
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
          el('div', { class: 'notice-text text-danger', text: state.errorMessage })
        );
      }

      if (state.savedMessage) {
        contentHost.appendChild(
          el('div', { class: 'notice-text', text: state.savedMessage })
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
