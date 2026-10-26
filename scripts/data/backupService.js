/* 衣不缺 Web 版 — 本地备份 / LocalBackupService
   对应鸿蒙端 entry/src/main/ets/data/backup/LocalBackupService.ets。
   鸿蒙端使用系统文档选择器保存/读取备份；Web 端用 <a download> + <input type="file">。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var Db = HW.Db;

  var BACKUP_VERSION = 1;

  var LocalBackupService = {
    /**
     * 导出全部业务数据 + 照片
     * @returns {Promise<{photoCount:number,totalBytes:number}>}
     */
    exportBackup: function () {
      var tables = [
        'clothing_items',
        'clothing_photos',
        'outfit_templates',
        'outfit_photos',
        'outfit_items',
        'outfit_categories',
        'outfit_template_categories',
        'wear_logs',
        'wear_log_photos',
        'wishlist_items',
        'wishlist_photos',
        'stores',
        'store_photos',
        'store_visits',
        'store_visit_photos',
        'user_profile',
        'search_documents'
      ];

      return Promise.all(
        tables.map(function (tableName) {
          return Db.getAll(tableName);
        })
      ).then(function (results) {
        var data = {};
        tables.forEach(function (tableName, index) {
          data[tableName] = results[index];
        });

        return HW.PhotoStore.exportAll().then(function (photos) {
          var payload = {
            app: 'harmony-wardrobe-web',
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            data: data,
            photos: photos
          };

          var json = JSON.stringify(payload);
          var blob = new Blob([json], { type: 'application/json' });
          var fileName =
            '衣不缺备份-' + utils_stamp() + '.json';
          var url = URL.createObjectURL(blob);
          var anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = fileName;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          setTimeout(function () {
            URL.revokeObjectURL(url);
          }, 1000);

          return {
            photoCount: photos.length,
            totalBytes: blob.size
          };
        });
      });
    },

    /**
     * 导入备份（覆盖当前数据）
     * @param {File} file 备份文件
     * @returns {Promise<{photoCount:number}>}
     */
    importBackup: function (file) {
      return new Promise(function (resolve, reject) {
        var reader = new FileReader();
        reader.onload = function () {
          var payload;
          try {
            payload = JSON.parse(String(reader.result || ''));
          } catch (error) {
            reject(new Error('备份文件格式不正确，无法解析'));
            return;
          }

          if (!payload || payload.app !== 'harmony-wardrobe-web' || !payload.data) {
            reject(new Error('这不是衣不缺的有效备份文件'));
            return;
          }

          var tables = Object.keys(payload.data);
          var clearPromises = tables.map(function (tableName) {
            return Db.clear(tableName).catch(function () {
              return null;
            });
          });

          Promise.all(clearPromises)
            .then(function () {
              var writePromises = tables.map(function (tableName) {
                var rows = payload.data[tableName] || [];
                if (!rows.length) {
                  return Promise.resolve(0);
                }
                return Db.putMany(tableName, rows).catch(function () {
                  return 0;
                });
              });
              return Promise.all(writePromises);
            })
            .then(function () {
              return HW.PhotoStore.clear();
            })
            .then(function () {
              return HW.PhotoStore.importAll(payload.photos || []);
            })
            .then(function () {
              return { photoCount: (payload.photos || []).length };
            })
            .then(resolve)
            .catch(function (error) {
              reject(error);
            });
        };
        reader.onerror = function () {
          reject(new Error('备份文件读取失败'));
        };
        reader.readAsText(file);
      });
    },

    /** 触发文件选择（导入用） */
    selectImportFile: function () {
      return new Promise(function (resolve) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json,.json';
        input.style.display = 'none';
        document.body.appendChild(input);

        var settled = false;
        function cleanup() {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
        }

        input.addEventListener('change', function () {
          var file = (input.files || [])[0];
          settled = true;
          cleanup();
          resolve(file || null);
        });

        input.addEventListener('cancel', function () {
          if (!settled) {
            settled = true;
            cleanup();
            resolve(null);
          }
        });

        input.click();
      });
    }
  };

  function utils_stamp() {
    var now = new Date();
    var pad = function (value) {
      return (value < 10 ? '0' : '') + value;
    };
    return (
      now.getFullYear() +
      pad(now.getMonth() + 1) +
      pad(now.getDate()) +
      '-' +
      pad(now.getHours()) +
      pad(now.getMinutes())
    );
  }

  HW.LocalBackupService = LocalBackupService;
})(window);
