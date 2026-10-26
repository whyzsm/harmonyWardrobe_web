/* 衣不缺 Web 版 — 本地数据库 / IndexedDB 数据层
   对应鸿蒙端 entry/src/main/ets/data/database + migrations。
   SQLite → IndexedDB，表结构与字段语义保持一致。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});

  var DB_NAME = 'harmony-wardrobe';
  var DB_VERSION = 1;

  /* 与 ArkTS migrations 对应的表定义。
     keyPath 为主键；索引声明与 SQLite CREATE INDEX 对齐。 */
  var SCHEMA = {
    clothing_items: {
      keyPath: 'id',
      indexes: [
        { name: 'idx_clothing_items_category', keyPath: 'category' },
        { name: 'idx_clothing_items_store_name', keyPath: 'purchase_store_name' },
        { name: 'idx_clothing_items_purchase_date', keyPath: 'purchase_date' }
      ]
    },
    clothing_photos: {
      keyPath: 'id',
      indexes: [
        { name: 'idx_clothing_photos_clothing_id', keyPath: 'clothing_id' }
      ]
    },
    outfit_templates: {
      keyPath: 'id',
      indexes: [
        { name: 'idx_outfit_templates_category_id', keyPath: 'category_id' }
      ]
    },
    outfit_photos: {
      keyPath: 'id',
      indexes: [{ name: 'idx_outfit_photos_outfit_id', keyPath: 'outfit_id' }]
    },
    outfit_items: {
      keyPath: 'id',
      indexes: [{ name: 'idx_outfit_items_clothing_id', keyPath: 'clothing_id' }]
    },
    outfit_categories: {
      keyPath: 'id',
      indexes: []
    },
    outfit_template_categories: {
      keyPath: 'id',
      indexes: [
        {
          name: 'idx_outfit_template_categories_category_id',
          keyPath: 'category_id'
        }
      ]
    },
    wear_logs: {
      keyPath: 'id',
      indexes: [
        { name: 'idx_wear_logs_outfit_id', keyPath: 'outfit_id' },
        { name: 'idx_wear_logs_worn_date', keyPath: 'worn_date' }
      ]
    },
    wear_log_photos: {
      keyPath: 'id',
      indexes: [{ name: 'idx_wear_log_photos_wear_log_id', keyPath: 'wear_log_id' }]
    },
    wishlist_items: {
      keyPath: 'id',
      indexes: [{ name: 'idx_wishlist_items_store_name', keyPath: 'store_name' }]
    },
    wishlist_photos: {
      keyPath: 'id',
      indexes: [{ name: 'idx_wishlist_photos_wishlist_id', keyPath: 'wishlist_id' }]
    },
    stores: {
      keyPath: 'id',
      indexes: []
    },
    store_photos: {
      keyPath: 'id',
      indexes: [{ name: 'idx_store_photos_store_id', keyPath: 'store_id' }]
    },
    store_visits: {
      keyPath: 'id',
      indexes: []
    },
    store_visit_photos: {
      keyPath: 'id',
      indexes: [
        {
          name: 'idx_store_visit_photos_visit_id',
          keyPath: 'store_visit_id'
        }
      ]
    },
    user_profile: {
      keyPath: 'id',
      indexes: []
    },
    search_documents: {
      keyPath: 'id',
      indexes: [{ name: 'idx_search_documents_entity', keyPath: 'entity_type' }]
    },
    /* 照片二进制：photoId → Blob */
    photo_blobs: {
      keyPath: 'id',
      indexes: []
    }
  };

  var dbPromise = null;

  function openDatabase() {
    if (dbPromise) {
      return dbPromise;
    }

    dbPromise = new Promise(function (resolve, reject) {
      var request;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        reject(error);
        return;
      }

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        Object.keys(SCHEMA).forEach(function (tableName) {
          var definition = SCHEMA[tableName];
          var store = db.objectStoreNames.contains(tableName)
            ? event.target.transaction.objectStore(tableName)
            : db.createObjectStore(tableName, { keyPath: definition.keyPath });

          (definition.indexes || []).forEach(function (index) {
            if (!store.indexNames.contains(index.name)) {
              store.createIndex(index.name, index.keyPath, { unique: false });
            }
          });
        });
      };

      request.onsuccess = function (event) {
        var db = event.target.result;
        db.onversionchange = function () {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };

      request.onerror = function () {
        reject(request.error || new Error('无法打开本地数据库'));
      };

      request.onblocked = function () {
        reject(new Error('本地数据库被其它标签页占用，请关闭后重试'));
      };
    });

    return dbPromise;
  }

  function runTransaction(storeNames, mode, executor) {
    return openDatabase().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx;
        try {
          tx = db.transaction(storeNames, mode);
        } catch (error) {
          reject(error);
          return;
        }

        var result;
        tx.oncomplete = function () {
          resolve(result);
        };
        tx.onerror = function () {
          reject(tx.error || new Error('本地数据库操作失败'));
        };
        tx.onabort = function () {
          reject(tx.error || new Error('本地数据库操作已中断'));
        };

        try {
          var maybePromise = executor(tx);
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(function (value) {
              result = value;
            }, reject);
          } else {
            result = maybePromise;
          }
        } catch (error) {
          try {
            tx.abort();
          } catch (ignored) {
            /* ignore */
          }
          reject(error);
        }
      });
    });
  }

  function requestToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error || new Error('本地数据库请求失败'));
      };
    });
  }

  var Db = {
    open: openDatabase,

    /** 全表读取 */
    getAll: function (tableName) {
      return runTransaction([tableName], 'readonly', function (tx) {
        return requestToPromise(tx.objectStore(tableName).getAll());
      });
    },

    /** 按主键读取 */
    get: function (tableName, key) {
      return runTransaction([tableName], 'readonly', function (tx) {
        return requestToPromise(tx.objectStore(tableName).get(key));
      });
    },

    /** 按索引范围读取 */
    getAllByIndex: function (tableName, indexName, value) {
      return runTransaction([tableName], 'readonly', function (tx) {
        var index = tx.objectStore(tableName).index(indexName);
        return requestToPromise(index.getAll(value));
      });
    },

    /** 写入（新增或覆盖） */
    put: function (tableName, value) {
      return runTransaction([tableName], 'readwrite', function (tx) {
        tx.objectStore(tableName).put(value);
        return value;
      });
    },

    /** 批量写入 */
    putMany: function (tableName, values) {
      return runTransaction([tableName], 'readwrite', function (tx) {
        var store = tx.objectStore(tableName);
        values.forEach(function (value) {
          store.put(value);
        });
        return values.length;
      });
    },

    /** 删除 */
    remove: function (tableName, key) {
      return runTransaction([tableName], 'readwrite', function (tx) {
        tx.objectStore(tableName).delete(key);
        return key;
      });
    },

    /** 批量删除 */
    removeMany: function (tableName, keys) {
      return runTransaction([tableName], 'readwrite', function (tx) {
        var store = tx.objectStore(tableName);
        keys.forEach(function (key) {
          store.delete(key);
        });
        return keys.length;
      });
    },

    /** 清空表 */
    clear: function (tableName) {
      return runTransaction([tableName], 'readwrite', function (tx) {
        tx.objectStore(tableName).clear();
        return true;
      });
    },

    /**
     * 事务执行器：executor(tx) 内直接操作 store，事务自动提交
     */
    transaction: function (storeNames, executor) {
      return runTransaction(storeNames, 'readwrite', executor);
    },

    /** 只读事务执行器 */
    readTransaction: function (storeNames, executor) {
      return runTransaction(storeNames, 'readonly', executor);
    },

    requestToPromise: requestToPromise,

    TABLES: Object.keys(SCHEMA)
  };

  HW.Db = Db;
})(window);
