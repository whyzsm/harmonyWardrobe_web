/* 衣不缺 Web 版 — 通用工具 / Utilities
   对应鸿蒙端 entry/src/main/ets/utils/*.ets */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});

  /* ---- ID 生成 / createId ---- */
  function createId(prefix) {
    var cleanPrefix = String(prefix || '').trim().toLowerCase();
    var timestamp = Date.now().toString(36);
    var randomSuffix = Math.random().toString(36).substring(2, 10);
    return cleanPrefix + '_' + timestamp + '_' + randomSuffix;
  }

  /* ---- 日期 / Dates ---- */
  function pad2(value) {
    return (value < 10 ? '0' : '') + value;
  }

  function toIsoDate(date) {
    return (
      date.getFullYear() +
      '-' +
      pad2(date.getMonth() + 1) +
      '-' +
      pad2(date.getDate())
    );
  }

  function toIsoDateTime(date) {
    return new Date(date).toISOString();
  }

  function monthKey(date) {
    return toIsoDate(date).substring(0, 7);
  }

  /** 格式化 YYYY-MM-DD HH:mm（本地时区）；非法输入原样返回 */
  function formatDateTime(value) {
    if (!value) {
      return '';
    }
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return String(value);
    }
    return (
      date.getFullYear() +
      '-' +
      pad2(date.getMonth() + 1) +
      '-' +
      pad2(date.getDate()) +
      ' ' +
      pad2(date.getHours()) +
      ':' +
      pad2(date.getMinutes())
    );
  }

  /** MM-DD HH:mm，用于自动生成名称 */
  function formatShortStamp(date) {
    return (
      pad2(date.getMonth() + 1) +
      '-' +
      pad2(date.getDate()) +
      ' ' +
      pad2(date.getHours()) +
      ':' +
      pad2(date.getMinutes())
    );
  }

  /** 解析 YYYY-MM-DD，失败回退到今天 */
  function dateFromStorage(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
    if (!match) {
      return new Date();
    }
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  /** 今天的 YYYY-MM-DD */
  function todayIsoDate() {
    return toIsoDate(new Date());
  }

  /* ---- 文本 / Text ---- */
  function normalizeSearchText(input) {
    return String(input == null ? '' : input)
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  /**
   * 生成 1~3 gram 词元集合（与 ArkTS buildSearchNgrams 语义一致）
   * @returns {string[]}
   */
  function buildSearchNgrams(input, minGram, maxGram) {
    minGram = minGram === undefined ? 1 : minGram;
    maxGram = maxGram === undefined ? 3 : maxGram;

    if (!Number.isFinite(minGram) || !Number.isFinite(maxGram)) {
      return [];
    }
    if (!Number.isSafeInteger(minGram) || !Number.isSafeInteger(maxGram)) {
      return [];
    }
    if (minGram < 1 || maxGram < 1 || minGram > maxGram) {
      return [];
    }

    var tokens = String(input == null ? '' : input)
      .normalize('NFKC')
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .map(function (token) {
        return token.replace(/[^\p{Script=Han}\p{Letter}\p{Number}]+/gu, '');
      })
      .filter(function (token) {
        return token.length > 0;
      });

    var grams = [];
    var seen = new Set();
    var longestTokenLength = tokens.reduce(function (max, token) {
      return Math.max(max, Array.from(token).length);
    }, 0);
    var effectiveMaxGram = Math.min(maxGram, longestTokenLength);

    for (var size = minGram; size <= effectiveMaxGram; size += 1) {
      for (var i = 0; i < tokens.length; i += 1) {
        var characters = Array.from(tokens[i]);
        if (characters.length < size) {
          continue;
        }
        for (var start = 0; start <= characters.length - size; start += 1) {
          var gram = characters.slice(start, start + size).join('');
          if (!seen.has(gram)) {
            seen.add(gram);
            grams.push(gram);
          }
        }
      }
    }

    return grams;
  }

  /**
   * 用户可见错误文案（与 ArkTS userFacingError 一致）
   */
  function userFacingError(error, fallback) {
    var rawMessage =
      error && typeof error.message === 'string' ? error.message.trim() : '';
    if (rawMessage.length === 0) {
      return fallback;
    }

    var normalizedMessage = rawMessage.toLowerCase();
    if (
      normalizedMessage.indexOf('permission') >= 0 ||
      normalizedMessage.indexOf('access denied') >= 0
    ) {
      return '无法访问本地资源，请检查权限后重试。';
    }
    if (
      normalizedMessage.indexOf('sqlite') >= 0 ||
      normalizedMessage.indexOf('database') >= 0 ||
      normalizedMessage.indexOf('resultset') >= 0
    ) {
      return '本地数据暂时不可用，请重试。';
    }
    if (
      normalizedMessage.indexOf('storage') >= 0 ||
      normalizedMessage.indexOf('local uri') >= 0
    ) {
      return '本地照片暂时不可用，请重新选择照片。';
    }

    return rawMessage.length <= 80 ? rawMessage : fallback;
  }

  /* ---- 照片工具 / Photo helpers ---- */
  var MAX_USER_PHOTOS = 5;

  function remainingPhotoSlots(photoUris) {
    return Math.max(0, MAX_USER_PHOTOS - (photoUris || []).length);
  }

  function appendPhotoUris(currentPhotoUris, incomingPhotoUris) {
    var next = (currentPhotoUris || []).slice();
    var incoming = incomingPhotoUris || [];
    for (var i = 0; i < incoming.length; i += 1) {
      var photoUri = incoming[i];
      if (!photoUri || next.length >= MAX_USER_PHOTOS || next.indexOf(photoUri) >= 0) {
        continue;
      }
      next.push(photoUri);
    }
    return next;
  }

  /* ---- 其它 / Misc ---- */
  function optionalText(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    var trimmed = String(value).trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  function clampIndex(index, length) {
    if (!length || length <= 0) {
      return 0;
    }
    if (index < 0) {
      return 0;
    }
    if (index >= length) {
      return length - 1;
    }
    return index;
  }

  function uniquePreservingOrder(values) {
    var seen = new Set();
    var result = [];
    (values || []).forEach(function (value) {
      if (value === undefined || value === null || value === '') {
        return;
      }
      var key = normalizeSearchText(value);
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      result.push(value);
    });
    return result;
  }

  /** 金额格式化 ¥1,234 */
  function formatBudgetAmount(value) {
    var amount = Math.round(Math.max(0, Number(value) || 0));
    var text = String(amount);
    var parts = [];
    while (text.length > 3) {
      parts.unshift(text.slice(-3));
      text = text.slice(0, -3);
    }
    parts.unshift(text);
    return '¥' + parts.join(',');
  }

  /** 金额格式化 ¥12.50 */
  function formatPrice(value) {
    if (value === undefined || value === null || !Number.isFinite(Number(value))) {
      return '';
    }
    return '¥' + Number(value).toFixed(2);
  }

  /** 千分位 */
  function formatNumber(value) {
    var text = String(Math.round(Number(value) || 0));
    var parts = [];
    while (text.length > 3) {
      parts.unshift(text.slice(-3));
      text = text.slice(0, -3);
    }
    parts.unshift(text);
    return parts.join(',');
  }

  HW.utils = {
    createId: createId,
    pad2: pad2,
    toIsoDate: toIsoDate,
    toIsoDateTime: toIsoDateTime,
    monthKey: monthKey,
    formatDateTime: formatDateTime,
    formatShortStamp: formatShortStamp,
    dateFromStorage: dateFromStorage,
    todayIsoDate: todayIsoDate,
    normalizeSearchText: normalizeSearchText,
    buildSearchNgrams: buildSearchNgrams,
    userFacingError: userFacingError,
    MAX_USER_PHOTOS: MAX_USER_PHOTOS,
    remainingPhotoSlots: remainingPhotoSlots,
    appendPhotoUris: appendPhotoUris,
    optionalText: optionalText,
    clampIndex: clampIndex,
    uniquePreservingOrder: uniquePreservingOrder,
    formatBudgetAmount: formatBudgetAmount,
    formatPrice: formatPrice,
    formatNumber: formatNumber
  };
})(window);
