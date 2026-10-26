/* 衣不缺 Web 版 — UI 基础 / UI Primitives
   渲染工具、Toast、确认对话框、底部弹层、照片预览。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var icon = HW.icon;

  /* ---------- DOM 渲染 ---------- */
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) {
          return;
        }
        if (key === 'class') {
          node.className = value;
        } else if (key === 'html') {
          node.innerHTML = value;
        } else if (key === 'text') {
          node.textContent = value;
        } else if (key === 'style' && typeof value === 'object') {
          Object.keys(value).forEach(function (styleKey) {
            node.style[styleKey] = value[styleKey];
          });
        } else if (key.indexOf('on') === 0 && typeof value === 'function') {
          node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (key === 'dataset') {
          Object.keys(value).forEach(function (dataKey) {
            node.dataset[dataKey] = value[dataKey];
          });
        } else {
          node.setAttribute(key, value === true ? '' : value);
        }
      });
    }
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    if (children === null || children === undefined) {
      return;
    }
    if (Array.isArray(children)) {
      children.forEach(function (child) {
        appendChildren(node, child);
      });
      return;
    }
    if (children instanceof Node) {
      node.appendChild(children);
      return;
    }
    node.appendChild(document.createTextNode(String(children)));
  }

  function clear(node) {
    while (node && node.firstChild) {
      node.removeChild(node.firstChild);
    }
    return node;
  }

  /** 转义 HTML，所有用户输入必须经过此函数 */
  function escapeHtml(value) {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Toast ---------- */
  var toastLayer = null;

  function ensureToastLayer() {
    if (!toastLayer || !toastLayer.parentNode) {
      toastLayer = el('div', { class: 'toast-layer' });
      var canvas = document.querySelector('.app-canvas');
      (canvas || document.body).appendChild(toastLayer);
    }
    return toastLayer;
  }

  function showToast(message, isDanger) {
    var layer = ensureToastLayer();
    var node = el('div', {
      class: 'toast' + (isDanger ? ' toast--danger' : ''),
      text: message
    });
    layer.appendChild(node);
    setTimeout(function () {
      if (node.parentNode) {
        node.parentNode.removeChild(node);
      }
    }, 2200);
  }

  /* ---------- 确认对话框 ---------- */
  /**
   * @param {{title:string,message:string,confirmText?:string,cancelText?:string,danger?:boolean}} options
   * @returns {Promise<boolean>}
   */
  function showConfirm(options) {
    var opts = options || {};
    return new Promise(function (resolve) {
      var canvas = document.querySelector('.app-canvas') || document.body;

      function close(result) {
        if (backdrop.parentNode) {
          backdrop.parentNode.removeChild(backdrop);
        }
        resolve(result);
      }

      var actions = el('div', { class: 'dialog__actions' }, [
        el('button', {
          class: 'dialog__action',
          type: 'button',
          text: opts.cancelText || '取消',
          onclick: function () {
            close(false);
          }
        }),
        el('button', {
          class:
            'dialog__action dialog__action--primary' +
            (opts.danger ? ' dialog__action--danger' : ''),
          type: 'button',
          text: opts.confirmText || '删除',
          onclick: function () {
            close(true);
          }
        })
      ]);

      var dialog = el('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true' }, [
        el('div', { class: 'dialog__body' }, [
          el('div', { class: 'dialog__title', text: opts.title || '确认操作' }),
          el('div', { class: 'dialog__message', text: opts.message || '' })
        ]),
        actions
      ]);

      var backdrop = el(
        'div',
        {
          class: 'dialog-backdrop',
          onclick: function (event) {
            if (event.target === backdrop) {
              close(false);
            }
          }
        },
        [dialog]
      );

      canvas.appendChild(backdrop);
    });
  }

  /* ---------- 底部弹层 ---------- */
  /**
   * @param {{title?:string, render:(close:Function)=>Node, onClose?:Function}} options
   */
  function showSheet(options) {
    var opts = options || {};
    var canvas = document.querySelector('.app-canvas') || document.body;

    function close() {
      if (backdrop.parentNode) {
        backdrop.parentNode.removeChild(backdrop);
      }
      if (opts.onClose) {
        opts.onClose();
      }
    }

    var sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    var header = el('div', { class: 'sheet__header' }, [
      el('div', { class: 'sheet__title', text: opts.title || '' }),
      el('button', {
        class: 'sheet__cancel',
        type: 'button',
        text: '取消',
        onclick: close
      })
    ]);
    sheet.appendChild(header);

    var body = el('div', { class: 'sheet__body' });
    sheet.appendChild(body);

    var backdrop = el(
      'div',
      {
        class: 'sheet-backdrop',
        onclick: function (event) {
          if (event.target === backdrop) {
            close();
          }
        }
      },
      [sheet]
    );

    canvas.appendChild(backdrop);

    if (opts.render) {
      body.appendChild(opts.render(close));
    }

    return { close: close, body: body, sheet: sheet };
  }

  /* ---------- 全屏照片预览 ---------- */
  function showPhotoPreview(options) {
    var opts = options || {};
    var canvas = document.querySelector('.app-canvas') || document.body;
    var photos = opts.photos || [];
    var index = HW.utils.clampIndex(opts.index || 0, photos.length);

    if (!photos.length) {
      return null;
    }

    function close() {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }

    function renderStage() {
      var stage = el('div', { class: 'photo-preview__stage' });
      var image = el('img', {
        class: 'photo-preview__image',
        src: '',
        alt: opts.title || '照片预览'
      });
      stage.appendChild(image);

      HW.PhotoStore.resolve(photos[index]).then(function (url) {
        image.src = url;
      });

      if (photos.length > 1) {
        stage.addEventListener('click', function (event) {
          var rect = stage.getBoundingClientRect();
          var offset = event.clientX - rect.left;
          if (offset < rect.width / 2) {
            index = (index - 1 + photos.length) % photos.length;
          } else {
            index = (index + 1) % photos.length;
          }
          renderStage();
          updateCount();
        });
      }

      return stage;
    }

    var countNode = el('div', { class: 'photo-preview__count' });
    function updateCount() {
      countNode.textContent = photos.length > 1 ? index + 1 + ' / ' + photos.length : '';
    }
    updateCount();

    var overlay = el('div', { class: 'photo-preview' }, [
      renderStage(),
      el('div', { class: 'photo-preview__bar' }, [
        el('div', { class: 'photo-preview__titles' }, [
          el('div', { class: 'photo-preview__title', text: opts.title || '' }),
          countNode
        ]),
        el('button', {
          class: 'photo-preview__close',
          type: 'button',
          text: '关闭',
          onclick: close
        })
      ])
    ]);

    if (photos.length > 1) {
      overlay.appendChild(
        el('div', { class: 'photo-preview__hint', text: '左右滑动' })
      );
    }

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        close();
      }
    });

    canvas.appendChild(overlay);
    return { close: close };
  }

  /* ---------- 共享组件 ---------- */

  /** 次级页面顶栏（返回 + 标题 + 可选编辑） */
  function secondaryPageHeader(options) {
    var opts = options || {};
    return el('div', { class: 'top-bar top-bar--glass' }, [
      el(
        'button',
        {
          class: 'icon-button',
          type: 'button',
          'aria-label': opts.backAccessibilityText || '返回',
          html: icon('arrow_left', 24),
          onclick: opts.onBack
        },
        []
      ),
      el('div', { class: 'top-bar__title--center', text: opts.title || '' }),
      opts.showEditAction
        ? el(
            'button',
            {
              class: 'icon-button',
              type: 'button',
              'aria-label': '编辑',
              html: icon('square_and_pencil', 23),
              onclick: opts.onEdit
            },
            []
          )
        : el('div', { class: 'top-bar__spacer' })
    ]);
  }

  /** 已保存但被筛选排除的提示条 */
  function savedFilterNotice(visible, onViewAll) {
    if (!visible) {
      return el('div', { class: 'saved-filter-notice', style: { display: 'none' } });
    }
    return el('div', { class: 'saved-filter-notice' }, [
      el('div', { class: 'saved-filter-notice__text', text: '已保存，当前筛选未显示' }),
      el('button', {
        class: 'btn btn--link',
        type: 'button',
        'aria-label': '查看全部记录',
        text: '查看全部',
        onclick: onViewAll
      })
    ]);
  }

  /** 空态卡片 */
  function emptyState(title, description) {
    return el('div', { class: 'empty-state' }, [
      el('div', { class: 'empty-state__title', text: title }),
      el('div', { class: 'empty-state__desc', text: description })
    ]);
  }

  /** 图片墙空态（衣柜/穿搭/逛店） */
  function wallEmptyState(options) {
    var opts = options || {};
    var clickable = opts.onClick
      ? {
          role: 'button',
          tabindex: '0',
          'aria-label': opts.accessibilityText || '',
          onclick: opts.onClick,
          onkeydown: function (event) {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              opts.onClick();
            }
          }
        }
      : {};

    var attrs = Object.assign(
      {
        class: 'wall-empty__card',
        html:
          (opts.icon ? icon(opts.icon, 36) : '') +
          '<div class="wall-empty__card-title">' +
          escapeHtml(opts.cardTitle || '') +
          '</div>' +
          '<div class="wall-empty__card-desc">' +
          escapeHtml(opts.cardDesc || '') +
          '</div>'
      },
      clickable
    );

    return el('div', { class: 'wall-empty' }, [
      el('div', attrs),
      el('div', { class: 'wall-empty__title', text: opts.title || '' }),
      el('div', { class: 'wall-empty__desc', text: opts.desc || '' })
    ]);
  }

  /** 加载态 */
  function loadingBlock(text, extraText) {
    return el('div', { class: 'loading-block' }, [
      el('div', { class: 'spinner' }),
      el('div', { class: 'loading-block__text', text: text || '' }),
      extraText
        ? el('div', { class: 'loading-block__text', text: extraText })
        : null
    ]);
  }

  /** 错误态（带重试） */
  function errorBlock(message, onRetry) {
    return el('div', { class: 'stack stack--md', style: { padding: '28px 20px' } }, [
      el('div', { class: 'text-danger', text: message }),
      onRetry
        ? el('button', {
            class: 'btn btn--sm',
            type: 'button',
            text: '重试',
            onclick: onRetry
          })
        : null
    ]);
  }

  /** 详情行 */
  function detailRow(label, value, wideLabel) {
    return el('div', { class: 'detail-row' }, [
      el('div', {
        class: 'detail-row__label' + (wideLabel ? ' detail-row__label--wide' : ''),
        text: label
      }),
      el('div', { class: 'detail-row__value', text: value })
    ]);
  }

  /** 照片选择按钮组 */
  function photoActionButtons(options) {
    var opts = options || {};
    return el('div', { class: 'row', style: { gap: '10px' } }, [
      el('button', {
        class: 'btn btn--sm btn--secondary',
        type: 'button',
        text: opts.isChoosing ? '选择中...' : opts.pickText || '选择照片',
        disabled: !!opts.disabled,
        onclick: opts.onPick
      }),
      el('button', {
        class: 'btn btn--sm btn--outline',
        type: 'button',
        text: opts.captureText || '拍照',
        disabled: !!opts.disabled,
        onclick: opts.onCapture
      })
    ]);
  }

  HW.ui = {
    el: el,
    clear: clear,
    escapeHtml: escapeHtml,
    showToast: showToast,
    showConfirm: showConfirm,
    showSheet: showSheet,
    showPhotoPreview: showPhotoPreview,
    secondaryPageHeader: secondaryPageHeader,
    savedFilterNotice: savedFilterNotice,
    emptyState: emptyState,
    wallEmptyState: wallEmptyState,
    loadingBlock: loadingBlock,
    errorBlock: errorBlock,
    detailRow: detailRow,
    photoActionButtons: photoActionButtons
  };
})(window);
