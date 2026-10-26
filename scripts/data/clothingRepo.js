/* 衣不缺 Web 版 — 仓储层 / Repositories
   对应鸿蒙端 entry/src/main/ets/data/repositories/**。
   SQLite 行对象 → 领域对象 的映射与业务规则保持一致。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var Db = HW.Db;
  var utils = HW.utils;
  var models = HW.models;

  /* ===================================================================
     搜索索引文档构建 / SearchDocumentBuilder
     =================================================================== */

  function normalizeOptionalText(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    var normalized = utils.normalizeSearchText(value);
    return normalized.length > 0 ? normalized : undefined;
  }

  function joinSearchText(values) {
    return (values || [])
      .map(normalizeOptionalText)
      .filter(function (v) {
        return v !== undefined;
      })
      .join(' ');
  }

  function buildSearchNgramText(values) {
    return utils.buildSearchNgrams(joinSearchText(values)).join(' ');
  }

  function priceToSearchText(price) {
    if (price === undefined || price === null || !Number.isFinite(Number(price))) {
      return undefined;
    }
    return String(price);
  }

  var SearchDocumentBuilder = {
    buildClothingSearchDocument: function (item) {
      var title = utils.normalizeSearchText(item.name);
      var category = normalizeOptionalText(item.category);
      var storeName = normalizeOptionalText(item.purchaseInfo && item.purchaseInfo.storeName);
      var body = joinSearchText([
        item.category,
        item.note,
        item.purchaseInfo && item.purchaseInfo.storeName,
        item.purchaseInfo && item.purchaseInfo.note
      ]);
      return {
        entity_type: models.SearchEntityType.Clothing,
        entity_id: item.id,
        title: title,
        body: body,
        category: category || '',
        store_name: storeName || '',
        ngrams: buildSearchNgramText([title, body, category, storeName])
      };
    },

    buildOutfitSearchDocument: function (outfit, clothingNames) {
      var title = utils.normalizeSearchText(outfit.title);
      var category = normalizeOptionalText((outfit.categoryNames || []).join(' '));
      var body = joinSearchText(
        (outfit.categoryNames || []).concat([outfit.note], clothingNames || [])
      );
      return {
        entity_type: models.SearchEntityType.Outfit,
        entity_id: outfit.id,
        title: title,
        body: body,
        category: category || '',
        store_name: '',
        ngrams: buildSearchNgramText([title, body, category])
      };
    },

    buildWearLogSearchDocument: function (wearLog) {
      var title = utils.normalizeSearchText(wearLog.wornDate);
      var body = joinSearchText([
        wearLog.wornDate,
        wearLog.placeText,
        wearLog.note,
        wearLog.outfitTitleSnapshot
      ]);
      return {
        entity_type: models.SearchEntityType.WearLog,
        entity_id: wearLog.id,
        title: title,
        body: body,
        category: '',
        store_name: '',
        ngrams: buildSearchNgramText([title, body])
      };
    },

    buildWishlistSearchDocument: function (item) {
      var title = utils.normalizeSearchText(item.title);
      var storeName = normalizeOptionalText(item.storeName);
      var priceText = priceToSearchText(item.price);
      var body = joinSearchText([item.storeName, priceText, item.note]);
      return {
        entity_type: models.SearchEntityType.Wishlist,
        entity_id: item.id,
        title: title,
        body: body,
        category: '',
        store_name: storeName || '',
        ngrams: buildSearchNgramText([title, body, storeName])
      };
    },

    buildStoreSearchDocument: function (store) {
      var title = utils.normalizeSearchText(store.name);
      var storeName = normalizeOptionalText(store.name);
      var body = joinSearchText([store.districtOrAddress, store.note]);
      return {
        entity_type: models.SearchEntityType.Store,
        entity_id: store.id,
        title: title,
        body: body,
        category: '',
        store_name: storeName || '',
        ngrams: buildSearchNgramText([title, body, storeName])
      };
    },

    buildStoreVisitSearchDocument: function (visit) {
      var title = utils.normalizeSearchText(visit.storeNameSnapshot);
      var storeName = normalizeOptionalText(visit.storeNameSnapshot);
      var body = joinSearchText([
        visit.visitDate,
        visit.districtOrAddress,
        visit.status,
        (visit.focusTags || []).join(' '),
        visit.note
      ]);
      return {
        entity_type: models.SearchEntityType.StoreVisit,
        entity_id: visit.id,
        title: title,
        body: body,
        category: '',
        store_name: storeName || '',
        ngrams: buildSearchNgramText([title, body, storeName])
      };
    }
  };

  /* ===================================================================
     搜索仓储 / SearchRepository
     鸿蒙端优先 FTS5，降级为 n-gram 表连接；
     Web 端直接实现 n-gram 语义：文档必须同时命中查询的所有 token。
     =================================================================== */

  var SearchRepository = {
    upsertDocument: function (document) {
      var record = Object.assign({ id: document.entity_type + ':' + document.entity_id }, document);
      return Db.put('search_documents', record);
    },

    deleteDocument: function (entityType, entityId) {
      return Db.remove('search_documents', entityType + ':' + entityId);
    },

    rebuildSearchIndex: function (documents) {
      return Db.clear('search_documents').then(function () {
        return Db.putMany(
          'search_documents',
          documents.map(function (document) {
            return Object.assign(
              { id: document.entity_type + ':' + document.entity_id },
              document
            );
          })
        );
      });
    },

    /**
     * 检索：查询按空白切分为 token，全部 token 命中（AND 语义）才算匹配。
     * @returns {Promise<Array<{entityType,entityId,title}>>}
     */
    search: function (query, limit) {
      var tokens = utils
        .buildSearchNgrams(query)
        .filter(function (gram) {
          return gram.length > 0;
        });
      if (tokens.length === 0) {
        return Promise.resolve([]);
      }

      var normalizedLimit = limit === undefined ? 20 : limit;
      if (Number.isFinite(normalizedLimit) && normalizedLimit > 0) {
        normalizedLimit = Math.min(
          models.MAX_SEARCH_LIMIT,
          Math.max(1, Math.floor(normalizedLimit))
        );
      } else {
        normalizedLimit = 20;
      }

      return Db.getAll('search_documents').then(function (documents) {
        var tokenSet = new Set(tokens);
        var matched = [];

        documents.forEach(function (document) {
          var haystack = new Set(
            String(document.ngrams || '')
              .split(/\s+/)
              .filter(function (gram) {
                return gram.length > 0;
              })
          );
          var matchedCount = 0;
          var allTokensPresent = true;
          tokenSet.forEach(function (token) {
            if (haystack.has(token)) {
              matchedCount += 1;
            } else {
              allTokensPresent = false;
            }
          });

          if (allTokensPresent) {
            matched.push({
              entityType: document.entity_type,
              entityId: document.entity_id,
              title: document.title,
              matchedCount: matchedCount
            });
          }
        });

        matched.sort(function (a, b) {
          if (b.matchedCount !== a.matchedCount) {
            return b.matchedCount - a.matchedCount;
          }
          return String(a.title).localeCompare(String(b.title), 'zh-Hans-CN');
        });

        return matched.slice(0, normalizedLimit).map(function (item) {
          return {
            entityType: item.entityType,
            entityId: item.entityId,
            title: item.title
          };
        });
      });
    }
  };

  /* ===================================================================
     衣物仓储 / ClothingRepository
     =================================================================== */

  function priceToStoredCents(price) {
    if (price === undefined || price === null || !Number.isFinite(Number(price))) {
      return null;
    }
    return Math.round(Number(price) * 100);
  }

  function optionalPrice(cents) {
    if (cents === undefined || cents === null || cents === '') {
      return undefined;
    }
    var value = Number(cents) / 100;
    return Number.isFinite(value) ? value : undefined;
  }

  function normalizeDomainPrice(price) {
    if (price === undefined || price === null || !Number.isFinite(Number(price))) {
      return undefined;
    }
    return Math.round(Number(price) * 100) / 100;
  }

  function mapClothingRow(row, photoUris) {
    var purchaseInfo;
    if (
      row.purchase_store_name ||
      row.purchase_price !== undefined && row.purchase_price !== null ||
      row.purchase_date ||
      row.purchase_note
    ) {
      purchaseInfo = {
        storeName: utils.optionalText(row.purchase_store_name),
        price: optionalPrice(row.purchase_price),
        purchaseDate: utils.optionalText(row.purchase_date),
        note: utils.optionalText(row.purchase_note)
      };
    }

    return {
      id: row.id,
      name: row.name,
      category: row.category,
      photoUris: photoUris || [],
      note: utils.optionalText(row.note),
      purchaseInfo: purchaseInfo,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  var ClothingRepository = {
    listClothing: function () {
      return Db.getAll('clothing_items').then(function (rows) {
        return Db.getAll('clothing_photos').then(function (photoRows) {
          var photoMap = new Map();
          photoRows.forEach(function (photoRow) {
            if (!photoMap.has(photoRow.clothing_id)) {
              photoMap.set(photoRow.clothing_id, []);
            }
            photoMap.get(photoRow.clothing_id).push(photoRow);
          });

          return rows
            .map(function (row) {
              var photos = (photoMap.get(row.id) || []).sort(function (a, b) {
                return (a.sort_order || 0) - (b.sort_order || 0);
              });
              return mapClothingRow(
                row,
                photos.map(function (photo) {
                  return photo.local_uri;
                })
              );
            })
            .sort(function (a, b) {
              return String(b.updatedAt).localeCompare(String(a.updatedAt));
            });
        });
      });
    },

    getClothingById: function (id) {
      return Db.get('clothing_items', id).then(function (row) {
        if (!row) {
          return undefined;
        }
        return Db.getAllByIndex('clothing_photos', 'idx_clothing_photos_clothing_id', id).then(
          function (photoRows) {
            var photos = photoRows.sort(function (a, b) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            });
            return mapClothingRow(
              row,
              photos.map(function (photo) {
                return photo.local_uri;
              })
            );
          }
        );
      });
    },

    createClothing: function (input) {
      var now = new Date().toISOString();
      var id = utils.createId('clothing');
      var photoUris = (input.photoUris || []).filter(function (uri) {
        return !!uri;
      });

      var row = {
        id: id,
        name: (input.name || '').trim(),
        category: input.category,
        note: utils.optionalText(input.note) || null,
        purchase_store_name:
          (input.purchaseInfo && input.purchaseInfo.storeName) || null,
        purchase_price: priceToStoredCents(input.purchaseInfo && input.purchaseInfo.price),
        purchase_date: (input.purchaseInfo && input.purchaseInfo.purchaseDate) || null,
        purchase_note: (input.purchaseInfo && input.purchaseInfo.note) || null,
        created_at: now,
        updated_at: now
      };

      var photoRows = photoUris.map(function (uri, index) {
        return {
          id: utils.createId('cphoto'),
          clothing_id: id,
          local_uri: uri,
          sort_order: index
        };
      });

      return Db.transaction(['clothing_items', 'clothing_photos', 'search_documents'], function (tx) {
        tx.objectStore('clothing_items').put(row);
        var photoStore = tx.objectStore('clothing_photos');
        photoRows.forEach(function (photoRow) {
          photoStore.put(photoRow);
        });
        var item = mapClothingRow(row, photoUris);
        tx.objectStore('search_documents').put(
          Object.assign(
            { id: models.SearchEntityType.Clothing + ':' + id },
            SearchDocumentBuilder.buildClothingSearchDocument(item)
          )
        );
        return item;
      });
    },

    updateClothing: function (input) {
      return ClothingRepository.getClothingById(input.id).then(function (existing) {
        if (!existing) {
          throw new Error('衣物不存在，请重新选择');
        }
        var photoUris = (input.photoUris || []).filter(function (uri) {
          return !!uri;
        });

        var row = {
          id: input.id,
          name: (input.name || '').trim(),
          category: input.category,
          note: utils.optionalText(input.note) || null,
          purchase_store_name:
            (input.purchaseInfo && input.purchaseInfo.storeName) || null,
          purchase_price: priceToStoredCents(input.purchaseInfo && input.purchaseInfo.price),
          purchase_date: (input.purchaseInfo && input.purchaseInfo.purchaseDate) || null,
          purchase_note: (input.purchaseInfo && input.purchaseInfo.note) || null,
          created_at: existing.createdAt,
          updated_at: new Date().toISOString()
        };

        var photoRows = photoUris.map(function (uri, index) {
          return {
            id: utils.createId('cphoto'),
            clothing_id: input.id,
            local_uri: uri,
            sort_order: index
          };
        });

        /* 先取旧照片行，用于后续孤儿清理（必须在改写前读取） */
        return Db.getAllByIndex('clothing_photos', 'idx_clothing_photos_clothing_id', input.id).then(
          function (oldPhotoRows) {
            var oldUris = oldPhotoRows.map(function (photoRow) {
              return photoRow.local_uri;
            });

            return Db.transaction(
              ['clothing_items', 'clothing_photos', 'search_documents'],
              function (tx) {
                tx.objectStore('clothing_items').put(row);

                /* 覆盖式写入：先删该衣物的全部旧照片行，再写新的 */
                var photoStore = tx.objectStore('clothing_photos');
                oldPhotoRows.forEach(function (photoRow) {
                  photoStore.delete(photoRow.id);
                });
                photoRows.forEach(function (photoRow) {
                  photoStore.put(photoRow);
                });

                var item = mapClothingRow(row, photoUris);
                tx.objectStore('search_documents').put(
                  Object.assign(
                    { id: models.SearchEntityType.Clothing + ':' + input.id },
                    SearchDocumentBuilder.buildClothingSearchDocument(item)
                  )
                );
                return item;
              }
            ).then(function (item) {
              return removeOrphanPhotoBlobs(oldUris).then(function () {
                return item;
              });
            });
          }
        );
      });
    },

    deleteClothing: function (id) {
      var removedUris = [];
      return Db.getAllByIndex('clothing_photos', 'idx_clothing_photos_clothing_id', id).then(
        function (photoRows) {
          removedUris = photoRows.map(function (row) {
            return row.local_uri;
          });
          return Db.removeMany(
            'clothing_photos',
            photoRows.map(function (row) {
              return row.id;
            })
          );
        }
      ).then(function () {
        return Db.remove('clothing_items', id);
      }).then(function () {
        return Db.getAll('outfit_items');
      }).then(function (outfitItems) {
        var detach = outfitItems.filter(function (row) {
          return row.clothing_id === id;
        });
        return Db.removeMany(
          'outfit_items',
          detach.map(function (row) {
            return row.id;
          })
        );
      }).then(function () {
        return SearchRepository.deleteDocument(models.SearchEntityType.Clothing, id);
      }).then(function () {
        return removeOrphanPhotoBlobs(removedUris);
      }).then(function () {
        return true;
      });
    },

    getClothingSummary: function (yearMonth) {
      return Db.getAll('clothing_items').then(function (rows) {
        var totalCount = rows.length;
        var monthlySpentCents = 0;
        rows.forEach(function (row) {
          if (
            row.purchase_date &&
            String(row.purchase_date).substring(0, 7) === yearMonth &&
            row.purchase_price
          ) {
            monthlySpentCents += Number(row.purchase_price);
          }
        });
        return { totalCount: totalCount, monthlySpent: monthlySpentCents / 100 };
      });
    },

    priceToStoredCents: priceToStoredCents,
    optionalPrice: optionalPrice,
    normalizeDomainPrice: normalizeDomainPrice
  };

  /* 清理没有任何记录引用的照片 Blob */
  function removeOrphanPhotoBlobs(candidateUris) {
    if (!candidateUris || candidateUris.length === 0) {
      return Promise.resolve();
    }
    var photoTables = [
      'clothing_photos',
      'outfit_photos',
      'wear_log_photos',
      'wishlist_photos',
      'store_photos',
      'store_visit_photos'
    ];

    return Promise.all(
      photoTables.map(function (tableName) {
        return Db.getAll(tableName);
      })
    ).then(function (results) {
      var referenced = new Set();
      results.forEach(function (rows) {
        rows.forEach(function (row) {
          if (row.local_uri) {
            referenced.add(row.local_uri);
          }
        });
      });

      var orphans = candidateUris.filter(function (uri) {
        return !referenced.has(uri);
      });
      return HW.PhotoStore.removeMany(orphans);
    });
  }

  HW.SearchDocumentBuilder = SearchDocumentBuilder;
  HW.SearchRepository = SearchRepository;
  HW.ClothingRepository = ClothingRepository;
  HW.removeOrphanPhotoBlobs = removeOrphanPhotoBlobs;
})(window);
