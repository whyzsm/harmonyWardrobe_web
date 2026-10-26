/* 衣不缺 Web 版 — 照片存储 / Photo Storage
   对应鸿蒙端 entry/src/main/ets/media/PhotoStorage.ets + PhotoPickerAdapter.ets。
   鸿蒙端把照片复制到应用私有目录并保存 file:// URI；
   Web 端改为把 Blob 存入 IndexedDB（photo_blobs 表），以 photoId 引用，
   展示时通过 objectURL 解析。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});

  var objectUrlCache = new Map();

  function photoBlobStore() {
    return HW.Db;
  }

  var PhotoStore = {
    /**
     * 存入一张照片（File/Blob），返回 photoId
     */
    save: function (file) {
      var photoId = HW.utils.createId('photo');
      return photoBlobStore()
        .put('photo_blobs', {
          id: photoId,
          blob: file,
          name: file.name || '',
          type: file.type || '',
          size: file.size || 0,
          created_at: new Date().toISOString()
        })
        .then(function () {
          return photoId;
        });
    },

    /** 批量存入，返回 photoId 数组 */
    saveMany: function (files) {
      return Promise.all(
        (files || []).map(function (file) {
          return PhotoStore.save(file);
        })
      );
    },

    /**
     * 解析 photoId → object URL（带缓存）
     */
    resolve: function (photoId) {
      if (!photoId) {
        return Promise.resolve('');
      }
      if (objectUrlCache.has(photoId)) {
        return Promise.resolve(objectUrlCache.get(photoId));
      }
      return photoBlobStore()
        .get('photo_blobs', photoId)
        .then(function (record) {
          if (!record || !record.blob) {
            return '';
          }
          var url = URL.createObjectURL(record.blob);
          objectUrlCache.set(photoId, url);
          return url;
        })
        .catch(function () {
          return '';
        });
    },

    /** 同步获取已缓存的 object URL */
    resolveCached: function (photoId) {
      if (!photoId) {
        return '';
      }
      return objectUrlCache.get(photoId) || '';
    },

    /** 删除照片实体 */
    remove: function (photoId) {
      if (!photoId) {
        return Promise.resolve();
      }
      var cached = objectUrlCache.get(photoId);
      if (cached) {
        URL.revokeObjectURL(cached);
        objectUrlCache.delete(photoId);
      }
      return photoBlobStore().remove('photo_blobs', photoId);
    },

    /** 批量删除 */
    removeMany: function (photoIds) {
      return Promise.all(
        (photoIds || []).map(function (photoId) {
          return PhotoStore.remove(photoId);
        })
      );
    },

    /** 统计照片数量与总字节（用于备份摘要） */
    summary: function () {
      return photoBlobStore()
        .getAll('photo_blobs')
        .then(function (records) {
          var totalBytes = records.reduce(function (sum, record) {
            return sum + (record.size || 0);
          }, 0);
          return { photoCount: records.length, totalBytes: totalBytes };
        });
    },

    /** 导出全部照片（备份用） */
    exportAll: function () {
      return photoBlobStore()
        .getAll('photo_blobs')
        .then(function (records) {
          return Promise.all(
            records.map(function (record) {
              return blobToBase64(record.blob).then(function (data) {
                return {
                  id: record.id,
                  name: record.name,
                  type: record.type,
                  size: record.size,
                  created_at: record.created_at,
                  data: data
                };
              });
            })
          );
        });
    },

    /** 从备份数据恢复照片 */
    importAll: function (entries) {
      return Promise.all(
        (entries || []).map(function (entry) {
          return base64ToBlob(entry.data, entry.type).then(function (blob) {
            return photoBlobStore().put('photo_blobs', {
              id: entry.id,
              blob: blob,
              name: entry.name || '',
              type: entry.type || blob.type || '',
              size: entry.size || blob.size || 0,
              created_at: entry.created_at || new Date().toISOString()
            });
          });
        })
      );
    },

    /** 清空所有照片 */
    clear: function () {
      objectUrlCache.forEach(function (url) {
        URL.revokeObjectURL(url);
      });
      objectUrlCache.clear();
      return photoBlobStore().clear('photo_blobs');
    },

    /** 释放 object URL 缓存（页面卸载时） */
    releaseCache: function () {
      objectUrlCache.forEach(function (url) {
        URL.revokeObjectURL(url);
      });
      objectUrlCache.clear();
    }
  };

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      if (!blob) {
        resolve('');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = function () {
        reject(new Error('照片读取失败'));
      };
      reader.readAsDataURL(blob);
    });
  }

  function base64ToBlob(base64, type) {
    return new Promise(function (resolve, reject) {
      if (!base64) {
        resolve(new Blob([], { type: type || 'application/octet-stream' }));
        return;
      }
      try {
        var binary = atob(base64);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        resolve(new Blob([bytes], { type: type || 'image/jpeg' }));
      } catch (error) {
        reject(new Error('照片数据解析失败'));
      }
    });
  }

  HW.PhotoStore = PhotoStore;

  /* ===================================================================
     照片选择适配器 / PhotoPickerAdapter
     鸿蒙端通过 PhotoPicker / Camera 拍照；Web 端用 <input type="file">。
     =================================================================== */

  var PhotoPickerAdapter = {
    /**
     * 从相册选择
     * @param {number} maxSelectNumber 最大可选张数
     * @returns {Promise<string[]>} photoId 数组
     */
    pickFromGallery: function (maxSelectNumber) {
      return new Promise(function (resolve) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = (maxSelectNumber || 1) > 1;
        input.style.display = 'none';
        document.body.appendChild(input);

        var settled = false;
        function cleanup() {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
        }

        input.addEventListener('change', function () {
          var files = Array.prototype.slice.call(input.files || []);
          settled = true;
          cleanup();
          if (!files.length) {
            resolve([]);
            return;
          }
          PhotoStore.saveMany(files).then(resolve, function () {
            resolve([]);
          });
        });

        input.addEventListener('cancel', function () {
          if (!settled) {
            settled = true;
            cleanup();
            resolve([]);
          }
        });

        input.click();
      });
    },

    /**
     * 调用摄像头拍照
     * @returns {Promise<string[]>} photoId 数组
     */
    captureFromCamera: function () {
      return new Promise(function (resolve) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
        input.style.display = 'none';
        document.body.appendChild(input);

        var settled = false;
        function cleanup() {
          if (input.parentNode) {
            input.parentNode.removeChild(input);
          }
        }

        input.addEventListener('change', function () {
          var files = Array.prototype.slice.call(input.files || []);
          settled = true;
          cleanup();
          if (!files.length) {
            resolve([]);
            return;
          }
          PhotoStore.saveMany(files).then(resolve, function () {
            resolve([]);
          });
        });

        input.addEventListener('cancel', function () {
          if (!settled) {
            settled = true;
            cleanup();
            resolve([]);
          }
        });

        input.click();
      });
    }
  };

  HW.PhotoPickerAdapter = PhotoPickerAdapter;
})(window);
