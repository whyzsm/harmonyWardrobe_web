/* 衣不缺 Web 版 — 页面共享逻辑 / Shared Page Helpers
   照片解析、图片墙卡片、自动名称规则、分类标签等跨页面复用的逻辑。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var ui = HW.ui;
  var el = ui.el;
  var utils = HW.utils;
  var models = HW.models;

  /* ---------- 照片解析 ---------- */
  /**
   * 渲染 <img data-photo="photoId">，随后由 resolvePhotos 填充 src
   */
  function photoImage(photoId, className, alt) {
    return el('img', {
      class: className,
      alt: alt || '照片',
      'data-photo': photoId || '',
      loading: 'lazy'
    });
  }

  /**
   * 解析容器内所有 data-photo 图片
   */
  function resolvePhotos(root) {
    if (!root || !root.querySelectorAll) {
      return;
    }
    var images = root.querySelectorAll('img[data-photo]');
    Array.prototype.forEach.call(images, function (image) {
      var photoId = image.getAttribute('data-photo');
      if (!photoId) {
        return;
      }
      var cached = HW.PhotoStore.resolveCached(photoId);
      if (cached) {
        image.src = cached;
        return;
      }
      HW.PhotoStore.resolve(photoId).then(function (url) {
        if (url) {
          image.src = url;
        }
      });
    });
  }

  /* ---------- 自动名称规则 ---------- */
  /** 衣物自动名：上衣 08-26 10:49 */
  function generatedClothingName(category, date) {
    var label =
      models.CLOTHING_CATEGORY_LABEL[category] || models.CLOTHING_CATEGORY_LABEL.Top;
    return label + ' ' + utils.formatShortStamp(date || new Date());
  }

  /** 穿搭自动名：穿搭 08-26 10:49 */
  function generatedOutfitTitle(date) {
    return '穿搭 ' + utils.formatShortStamp(date || new Date());
  }

  /** 逛店自动名：逛店 08-26 10:49 */
  function generatedStoreVisitName(date) {
    return '逛店 ' + utils.formatShortStamp(date || new Date());
  }

  var CLOTHING_AUTO_NAME_PATTERN = new RegExp(
    '^(上衣|裤子|短裤|长裙|半裙) \\d{2}-\\d{2} \\d{2}:\\d{2}$'
  );
  var OUTFIT_AUTO_TITLE_PATTERN = /^(穿搭|美搭) \d{2}-\d{2} \d{2}:\d{2}$/;

  /** 衣物展示标题：命中自动名则只显示分类名 */
  function displayItemTitle(item) {
    if (!item) {
      return '';
    }
    var categoryLabel =
      models.CLOTHING_CATEGORY_LABEL[item.category] || models.CLOTHING_CATEGORY_LABEL.Top;
    if (CLOTHING_AUTO_NAME_PATTERN.test(item.name)) {
      return categoryLabel;
    }
    return item.name;
  }

  /** 衣物副标题：备注优先，否则分类名 */
  function displayItemMeta(item) {
    if (!item) {
      return '';
    }
    var note = (item.note || '').trim();
    if (note.length > 0) {
      return note;
    }
    var categoryLabel =
      models.CLOTHING_CATEGORY_LABEL[item.category] || models.CLOTHING_CATEGORY_LABEL.Top;
    if (displayItemTitle(item) === categoryLabel) {
      return '';
    }
    return categoryLabel;
  }

  /** 穿搭展示标题：命中自动名则只保留前缀 */
  function displayOutfitTitle(outfit) {
    if (!outfit) {
      return '';
    }
    var title = (outfit.title || '').trim();
    if (OUTFIT_AUTO_TITLE_PATTERN.test(title)) {
      return title.split(' ')[0];
    }
    return title;
  }

  /** 穿搭编辑器回填标题 */
  function editableOutfitTitle(outfit) {
    if (!outfit) {
      return '';
    }
    var title = (outfit.title || '').trim();
    if (OUTFIT_AUTO_TITLE_PATTERN.test(title)) {
      return title.split(' ')[0];
    }
    return title;
  }

  /* ---------- 分类图标 ---------- */
  function categoryIconName(category) {
    if (category === models.ClothingCategory.Top) {
      return 'shirt';
    }
    if (
      category === models.ClothingCategory.Pants ||
      category === models.ClothingCategory.Shorts
    ) {
      return 'clothing';
    }
    return 'hanger_and_towels';
  }

  /* ---------- 穿搭展示照片 ---------- */
  /**
   * 穿搭展示照片规则（与鸿蒙端 displayPhotoUris 一致）
   * Wardrobe 来源优先用关联衣物首图，Photo 来源优先用穿搭自身照片。
   */
  function displayPhotoUris(outfit, clothingItems) {
    if (!outfit) {
      return [];
    }
    var clothingPhotoUris = [];
    (outfit.clothingItemIds || []).forEach(function (clothingId) {
      if (clothingPhotoUris.length > 0) {
        return;
      }
      var item = (clothingItems || []).filter(function (candidate) {
        return candidate.id === clothingId;
      })[0];
      if (item && item.photoUris && item.photoUris.length > 0) {
        var first = String(item.photoUris[0]).trim();
        if (first) {
          clothingPhotoUris.push(first);
        }
      }
    });

    if (outfit.displaySource === models.OutfitDisplaySource.Wardrobe) {
      return clothingPhotoUris.length > 0 ? clothingPhotoUris : outfit.photoUris || [];
    }
    return (outfit.photoUris || []).length > 0 ? outfit.photoUris : clothingPhotoUris;
  }

  /* ---------- 逛店状态推导 ---------- */
  function visitStatus(visit) {
    if (!visit) {
      return models.StoreVisitStatus.Visited;
    }
    if (visit.status) {
      return visit.status;
    }
    var note = String(visit.note || '').toLowerCase();
    if (
      note.indexOf('想去') >= 0 ||
      note.indexOf('回看') >= 0 ||
      note.indexOf('回头') >= 0 ||
      note.indexOf('再去') >= 0
    ) {
      return models.StoreVisitStatus.WantToVisit;
    }
    if (note.indexOf('回购') >= 0) {
      return models.StoreVisitStatus.Repurchase;
    }
    return models.StoreVisitStatus.Visited;
  }

  function visitBadge(visit) {
    var status = visitStatus(visit);
    if (status === models.StoreVisitStatus.WantToVisit) {
      return '想去';
    }
    if (status === models.StoreVisitStatus.Repurchase) {
      return '回购';
    }
    return '已去';
  }

  /* ---------- 卡片网格（瀑布流） ---------- */
  /**
   * 渲染图片墙卡片。三种主 Tab 的卡片结构不同：
   *   wardrobe — 标题与 meta 同行（14px / 12px），角标在左上
   *   outfit   — 标题与分类同行、备注另起一行（14px / 11px），计数在右下
   *   store    — 门店名与 meta 同行（14px / 11px），状态在右上
   * @param {object} options
   */
  function wallCard(options) {
    var opts = options || {};
    var media = el('div', {
      class: 'wall-card__media',
      style: { aspectRatio: String(opts.aspectRatio || 0.8) }
    });

    if (opts.photoId) {
      media.appendChild(photoImage(opts.photoId, 'wall-card__image', opts.title || '照片'));
    } else {
      var placeholder = el('div', { class: 'wall-card__placeholder' }, [
        el('span', { html: HW.icon(opts.placeholderIcon || 'picture', opts.placeholderIconSize || 34) }),
        el('span', {
          class: 'wall-card__placeholder-text' + (opts.placeholderTextSmall ? ' wall-card__placeholder-text--sm' : ''),
          text: '暂无照片'
        })
      ]);
      media.appendChild(placeholder);
    }

    /* 角标：左上分类图标（衣柜） */
    if (opts.badgeIcon) {
      media.appendChild(
        el('span', {
          class: 'wall-card__badge',
          html: HW.icon(opts.badgeIcon, 14)
        })
      );
    }

    /* 状态气泡：右上（逛街） */
    if (opts.statusText) {
      media.appendChild(el('span', { class: 'wall-card__status', text: opts.statusText }));
    }

    /* 计数气泡：右下（穿搭） */
    if (opts.photoCount && opts.photoCount > 2) {
      media.appendChild(
        el('span', { class: 'wall-card__count', text: '+' + (opts.photoCount - 2) })
      );
    }

    if (opts.onLongPress) {
      media.addEventListener('contextmenu', function (event) {
        event.preventDefault();
        opts.onLongPress();
      });
      var pressTimer = null;
      media.addEventListener('pointerdown', function () {
        pressTimer = setTimeout(function () {
          pressTimer = null;
          opts.onLongPress();
        }, 500);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (type) {
        media.addEventListener(type, function () {
          if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
          }
        });
      });
    }

    var children = [media];

    /* 文本区：三种布局分别处理 */
    if (opts.layout === 'outfit') {
      children.push(
        el('div', { class: 'wall-card__text-row' }, [
          el('div', { class: 'wall-card__stack' }, [
            el('div', { class: 'wall-card__title-row' }, [
              el('div', { class: 'wall-card__title wall-card__title--tight', text: opts.title || '' }),
              el('div', { class: 'wall-card__category', text: opts.category || '' })
            ]),
            el('div', { class: 'wall-card__meta wall-card__meta--sm', text: opts.meta || '' })
          ])
        ])
      );
    } else if (opts.layout === 'store') {
      children.push(
        el('div', { class: 'wall-card__text-row' }, [
          el('div', { class: 'wall-card__title wall-card__title--tight', text: opts.title || '' }),
          el('div', { class: 'wall-card__meta wall-card__meta--sm', text: opts.meta || '' })
        ])
      );
    } else {
      children.push(
        el('div', { class: 'wall-card__text-row' }, [
          el('div', { class: 'wall-card__title', text: opts.title || '' }),
          el('div', { class: 'wall-card__meta', text: opts.meta || '' })
        ])
      );
    }

    var card = el(
      'button',
      {
        class: 'wall-card' + (opts.layout === 'outfit' ? '' : ' wall-card--tight'),
        type: 'button',
        'aria-label': opts.accessibilityText || opts.title || '卡片',
        onclick: opts.onClick
      },
      children
    );

    return card;
  }

  /* ---------- 删除遮罩 ---------- */
  /**
   * 为卡片附加删除遮罩
   */
  function attachDeleteOverlay(mediaNode, options) {
    var opts = options || {};
    var overlay = el('div', { class: 'delete-overlay' }, [
      el(
        'button',
        {
          class: 'delete-overlay__btn',
          type: 'button',
          'aria-label': opts.label || '删除',
          onclick: function (event) {
            event.stopPropagation();
            opts.onDelete();
          }
        },
        [
          el('span', { html: HW.icon('trash', 18) }),
          el('span', { text: opts.deleting ? '删除中...' : opts.label || '删除' })
        ]
      )
    ]);

    overlay.addEventListener('click', function (event) {
      event.stopPropagation();
      opts.onDismiss();
    });

    mediaNode.appendChild(overlay);
    return overlay;
  }

  /* ---------- 照片轮播 ---------- */
  function photoCarousel(photoUris, options) {
    var opts = options || {};
    var photos = photoUris || [];
    var container = el('div', {
      class: opts.className || '',
      style: { position: 'relative', width: '100%', height: '100%' }
    });

    if (!photos.length) {
      if (opts.placeholderImage) {
        container.appendChild(
          el('img', {
            class: 'photo-hero__image',
            src: opts.placeholderImage,
            alt: '默认封面'
          })
        );
      }
      return container;
    }

    var index = HW.utils.clampIndex(opts.activeIndex || 0, photos.length);
    var stage = el('div', { style: { width: '100%', height: '100%' } });
    container.appendChild(stage);

    function renderPhoto() {
      ui.clear(stage);
      var image = photoImage(photos[index], 'photo-hero__image', opts.alt || '照片');
      stage.appendChild(image);
      HW.PhotoStore.resolve(photos[index]).then(function (url) {
        if (url) {
          image.src = url;
        }
      });
    }
    renderPhoto();

    if (photos.length > 1) {
      container.appendChild(
        el('div', { class: 'photo-counter', text: index + 1 + ' / ' + photos.length })
      );
      stage.addEventListener('click', function (event) {
        var rect = stage.getBoundingClientRect();
        if (event.clientX - rect.left < rect.width / 2) {
          index = (index - 1 + photos.length) % photos.length;
        } else {
          index = (index + 1) % photos.length;
        }
        renderPhoto();
        var counter = container.querySelector('.photo-counter');
        if (counter) {
          counter.textContent = index + 1 + ' / ' + photos.length;
        }
        if (opts.onSelect) {
          opts.onSelect(index);
        }
      });
    }

    return container;
  }

  /* ---------- 照片缩略图条 ---------- */
  function photoThumbnails(photoUris, options) {
    var opts = options || {};
    var photos = photoUris || [];
    var activeIndex = opts.activeIndex || 0;

    var row = el('div', { class: 'photo-thumbs' });
    photos.forEach(function (photoId, index) {
      var thumb = el(
        'button',
        {
          class: 'photo-thumb' + (index === activeIndex ? ' photo-thumb--active' : ''),
          type: 'button',
          'aria-label': '选择第 ' + (index + 1) + ' 张照片',
          onclick: function () {
            if (opts.onSelect) {
              opts.onSelect(index);
            }
          }
        },
        [photoImage(photoId, 'photo-thumb__image', '照片缩略图')]
      );

      if (opts.removable !== false) {
        thumb.appendChild(
          el(
            'span',
            {
              class: 'photo-thumb__remove',
              role: 'button',
              'aria-label': '删除第 ' + (index + 1) + ' 张照片',
              onclick: function (event) {
                event.stopPropagation();
                if (opts.onRemove) {
                  opts.onRemove(index);
                }
              }
            },
            [el('span', { html: HW.icon('xmark', 12) })]
          )
        );
      }

      row.appendChild(thumb);
    });

    return row;
  }

  /* ---------- 瀑布流 / Masonry（对齐 ArkUI WaterFlow） ----------
     ArkUI WaterFlow 按「当前最矮的列」依次放置条目，阅读顺序为从左到右、从上到下。
     CSS column-count 是按列灌满（column-major），顺序不一致，
     因此这里用两列容器 + 实测高度实现同等的排布语义。

     实现：条目先暂存到 0 号列用于测量（列宽由 flex 布局保证与最终一致），
     待容器挂载后统一测量高度，再按「最矮列」规则重新分配。 */
  function createMasonry(options) {
    var opts = options || {};
    var columnsCount = opts.columns || 2;
    var inset = !!opts.inset;
    /* 列内条目间距，对应 ArkUI WaterFlow 的 rowsGap(8)；
       列之间的间距由 CSS .waterflow 的 gap（columnsGap 16）控制。 */
    var rowGap = opts.rowGap === undefined ? 8 : opts.rowGap;

    var container = el('div', { class: 'waterflow-host' });
    var flow = el('div', { class: 'waterflow' + (inset ? ' waterfall--inset' : '') });
    var emptyHost = el('div', {
      class: 'waterflow-empty' + (inset ? ' waterfall-empty--inset' : '')
    });
    var columns = [];
    for (var i = 0; i < columnsCount; i += 1) {
      columns.push(el('div', { class: 'waterflow__column' }));
      flow.appendChild(columns[i]);
    }
    container.appendChild(flow);
    container.appendChild(emptyHost);

    var pending = [];
    var flushScheduled = false;

    function place(node) {
      /* 暂存到 0 号列：此时列宽已确定，可用于测量最终高度 */
      columns[0].appendChild(node);
      pending.push(node);
      scheduleFlush();
    }

    function scheduleFlush() {
      if (flushScheduled) {
        return;
      }
      flushScheduled = true;
      requestAnimationFrame(function () {
        flushScheduled = false;
        flush();
      });
    }

    function flush() {
      if (!pending.length) {
        return;
      }

      var heights = pending.map(function (node) {
        return node.getBoundingClientRect().height;
      });

      columns.forEach(function (column) {
        ui.clear(column);
      });

      var columnHeights = columns.map(function () {
        return 0;
      });

      pending.forEach(function (node, index) {
        var shortest = 0;
        for (var i = 1; i < columnHeights.length; i += 1) {
          if (columnHeights[i] < columnHeights[shortest]) {
            shortest = i;
          }
        }
        columns[shortest].appendChild(node);
        columnHeights[shortest] += heights[index] + rowGap;
      });

      pending = [];
    }

    function reset() {
      pending = [];
      columns.forEach(function (column) {
        ui.clear(column);
      });
      ui.clear(emptyHost);
      flow.style.display = '';
      emptyHost.style.display = 'none';
    }

    /** 显示空态（隐藏瀑布流） */
    function showEmpty(node) {
      ui.clear(emptyHost);
      emptyHost.appendChild(node);
      flow.style.display = 'none';
      emptyHost.style.display = '';
    }

    return {
      container: container,
      place: place,
      flush: flush,
      reset: reset,
      showEmpty: showEmpty,
      columns: columns
    };
  }

  /* ---------- 文本输入 ---------- */
  function textField(options) {
    var opts = options || {};
    var input = el('input', {
      class: 'input__text' + (opts.large ? ' input__text--large' : ''),
      type: opts.type || 'text',
      value: opts.value || '',
      placeholder: opts.placeholder || '',
      inputmode: opts.inputmode || null,
      'aria-label': opts.ariaLabel || opts.placeholder || ''
    });

    if (opts.onInput) {
      input.addEventListener('input', function (event) {
        opts.onInput(event.target.value);
      });
    }

    var attrs = { class: 'input' + (opts.invalid ? ' input--invalid' : '') };
    if (opts.onClick) {
      attrs.onclick = opts.onClick;
    }

    var children = [];
    if (opts.icon) {
      children.push(el('span', { class: 'input__icon', html: HW.icon(opts.icon, 20) }));
    }
    children.push(input);
    if (opts.trailing) {
      children.push(opts.trailing);
    }

    return { wrap: el('div', attrs, children), input: input };
  }

  function textArea(options) {
    var opts = options || {};
    var area = el('textarea', {
      class: opts.compact ? 'input__textarea--compact' : 'input__textarea',
      placeholder: opts.placeholder || '',
      'aria-label': opts.placeholder || ''
    });
    area.value = opts.value || '';
    if (opts.onInput) {
      area.addEventListener('input', function (event) {
        opts.onInput(event.target.value);
      });
    }
    return area;
  }

  /* ---------- 单选胶囊组 ---------- */
  function optionChips(options) {
    var opts = options || {};
    var row = el('div', { class: 'row', style: { gap: '12px', width: '100%' } });

    (opts.options || []).forEach(function (option) {
      var isActive = opts.getValue() === option.value;
      row.appendChild(
        el(
          'button',
          {
            class: 'chip chip--wide' + (isActive ? ' chip--active' : ''),
            type: 'button',
            'aria-label': option.label + (isActive ? '，已选中' : ''),
            text: option.label,
            onclick: function () {
              opts.onSelect(option.value);
            }
          },
          []
        )
      );
    });

    return row;
  }

  HW.pageHelpers = {
    photoImage: photoImage,
    resolvePhotos: resolvePhotos,
    generatedClothingName: generatedClothingName,
    generatedOutfitTitle: generatedOutfitTitle,
    generatedStoreVisitName: generatedStoreVisitName,
    displayItemTitle: displayItemTitle,
    displayItemMeta: displayItemMeta,
    displayOutfitTitle: displayOutfitTitle,
    editableOutfitTitle: editableOutfitTitle,
    categoryIconName: categoryIconName,
    displayPhotoUris: displayPhotoUris,
    visitStatus: visitStatus,
    visitBadge: visitBadge,
    wallCard: wallCard,
    attachDeleteOverlay: attachDeleteOverlay,
    photoCarousel: photoCarousel,
    photoThumbnails: photoThumbnails,
    textField: textField,
    textArea: textArea,
    optionChips: optionChips,
    createMasonry: createMasonry
  };
})(window);
