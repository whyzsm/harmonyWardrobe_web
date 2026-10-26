/* 衣不缺 Web 版 — 门店/逛店仓储 / StoreRepository
   对应鸿蒙端 entry/src/main/ets/data/repositories/StoreRepository.ets。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var Db = HW.Db;
  var utils = HW.utils;
  var models = HW.models;

  function mapStoreRow(row, photoUris) {
    return {
      id: row.id,
      name: row.name,
      districtOrAddress: utils.optionalText(row.district_or_address),
      photoUris: photoUris || [],
      note: utils.optionalText(row.note),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  function mapStoreVisitRow(row, photoUris) {
    return {
      id: row.id,
      storeId: row.store_id || undefined,
      storeNameSnapshot: row.store_name_snapshot,
      districtOrAddress: utils.optionalText(row.district_or_address),
      visitDate: row.visit_date,
      photoUris: photoUris || [],
      status: row.status || models.StoreVisitStatus.Visited,
      focusTags: row.focus_tags ? String(row.focus_tags).split('|').filter(Boolean) : [],
      note: utils.optionalText(row.note),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  var StoreRepository = {
    listStoreVisits: function () {
      return Promise.all([Db.getAll('store_visits'), Db.getAll('store_visit_photos')]).then(
        function (results) {
          var visitRows = results[0];
          var photoRows = results[1];

          var photoMap = new Map();
          photoRows.forEach(function (row) {
            if (!photoMap.has(row.store_visit_id)) {
              photoMap.set(row.store_visit_id, []);
            }
            photoMap.get(row.store_visit_id).push(row);
          });

          return visitRows
            .map(function (row) {
              var photos = (photoMap.get(row.id) || []).sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
              });
              return mapStoreVisitRow(
                row,
                photos.map(function (photo) {
                  return photo.local_uri;
                })
              );
            })
            .sort(function (a, b) {
              var dateCompare = String(b.visitDate).localeCompare(String(a.visitDate));
              if (dateCompare !== 0) {
                return dateCompare;
              }
              return String(b.updatedAt).localeCompare(String(a.updatedAt));
            });
        }
      );
    },

    getStoreVisitById: function (id) {
      return StoreRepository.listStoreVisits().then(function (visits) {
        return visits.filter(function (visit) {
          return visit.id === id;
        })[0];
      });
    },

    getStoreVisitCount: function () {
      return Db.getAll('store_visits').then(function (rows) {
        return rows.length;
      });
    },

    findStoreByName: function (name) {
      var normalized = utils.normalizeSearchText(name);
      if (!normalized) {
        return Promise.resolve(undefined);
      }
      return Db.getAll('stores').then(function (rows) {
        var matched = rows.filter(function (row) {
          return utils.normalizeSearchText(row.name) === normalized;
        })[0];
        if (!matched) {
          return undefined;
        }
        return Db.getAll('store_photos').then(function (photoRows) {
          var photos = photoRows
            .filter(function (row) {
              return row.store_id === matched.id;
            })
            .sort(function (a, b) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            });
          return mapStoreRow(
            matched,
            photos.map(function (photo) {
              return photo.local_uri;
            })
          );
        });
      });
    },

    listStores: function () {
      return Promise.all([Db.getAll('stores'), Db.getAll('store_photos')]).then(function (results) {
        var storeRows = results[0];
        var photoRows = results[1];
        var photoMap = new Map();
        photoRows.forEach(function (row) {
          if (!photoMap.has(row.store_id)) {
            photoMap.set(row.store_id, []);
          }
          photoMap.get(row.store_id).push(row);
        });
        return storeRows.map(function (row) {
          var photos = (photoMap.get(row.id) || []).sort(function (a, b) {
            return (a.sort_order || 0) - (b.sort_order || 0);
          });
          return mapStoreRow(
            row,
            photos.map(function (photo) {
              return photo.local_uri;
            })
          );
        });
      });
    },

    /**
     * 创建逛店记录；storeName 命中既有门店则复用，否则新建门店
     */
    createStoreVisitWithOptionalStore: function (input) {
      var now = new Date().toISOString();
      var id = utils.createId('visit');
      var photoUris = (input.photoUris || []).filter(function (uri) {
        return !!uri;
      });

      var storeName = (input.storeName || '').trim();
      var storeNameSnapshot = (input.storeNameSnapshot || '').trim();

      return StoreRepository.findStoreByName(storeName).then(function (existingStore) {
        var storeId;
        if (existingStore) {
          storeId = existingStore.id;
        } else if (storeName) {
          storeId = utils.createId('store');
        } else {
          storeId = undefined;
        }

        var visitRow = {
          id: id,
          store_id: storeId || null,
          store_name_snapshot: storeNameSnapshot,
          district_or_address: utils.optionalText(input.districtOrAddress) || null,
          visit_date: input.visitDate || utils.todayIsoDate(),
          status: input.status || models.StoreVisitStatus.Visited,
          focus_tags: (input.focusTags || []).join('|'),
          note: utils.optionalText(input.note) || null,
          created_at: now,
          updated_at: now
        };

        var photoRows = photoUris.map(function (uri, index) {
          return {
            id: utils.createId('sphoto'),
            store_visit_id: id,
            local_uri: uri,
            sort_order: index
          };
        });

        var storeRow = null;
        var storePhotoRows = [];
        if (storeId && !existingStore) {
          storeRow = {
            id: storeId,
            name: storeName,
            district_or_address: utils.optionalText(input.districtOrAddress) || null,
            note: null,
            created_at: now,
            updated_at: now
          };
          if (photoUris.length > 0) {
            storePhotoRows = [
              {
                id: utils.createId('stphoto'),
                store_id: storeId,
                local_uri: photoUris[0],
                sort_order: 0
              }
            ];
          }
        }

        return Db.transaction(
          ['store_visits', 'store_visit_photos', 'stores', 'store_photos', 'search_documents'],
          function (tx) {
            tx.objectStore('store_visits').put(visitRow);
            var photoStore = tx.objectStore('store_visit_photos');
            photoRows.forEach(function (photoRow) {
              photoStore.put(photoRow);
            });
            if (storeRow) {
              tx.objectStore('stores').put(storeRow);
              var storePhotoStore = tx.objectStore('store_photos');
              storePhotoRows.forEach(function (photoRow) {
                storePhotoStore.put(photoRow);
              });
            }
            var visit = mapStoreVisitRow(visitRow, photoUris);
            tx.objectStore('search_documents').put(
              Object.assign(
                { id: models.SearchEntityType.StoreVisit + ':' + id },
                HW.SearchDocumentBuilder.buildStoreVisitSearchDocument(visit)
              )
            );
            if (storeRow) {
              var store = mapStoreRow(storeRow, [photoUris[0]]);
              tx.objectStore('search_documents').put(
                Object.assign(
                  { id: models.SearchEntityType.Store + ':' + storeId },
                  HW.SearchDocumentBuilder.buildStoreSearchDocument(store)
                )
              );
            }
            return true;
          }
        ).then(function () {
          return StoreRepository.getStoreVisitById(id);
        });
      });
    },

    updateStoreVisitWithOptionalStore: function (input) {
      return StoreRepository.getStoreVisitById(input.id).then(function (existing) {
        if (!existing) {
          throw new Error('逛店记录不存在，请重新选择');
        }
        var photoUris = (input.photoUris || []).filter(function (uri) {
          return !!uri;
        });
        var storeName = (input.storeName || '').trim();
        var storeNameSnapshot = (input.storeNameSnapshot || '').trim();

        return StoreRepository.findStoreByName(storeName).then(function (existingStore) {
          return Db.getAllByIndex('store_visit_photos', 'idx_store_visit_photos_visit_id', input.id)
            .catch(function () {
              return Db.getAll('store_visit_photos').then(function (rows) {
                return rows.filter(function (row) {
                  return row.store_visit_id === input.id;
                });
              });
            })
            .then(function (oldPhotoRows) {
              var oldUris = oldPhotoRows.map(function (row) {
                return row.local_uri;
              });

              var storeId = existingStore ? existingStore.id : existing.storeId;
              var visitRow = {
                id: input.id,
                store_id: storeId || null,
                store_name_snapshot: storeNameSnapshot,
                district_or_address: utils.optionalText(input.districtOrAddress) || null,
                visit_date: input.visitDate || existing.visitDate,
                status: input.status || existing.status,
                focus_tags: (input.focusTags || []).join('|'),
                note: utils.optionalText(input.note) || null,
                created_at: existing.createdAt,
                updated_at: new Date().toISOString()
              };

              var photoRows = photoUris.map(function (uri, index) {
                return {
                  id: utils.createId('sphoto'),
                  store_visit_id: input.id,
                  local_uri: uri,
                  sort_order: index
                };
              });

              return Db.transaction(
                ['store_visits', 'store_visit_photos', 'search_documents'],
                function (tx) {
                  tx.objectStore('store_visits').put(visitRow);
                  var photoStore = tx.objectStore('store_visit_photos');
                  oldPhotoRows.forEach(function (row) {
                    photoStore.delete(row.id);
                  });
                  photoRows.forEach(function (photoRow) {
                    photoStore.put(photoRow);
                  });
                  var visit = mapStoreVisitRow(visitRow, photoUris);
                  tx.objectStore('search_documents').put(
                    Object.assign(
                      { id: models.SearchEntityType.StoreVisit + ':' + input.id },
                      HW.SearchDocumentBuilder.buildStoreVisitSearchDocument(visit)
                    )
                  );
                  return true;
                }
              ).then(function () {
                return HW.removeOrphanPhotoBlobs(oldUris);
              }).then(function () {
                return StoreRepository.getStoreVisitById(input.id);
              });
            });
        });
      });
    },

    deleteStoreVisit: function (id) {
      var removedUris = [];
      return Db.getAll('store_visit_photos')
        .then(function (photoRows) {
          var rows = photoRows.filter(function (row) {
            return row.store_visit_id === id;
          });
          removedUris = rows.map(function (row) {
            return row.local_uri;
          });
          return Db.removeMany(
            'store_visit_photos',
            rows.map(function (row) {
              return row.id;
            })
          );
        })
        .then(function () {
          return Db.remove('store_visits', id);
        })
        .then(function () {
          return HW.SearchRepository.deleteDocument(models.SearchEntityType.StoreVisit, id);
        })
        .then(function () {
          return HW.removeOrphanPhotoBlobs(removedUris);
        })
        .then(function () {
          return true;
        });
    }
  };

  HW.StoreRepository = StoreRepository;
})(window);
