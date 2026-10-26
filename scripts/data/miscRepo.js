/* 衣不缺 Web 版 — 穿着记录/心愿/档案 仓储
   对应鸿蒙端 WearLogRepository / WishlistRepository / ProfileRepository。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var Db = HW.Db;
  var utils = HW.utils;
  var models = HW.models;

  /* ===================================================================
     穿着记录 / WearLogRepository
     =================================================================== */

  function mapWearLogRow(row, photoUris) {
    return {
      id: row.id,
      outfitTemplateId: row.outfit_id || undefined,
      outfitTitleSnapshot: row.outfit_title_snapshot,
      clothingItemIdsSnapshot: row.clothing_item_ids_snapshot
        ? String(row.clothing_item_ids_snapshot).split('|').filter(Boolean)
        : [],
      wornDate: row.worn_date,
      photoUris: photoUris || [],
      placeText: utils.optionalText(row.place_text),
      note: utils.optionalText(row.note),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  var WearLogRepository = {
    listWearLogs: function () {
      return Promise.all([Db.getAll('wear_logs'), Db.getAll('wear_log_photos')]).then(
        function (results) {
          var logRows = results[0];
          var photoRows = results[1];
          var photoMap = new Map();
          photoRows.forEach(function (row) {
            if (!photoMap.has(row.wear_log_id)) {
              photoMap.set(row.wear_log_id, []);
            }
            photoMap.get(row.wear_log_id).push(row);
          });

          return logRows
            .map(function (row) {
              var photos = (photoMap.get(row.id) || []).sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
              });
              return mapWearLogRow(
                row,
                photos.map(function (photo) {
                  return photo.local_uri;
                })
              );
            })
            .sort(function (a, b) {
              var dateCompare = String(b.wornDate).localeCompare(String(a.wornDate));
              if (dateCompare !== 0) {
                return dateCompare;
              }
              return String(b.updatedAt).localeCompare(String(a.updatedAt));
            });
        }
      );
    },

    getWearLogById: function (id) {
      return Db.get('wear_logs', id).then(function (row) {
        if (!row) {
          return undefined;
        }
        return Db.getAllByIndex('wear_log_photos', 'idx_wear_log_photos_wear_log_id', id).then(
          function (photoRows) {
            var photos = photoRows.sort(function (a, b) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            });
            return mapWearLogRow(
              row,
              photos.map(function (photo) {
                return photo.local_uri;
              })
            );
          }
        );
      });
    },

    createWearLog: function (input) {
      var now = new Date().toISOString();
      var id = utils.createId('wearlog');
      var photoUris = (input.photoUris || []).filter(function (uri) {
        return !!uri;
      });

      return WearLogRepository.buildSnapshot(input.outfitTemplateId).then(function (snapshot) {
        var row = {
          id: id,
          outfit_id: input.outfitTemplateId || null,
          outfit_title_snapshot: snapshot.title,
          clothing_item_ids_snapshot: snapshot.clothingItemIds.join('|'),
          worn_date: input.wornDate || utils.todayIsoDate(),
          place_text: utils.optionalText(input.placeText) || null,
          note: utils.optionalText(input.note) || null,
          created_at: now,
          updated_at: now
        };

        var photoRows = photoUris.map(function (uri, index) {
          return {
            id: utils.createId('wlphoto'),
            wear_log_id: id,
            local_uri: uri,
            sort_order: index
          };
        });

        return Db.transaction(
          ['wear_logs', 'wear_log_photos', 'search_documents'],
          function (tx) {
            tx.objectStore('wear_logs').put(row);
            var photoStore = tx.objectStore('wear_log_photos');
            photoRows.forEach(function (photoRow) {
              photoStore.put(photoRow);
            });
            var wearLog = mapWearLogRow(row, photoUris);
            tx.objectStore('search_documents').put(
              Object.assign(
                { id: models.SearchEntityType.WearLog + ':' + id },
                HW.SearchDocumentBuilder.buildWearLogSearchDocument(wearLog)
              )
            );
            return true;
          }
        ).then(function () {
          return WearLogRepository.getWearLogById(id);
        });
      });
    },

    updateWearLog: function (input) {
      return WearLogRepository.getWearLogById(input.id).then(function (existing) {
        if (!existing) {
          throw new Error('穿着记录不存在，请重新选择');
        }
        var photoUris = (input.photoUris || []).filter(function (uri) {
          return !!uri;
        });

        return WearLogRepository.buildSnapshot(input.outfitTemplateId).then(function (snapshot) {
          return Db.getAllByIndex('wear_log_photos', 'idx_wear_log_photos_wear_log_id', input.id).then(
            function (oldPhotoRows) {
              var oldUris = oldPhotoRows.map(function (row) {
                return row.local_uri;
              });

              var row = {
                id: input.id,
                outfit_id: input.outfitTemplateId || null,
                outfit_title_snapshot: snapshot.title,
                clothing_item_ids_snapshot: snapshot.clothingItemIds.join('|'),
                worn_date: input.wornDate || existing.wornDate,
                place_text: utils.optionalText(input.placeText) || null,
                note: utils.optionalText(input.note) || null,
                created_at: existing.createdAt,
                updated_at: new Date().toISOString()
              };

              var photoRows = photoUris.map(function (uri, index) {
                return {
                  id: utils.createId('wlphoto'),
                  wear_log_id: input.id,
                  local_uri: uri,
                  sort_order: index
                };
              });

              return Db.transaction(
                ['wear_logs', 'wear_log_photos', 'search_documents'],
                function (tx) {
                  tx.objectStore('wear_logs').put(row);
                  var photoStore = tx.objectStore('wear_log_photos');
                  oldPhotoRows.forEach(function (photoRow) {
                    photoStore.delete(photoRow.id);
                  });
                  photoRows.forEach(function (photoRow) {
                    photoStore.put(photoRow);
                  });
                  var wearLog = mapWearLogRow(row, photoUris);
                  tx.objectStore('search_documents').put(
                    Object.assign(
                      { id: models.SearchEntityType.WearLog + ':' + input.id },
                      HW.SearchDocumentBuilder.buildWearLogSearchDocument(wearLog)
                    )
                  );
                  return true;
                }
              ).then(function () {
                return HW.removeOrphanPhotoBlobs(oldUris);
              }).then(function () {
                return WearLogRepository.getWearLogById(input.id);
              });
            }
          );
        });
      });
    },

    deleteWearLog: function (id) {
      var removedUris = [];
      return Db.getAllByIndex('wear_log_photos', 'idx_wear_log_photos_wear_log_id', id)
        .then(function (photoRows) {
          removedUris = photoRows.map(function (row) {
            return row.local_uri;
          });
          return Db.removeMany(
            'wear_log_photos',
            photoRows.map(function (row) {
              return row.id;
            })
          );
        })
        .then(function () {
          return Db.remove('wear_logs', id);
        })
        .then(function () {
          return HW.SearchRepository.deleteDocument(models.SearchEntityType.WearLog, id);
        })
        .then(function () {
          return HW.removeOrphanPhotoBlobs(removedUris);
        })
        .then(function () {
          return true;
        });
    },

    loadRecentWearLogs: function (outfitId, limit) {
      var max = limit || 5;
      return WearLogRepository.listWearLogs().then(function (logs) {
        return logs
          .filter(function (log) {
            return log.outfitTemplateId === outfitId;
          })
          .slice(0, max);
      });
    },

    /** 穿搭标题与单品快照 */
    buildSnapshot: function (outfitTemplateId) {
      if (!outfitTemplateId) {
        return Promise.resolve({ title: '每日穿搭', clothingItemIds: [] });
      }
      return HW.OutfitRepository.getOutfitById(outfitTemplateId).then(function (outfit) {
        if (!outfit) {
          return { title: '每日穿搭', clothingItemIds: [] };
        }
        return {
          title: outfit.title || '每日穿搭',
          clothingItemIds: (outfit.clothingItemIds || []).slice()
        };
      });
    }
  };

  /* ===================================================================
     心愿清单 / WishlistRepository
     =================================================================== */

  function mapWishlistRow(row, photoUris) {
    return {
      id: row.id,
      title: row.title,
      photoUris: photoUris || [],
      storeName: utils.optionalText(row.store_name),
      price: HW.ClothingRepository.optionalPrice(row.price),
      note: utils.optionalText(row.note),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  var WishlistRepository = {
    listWishlistItems: function () {
      return Promise.all([Db.getAll('wishlist_items'), Db.getAll('wishlist_photos')]).then(
        function (results) {
          var itemRows = results[0];
          var photoRows = results[1];
          var photoMap = new Map();
          photoRows.forEach(function (row) {
            if (!photoMap.has(row.wishlist_id)) {
              photoMap.set(row.wishlist_id, []);
            }
            photoMap.get(row.wishlist_id).push(row);
          });

          return itemRows
            .map(function (row) {
              var photos = (photoMap.get(row.id) || []).sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
              });
              return mapWishlistRow(
                row,
                photos.map(function (photo) {
                  return photo.local_uri;
                })
              );
            })
            .sort(function (a, b) {
              return String(b.updatedAt).localeCompare(String(a.updatedAt));
            });
        }
      );
    },

    getWishlistItemById: function (id) {
      return Db.get('wishlist_items', id).then(function (row) {
        if (!row) {
          return undefined;
        }
        return Db.getAllByIndex('wishlist_photos', 'idx_wishlist_photos_wishlist_id', id).then(
          function (photoRows) {
            var photos = photoRows.sort(function (a, b) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            });
            return mapWishlistRow(
              row,
              photos.map(function (photo) {
                return photo.local_uri;
              })
            );
          }
        );
      });
    },

    createWishlistItem: function (input) {
      var now = new Date().toISOString();
      var id = utils.createId('wish');
      var photoUris = (input.photoUris || []).filter(function (uri) {
        return !!uri;
      });

      var row = {
        id: id,
        title: (input.title || '').trim(),
        store_name: utils.optionalText(input.storeName) || null,
        price:
          input.price === undefined || input.price === null
            ? null
            : HW.ClothingRepository.priceToStoredCents(input.price),
        note: utils.optionalText(input.note) || null,
        created_at: now,
        updated_at: now
      };

      var photoRows = photoUris.map(function (uri, index) {
        return {
          id: utils.createId('wphoto'),
          wishlist_id: id,
          local_uri: uri,
          sort_order: index
        };
      });

      return Db.transaction(
        ['wishlist_items', 'wishlist_photos', 'search_documents'],
        function (tx) {
          tx.objectStore('wishlist_items').put(row);
          var photoStore = tx.objectStore('wishlist_photos');
          photoRows.forEach(function (photoRow) {
            photoStore.put(photoRow);
          });
          var item = mapWishlistRow(row, photoUris);
          tx.objectStore('search_documents').put(
            Object.assign(
              { id: models.SearchEntityType.Wishlist + ':' + id },
              HW.SearchDocumentBuilder.buildWishlistSearchDocument(item)
            )
          );
          return true;
        }
      ).then(function () {
        return WishlistRepository.getWishlistItemById(id);
      });
    },

    updateWishlistItem: function (input) {
      return WishlistRepository.getWishlistItemById(input.id).then(function (existing) {
        if (!existing) {
          throw new Error('心愿不存在，请重新选择');
        }
        var photoUris = (input.photoUris || []).filter(function (uri) {
          return !!uri;
        });

        return Db.getAllByIndex('wishlist_photos', 'idx_wishlist_photos_wishlist_id', input.id).then(
          function (oldPhotoRows) {
            var oldUris = oldPhotoRows.map(function (row) {
              return row.local_uri;
            });

            var row = {
              id: input.id,
              title: (input.title || '').trim(),
              store_name: utils.optionalText(input.storeName) || null,
              price:
                input.price === undefined || input.price === null
                  ? null
                  : HW.ClothingRepository.priceToStoredCents(input.price),
              note: utils.optionalText(input.note) || null,
              created_at: existing.createdAt,
              updated_at: new Date().toISOString()
            };

            var photoRows = photoUris.map(function (uri, index) {
              return {
                id: utils.createId('wphoto'),
                wishlist_id: input.id,
                local_uri: uri,
                sort_order: index
              };
            });

            return Db.transaction(
              ['wishlist_items', 'wishlist_photos', 'search_documents'],
              function (tx) {
                tx.objectStore('wishlist_items').put(row);
                var photoStore = tx.objectStore('wishlist_photos');
                oldPhotoRows.forEach(function (photoRow) {
                  photoStore.delete(photoRow.id);
                });
                photoRows.forEach(function (photoRow) {
                  photoStore.put(photoRow);
                });
                var item = mapWishlistRow(row, photoUris);
                tx.objectStore('search_documents').put(
                  Object.assign(
                    { id: models.SearchEntityType.Wishlist + ':' + input.id },
                    HW.SearchDocumentBuilder.buildWishlistSearchDocument(item)
                  )
                );
                return true;
              }
            ).then(function () {
              return HW.removeOrphanPhotoBlobs(oldUris);
            }).then(function () {
              return WishlistRepository.getWishlistItemById(input.id);
            });
          }
        );
      });
    },

    deleteWishlistItem: function (id) {
      var removedUris = [];
      return Db.getAllByIndex('wishlist_photos', 'idx_wishlist_photos_wishlist_id', id)
        .then(function (photoRows) {
          removedUris = photoRows.map(function (row) {
            return row.local_uri;
          });
          return Db.removeMany(
            'wishlist_photos',
            photoRows.map(function (row) {
              return row.id;
            })
          );
        })
        .then(function () {
          return Db.remove('wishlist_items', id);
        })
        .then(function () {
          return HW.SearchRepository.deleteDocument(models.SearchEntityType.Wishlist, id);
        })
        .then(function () {
          return HW.removeOrphanPhotoBlobs(removedUris);
        })
        .then(function () {
          return true;
        });
    }
  };

  /* ===================================================================
     个人档案 / ProfileRepository
     =================================================================== */

  function normalizeMeasurement(value, min, max) {
    if (value === undefined || value === null) {
      return undefined;
    }
    var numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return undefined;
    }
    if (numeric < min || numeric > max) {
      return undefined;
    }
    return Math.round(numeric * 10) / 10;
  }

  function decodeNumbers(value) {
    if (!value) {
      return [];
    }
    try {
      var parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map(function (item) {
          var numeric = Number(item);
          return Number.isFinite(numeric) ? numeric : undefined;
        })
        .filter(function (item) {
          return item !== undefined && item >= models.PROFILE_BUDGET_MIN;
        })
        .map(function (item) {
          return Math.round(item);
        })
        .filter(function (item, index, array) {
          return array.indexOf(item) === index;
        })
        .slice(0, models.MAX_COMMON_ITEMS);
    } catch (error) {
      return [];
    }
  }

  var ProfileRepository = {
    getProfile: function () {
      return Db.get('user_profile', 'local').then(function (row) {
        if (!row) {
          return {
            heightCm: undefined,
            weightKg: undefined,
            waistCm: undefined,
            upperSize: undefined,
            lowerSize: undefined,
            shoeSize: undefined,
            frequentDistricts: [],
            monthlyBudget: undefined,
            commonBudgets: [],
            updatedAt: ''
          };
        }
        return {
          heightCm:
            row.height_cm === null || row.height_cm === undefined
              ? undefined
              : Number(row.height_cm),
          weightKg:
            row.weight_kg === null || row.weight_kg === undefined
              ? undefined
              : Number(row.weight_kg),
          waistCm:
            row.waist_cm === null || row.waist_cm === undefined
              ? undefined
              : Number(row.waist_cm),
          upperSize: utils.optionalText(row.upper_size),
          lowerSize: utils.optionalText(row.lower_size),
          shoeSize: utils.optionalText(row.shoe_size),
          frequentDistricts: row.frequent_districts
            ? String(row.frequent_districts).split('|').filter(Boolean)
            : [],
          monthlyBudget:
            row.monthly_budget === null || row.monthly_budget === undefined
              ? undefined
              : Number(row.monthly_budget),
          commonBudgets: decodeNumbers(row.common_budgets),
          updatedAt: row.updated_at || ''
        };
      });
    },

    saveProfile: function (input) {
      var row = {
        id: 'local',
        height_cm: normalizeMeasurement(
          input.heightCm,
          models.PROFILE_HEIGHT_MIN_CM,
          models.PROFILE_HEIGHT_MAX_CM
        ),
        weight_kg: normalizeMeasurement(
          input.weightKg,
          models.PROFILE_WEIGHT_MIN_KG,
          models.PROFILE_WEIGHT_MAX_KG
        ),
        waist_cm: normalizeMeasurement(
          input.waistCm,
          models.PROFILE_WAIST_MIN_CM,
          models.PROFILE_WAIST_MAX_CM
        ),
        upper_size: utils.optionalText(input.upperSize) || null,
        lower_size: utils.optionalText(input.lowerSize) || null,
        shoe_size: utils.optionalText(input.shoeSize) || null,
        frequent_districts: (input.frequentDistricts || []).slice(0, models.MAX_COMMON_ITEMS).join('|'),
        monthly_budget:
          input.monthlyBudget === undefined || input.monthlyBudget === null
            ? null
            : Number(input.monthlyBudget),
        common_budgets: JSON.stringify(
          (input.commonBudgets || [])
            .filter(function (value) {
              return Number.isFinite(Number(value)) && Number(value) >= models.PROFILE_BUDGET_MIN;
            })
            .map(function (value) {
              return Math.round(Number(value));
            })
            .filter(function (value, index, array) {
              return array.indexOf(value) === index;
            })
            .slice(0, models.MAX_COMMON_ITEMS)
        ),
        updated_at: new Date().toISOString()
      };
      return Db.put('user_profile', row).then(function () {
        return ProfileRepository.getProfile();
      });
    },

    normalizeMeasurement: normalizeMeasurement
  };

  HW.WearLogRepository = WearLogRepository;
  HW.WishlistRepository = WishlistRepository;
  HW.ProfileRepository = ProfileRepository;
})(window);
