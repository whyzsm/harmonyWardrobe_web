/* 衣不缺 Web 版 — 领域模型 / Domain Models
   对应鸿蒙端 entry/src/main/ets/domain/** */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});

  /* ---- 衣物分类 / ClothingCategory ---- */
  var ClothingCategory = {
    Top: 'Top',
    Pants: 'Pants',
    Shorts: 'Shorts',
    LongSkirt: 'LongSkirt',
    HalfSkirt: 'HalfSkirt'
  };

  /* 展示用分类名（详情/列表/搜索） */
  var CLOTHING_CATEGORY_LABEL = {
    Top: '上衣',
    Pants: '裤子',
    Shorts: '短裤',
    LongSkirt: '长裙',
    HalfSkirt: '半裙'
  };

  /* 挑选器用分类名（裤装） */
  var CLOTHING_PICKER_CATEGORY_LABEL = {
    Top: '上衣',
    Pants: '裤装',
    Shorts: '短裤',
    LongSkirt: '长裙',
    HalfSkirt: '半裙'
  };

  /* 拍照录入用分类名（3 项：上衣/裤装/裙装） */
  var CAPTURE_CATEGORY_OPTIONS = [
    { label: '上衣', value: ClothingCategory.Top },
    { label: '裤装', value: ClothingCategory.Pants },
    { label: '裙装', value: ClothingCategory.LongSkirt }
  ];

  var CAPTURE_CATEGORY_LABEL = {
    Top: '上衣',
    Pants: '裤装',
    LongSkirt: '裙装'
  };

  /* 衣柜筛选分组 */
  var WARDROBE_CATEGORY_FILTERS = [
    { label: '全部', categories: null, icon: 'square_grid_2x2' },
    {
      label: '上衣',
      categories: [ClothingCategory.Top],
      icon: 'shirt'
    },
    {
      label: '裤装',
      categories: [ClothingCategory.Pants, ClothingCategory.Shorts],
      icon: 'clothing'
    },
    {
      label: '裙装',
      categories: [ClothingCategory.LongSkirt, ClothingCategory.HalfSkirt],
      icon: 'hanger_and_towels'
    }
  ];

  /* 衣物编辑器可选分类（半裙仅在编辑既有半裙时出现） */
  var DISPLAY_CATEGORY_OPTIONS = [
    { label: '上衣', value: ClothingCategory.Top },
    { label: '裤子', value: ClothingCategory.Pants },
    { label: '短裤', value: ClothingCategory.Shorts },
    { label: '长裙', value: ClothingCategory.LongSkirt }
  ];

  var LEGACY_HALF_SKIRT_OPTION = {
    label: '半裙',
    value: ClothingCategory.HalfSkirt
  };

  /* ---- 穿搭 / Outfit ---- */
  var OutfitDisplaySource = {
    Photo: 'photo',
    Wardrobe: 'wardrobe'
  };

  var OUTFIT_CATEGORY_MAX_LENGTH = 12;

  /* ---- 逛店 / Store ---- */
  var StoreVisitStatus = {
    Visited: 'visited',
    WantToVisit: 'wantToVisit',
    Repurchase: 'repurchase'
  };

  /* ---- 搜索 / Search ---- */
  var SearchEntityType = {
    Clothing: 'clothing',
    Outfit: 'outfit',
    WearLog: 'wearLog',
    Wishlist: 'wishlist',
    Store: 'store',
    StoreVisit: 'storeVisit'
  };

  var SEARCH_ENTITY_LABEL = {
    clothing: '衣柜',
    outfit: '穿搭',
    wearLog: '穿着',
    wishlist: '心愿',
    store: '店铺',
    storeVisit: '逛店记录'
  };

  /* ---- 个人档案 / Profile ---- */
  var PROFILE_HEIGHT_MIN_CM = 80;
  var PROFILE_HEIGHT_MAX_CM = 250;
  var PROFILE_WEIGHT_MIN_KG = 20;
  var PROFILE_WEIGHT_MAX_KG = 300;
  var PROFILE_WAIST_MIN_CM = 40;
  var PROFILE_WAIST_MAX_CM = 200;
  var PROFILE_BUDGET_MIN = 500;
  var MAX_COMMON_ITEMS = 3;

  /* ---- 主 Tab / Main Tabs ---- */
  var AppMainTab = {
    Wardrobe: 'wardrobe',
    Store: 'store',
    Outfit: 'outfit',
    Profile: 'profile'
  };

  /* ---- 常量 ---- */
  var MAX_USER_PHOTOS = 5;
  var DEFAULT_SEARCH_TERM = '上衣';
  var MAX_SEARCH_LIMIT = 100;
  var MAX_HISTORY_TERMS = 8;

  HW.models = {
    ClothingCategory: ClothingCategory,
    CLOTHING_CATEGORY_LABEL: CLOTHING_CATEGORY_LABEL,
    CLOTHING_PICKER_CATEGORY_LABEL: CLOTHING_PICKER_CATEGORY_LABEL,
    CAPTURE_CATEGORY_OPTIONS: CAPTURE_CATEGORY_OPTIONS,
    CAPTURE_CATEGORY_LABEL: CAPTURE_CATEGORY_LABEL,
    WARDROBE_CATEGORY_FILTERS: WARDROBE_CATEGORY_FILTERS,
    DISPLAY_CATEGORY_OPTIONS: DISPLAY_CATEGORY_OPTIONS,
    LEGACY_HALF_SKIRT_OPTION: LEGACY_HALF_SKIRT_OPTION,
    OutfitDisplaySource: OutfitDisplaySource,
    OUTFIT_CATEGORY_MAX_LENGTH: OUTFIT_CATEGORY_MAX_LENGTH,
    StoreVisitStatus: StoreVisitStatus,
    SearchEntityType: SearchEntityType,
    SEARCH_ENTITY_LABEL: SEARCH_ENTITY_LABEL,
    PROFILE_HEIGHT_MIN_CM: PROFILE_HEIGHT_MIN_CM,
    PROFILE_HEIGHT_MAX_CM: PROFILE_HEIGHT_MAX_CM,
    PROFILE_WEIGHT_MIN_KG: PROFILE_WEIGHT_MIN_KG,
    PROFILE_WEIGHT_MAX_KG: PROFILE_WEIGHT_MAX_KG,
    PROFILE_WAIST_MIN_CM: PROFILE_WAIST_MIN_CM,
    PROFILE_WAIST_MAX_CM: PROFILE_WAIST_MAX_CM,
    PROFILE_BUDGET_MIN: PROFILE_BUDGET_MIN,
    MAX_COMMON_ITEMS: MAX_COMMON_ITEMS,
    AppMainTab: AppMainTab,
    MAX_USER_PHOTOS: MAX_USER_PHOTOS,
    DEFAULT_SEARCH_TERM: DEFAULT_SEARCH_TERM,
    MAX_SEARCH_LIMIT: MAX_SEARCH_LIMIT,
    MAX_HISTORY_TERMS: MAX_HISTORY_TERMS
  };
})(window);
