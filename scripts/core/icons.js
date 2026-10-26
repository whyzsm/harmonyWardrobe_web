/* 衣不缺 Web 版 — 图标 / Icons
   将鸿蒙端 sys.symbol.* 系统符号映射为内联 SVG，保持视觉语义一致。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});

  // viewBox 统一 0 0 24 24，stroke 风格（1.8 线宽），currentColor 继承颜色
  var PATHS = {
    magnifyingglass:
      '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5 21 21"/>',
    arrow_left: '<path d="M15 19 8 12l7-7"/>',
    arrow_right: '<path d="M9 5l7 7-7 7"/>',
    chevron_down: '<path d="m6 9 6 6 6-6"/>',
    chevron_right: '<path d="m9 6 6 6-6 6"/>',
    xmark: '<path d="M18 6 6 18M6 6l12 12"/>',
    checkmark: '<path d="m5 13 4 4L19 7"/>',
    checkmark_circle_fill:
      '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="m8 12.5 2.6 2.6L16 9.6" stroke="#fff" stroke-width="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    square_and_pencil:
      '<path d="M16.5 3.5 20.5 7.5 8 20H4v-4z"/><path d="M14 6 18 10"/>',
    trash:
      '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/><path d="M10 11v6M14 11v6"/>',
    picture:
      '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/>',
    camera_fill:
      '<path d="M9 4h6l1.5 2.5H20a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1h3.5z" fill="currentColor" stroke="none"/><circle cx="12" cy="13" r="4" fill="#fff" stroke="none"/>',
    /* 上衣：圆领 T 恤（对齐鸿蒙 sys.symbol.shirt） */
    shirt:
      '<path d="M9 3.2 4.7 5a1 1 0 0 0-.55 1.08l.62 2.9a1 1 0 0 0 1.3.63L8 9.2v10.6A1.2 1.2 0 0 0 9.2 21h5.6a1.2 1.2 0 0 0 1.2-1.2V9.2l1.93.41a1 1 0 0 0 1.3-.63l.62-2.9A1 1 0 0 0 19.3 5L15 3.2a3.3 3.3 0 0 1-6 0z"/>',
    /* 裤装：T 恤 + 下方长方形衣身（对齐鸿蒙 sys.symbol.clothing） */
    clothing:
      '<path d="M8.6 3.2 5.1 4.7a1 1 0 0 0-.58 1.05l.5 2.3a1 1 0 0 0 1.28.66L8 8.3V10h8V8.3l1.7.41a1 1 0 0 0 1.28-.66l.5-2.3a1 1 0 0 0-.58-1.05L15.4 3.2a3.4 3.4 0 0 1-6.8 0z"/><rect x="8" y="10" width="8" height="10.2" rx="1.1"/>',
    /* 裙装：衣架 + 垂挂毛巾（对齐鸿蒙 sys.symbol.hanger_and_towels） */
    hanger_and_towels:
      '<path d="M12 3.1v2.2"/><path d="M10.85 5.3a1.35 1.35 0 1 0 2.1 1.45"/><path d="M3.2 10.5c0-1.8 3.95-3.15 8.8-3.15s8.8 1.35 8.8 3.15c0 .85-.72 1.4-1.47 1.03"/><path d="M7.6 9.9v9.6c0 .62.5 1.1 1.1 1.1h6.4c.6 0 1.1-.48 1.1-1.1v-8.4"/><path d="M7.6 9.9v9.6"/>',
    square_grid_2x2:
      '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
    store_fill:
      '<path d="M4 9.5 5.5 4h13L20 9.5a3 3 0 0 1-5.5 1.6A3 3 0 0 1 12 10a3 3 0 0 1-2.5 1.1A3 3 0 0 1 4 9.5z" fill="currentColor" stroke="none"/><path d="M5 11.5V20h14v-8.5"/>',
    bag:
      '<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    person:
      '<circle cx="12" cy="8" r="3.6"/><path d="M5 20a7 7 0 0 1 14 0"/>',
    person_fill:
      '<circle cx="12" cy="8" r="3.8" fill="currentColor" stroke="none"/><path d="M5 20a7 7 0 0 1 14 0" fill="currentColor" stroke="none"/>',
    heart: '<path d="M12 20s-7-4.6-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.4 12 20 12 20z"/>',
    heart_fill:
      '<path d="M12 20s-7-4.6-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.4 12 20 12 20z" fill="currentColor" stroke="none"/>',
    eye:
      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    calendar:
      '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    creditcard:
      '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
    list_bullet:
      '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>',
    mappin_and_rectangle:
      '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M12 19v-6"/><path d="M9 13a3 3 0 1 1 6 0c0 2-3 3-3 3s-3-1-3-3z"/>',
    arrow_clockwise:
      '<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4h-4"/>',
    grid: '<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>',
    sliders:
      '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2.2"/><circle cx="10" cy="17" r="2.2"/>',
    info:
      '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    alert:
      '<path d="M12 4 2.5 20h19z"/><path d="M12 10v4M12 17h.01"/>',
    download:
      '<path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/>',
    upload:
      '<path d="M12 21V9"/><path d="m7 13 5-5 5 5"/><path d="M4 4h16"/>',
    ellipsis:
      '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
    arrow_left_arrow_right:
      '<path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-1"/>',
    creditcard_fill:
      '<rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="currentColor" stroke="none"/>'
  };

  /**
   * 生成图标 SVG 字符串
   * @param {string} name 图标名
   * @param {number} size 尺寸（px）
   */
  function icon(name, size) {
    var body = PATHS[name];
    if (!body) {
      body = PATHS.info;
    }
    var s = size || 20;
    return (
      '<svg class="icon icon--' +
      name +
      '" width="' +
      s +
      '" height="' +
      s +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      body +
      '</svg>'
    );
  }

  HW.icon = icon;
  HW.ICON_NAMES = Object.keys(PATHS);
})(window);
