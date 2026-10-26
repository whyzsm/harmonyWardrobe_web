/* 衣不缺 Web 版 — 穿搭仓储 / OutfitRepository
   对应鸿蒙端 entry/src/main/ets/data/repositories/OutfitRepository.ets。
   穿搭分类为多对多关系（outfit_template_categories），
   outfit_templates.category_id 仅保留首分类兼容镜像。 */
(function (global) {
  'use strict';

  var HW = (global.HW = global.HW || {});
  var Db = HW.Db;
  var utils = HW.utils;
  var models = HW.models;

  /**
   * 分类名归一化（与 ArkTS normalizeOutfitCategoryName 一致）
   * @throws {Error} 名称超长或使用保留词
   */
  function normalizeOutfitCategoryName(value) {
    if (value === undefined || value === null) {
      return undefined;
    }
    var name = String(value).normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (name.length === 0) {
      return undefined;
    }
    if (name.length > models.OUTFIT_CATEGORY_MAX_LENGTH) {
      throw new Error('分类名称最多 ' + models.OUTFIT_CATEGORY_MAX_LENGTH + ' 个字符');
    }
    var normalizedName = utils.normalizeSearchText(name);
    if (
      normalizedName === utils.normalizeSearchText('全部') ||
      normalizedName === utils.normalizeSearchText('未分类')
    ) {
      throw new Error('“全部”和“未分类”不能作为自定义分类');
    }
    return name;
  }

  function normalizeOutfitCategoryNames(categoryNames) {
    if (categoryNames === undefined || categoryNames === null) {
      return [];
    }
    var names = [];
    var seen = new Set();
    categoryNames.forEach(function (categoryName) {
      var name = normalizeOutfitCategoryName(categoryName);
      if (name === undefined) {
        return;
      }
      var normalizedName = utils.normalizeSearchText(name);
      if (seen.has(normalizedName)) {
        return;
      }
      seen.add(normalizedName);
      names.push(name);
    });
    return names;
  }

  function relationId(outfitId, categoryId) {
    return outfitId + '::' + categoryId;
  }

  function itemId(outfitId, clothingId) {
    return outfitId + '::' + clothingId;
  }

  function mapOutfitRow(row, photoUris, clothingItemIds, categoryIds, categoryNames, categoryMap) {
    var primaryCategoryId = row.category_id || '';
    return {
      id: row.id,
      title: row.title,
      photoUris: photoUris || [],
      clothingItemIds: clothingItemIds || [],
      displaySource: row.display_source || models.OutfitDisplaySource.Photo,
      categoryIds: categoryIds || [],
      categoryNames: categoryNames || [],
      categoryId: primaryCategoryId || undefined,
      categoryName: categoryMap.get(primaryCategoryId),
      note: utils.optionalText(row.note),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  var OutfitRepository = {
    listOutfits: function () {
      return Promise.all([
        Db.getAll('outfit_templates'),
        Db.getAll('outfit_photos'),
        Db.getAll('outfit_items'),
        Db.getAll('outfit_template_categories'),
        Db.getAll('outfit_categories')
      ]).then(function (results) {
        var templateRows = results[0];
        var photoRows = results[1];
        var itemRows = results[2];
        var relationRows = results[3];
        var categoryRows = results[4];

        var categoryMap = new Map();
        categoryRows.forEach(function (row) {
          categoryMap.set(row.id, row.name);
        });

        var photoMap = new Map();
        photoRows.forEach(function (row) {
          if (!photoMap.has(row.outfit_id)) {
            photoMap.set(row.outfit_id, []);
          }
          photoMap.get(row.outfit_id).push(row);
        });

        var itemMap = new Map();
        itemRows.forEach(function (row) {
          if (!itemMap.has(row.outfit_id)) {
            itemMap.set(row.outfit_id, []);
          }
          itemMap.get(row.outfit_id).push(row);
        });

        var relationMap = new Map();
        relationRows.forEach(function (row) {
          if (!relationMap.has(row.outfit_id)) {
            relationMap.set(row.outfit_id, []);
          }
          relationMap.get(row.outfit_id).push(row);
        });

        return templateRows
          .map(function (row) {
            var photos = (photoMap.get(row.id) || []).sort(function (a, b) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            });
            var items = (itemMap.get(row.id) || []).sort(function (a, b) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            });
            var relations = (relationMap.get(row.id) || []).sort(function (a, b) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            });

            return mapOutfitRow(
              row,
              photos.map(function (photo) {
                return photo.local_uri;
              }),
              items.map(function (item) {
                return item.clothing_id;
              }),
              relations.map(function (relation) {
                return relation.category_id;
              }),
              relations
                .map(function (relation) {
                  return categoryMap.get(relation.category_id);
                })
                .filter(function (name) {
                  return name !== undefined;
                }),
              categoryMap
            );
          })
          .sort(function (a, b) {
            return String(b.updatedAt).localeCompare(String(a.updatedAt));
          });
      });
    },

    getOutfitById: function (id) {
      return OutfitRepository.listOutfits().then(function (outfits) {
        return outfits.filter(function (outfit) {
          return outfit.id === id;
        })[0];
      });
    },

    listOutfitCategories: function () {
      return Promise.all([
        Db.getAll('outfit_categories'),
        Db.getAll('outfit_template_categories')
      ]).then(function (results) {
        var categoryRows = results[0];
        var relationRows = results[1];

        var usageMap = new Map();
        relationRows.forEach(function (row) {
          usageMap.set(row.category_id, (usageMap.get(row.category_id) || 0) + 1);
        });

        return categoryRows
          .map(function (row) {
            return {
              id: row.id,
              name: row.name,
              usageCount: usageMap.get(row.id) || 0
            };
          })
          .sort(function (a, b) {
            if (a.usageCount !== b.usageCount) {
              return b.usageCount - a.usageCount;
            }
            return String(a.name).localeCompare(String(b.name), 'zh-Hans-CN');
          });
      });
    },

    /**
     * 保存分类（同名复用，否则新建），返回分类 id
     */
    ensureCategory: function (name) {
      var normalized = normalizeOutfitCategoryName(name);
      if (normalized === undefined) {
        return Promise.resolve(undefined);
      }
      return Db.getAll('outfit_categories').then(function (rows) {
        var existing = rows.filter(function (row) {
          return utils.normalizeSearchText(row.name) === utils.normalizeSearchText(normalized);
        })[0];
        if (existing) {
          return existing.id;
        }
        var id = utils.createId('ocategory');
        return Db.put('outfit_categories', {
          id: id,
          name: normalized,
          created_at: new Date().toISOString()
        }).then(function () {
          return id;
        });
      });
    },

    createOutfit: function (input) {
      var now = new Date().toISOString();
      var id = utils.createId('outfit');
      var photoUris = (input.photoUris || []).filter(function (uri) {
        return !!uri;
      });
      var clothingItemIds = utils.uniquePreservingOrder(input.clothingItemIds || []);
      var categoryNames = normalizeOutfitCategoryNames(input.categoryNames || []);
      var displaySource =
        input.displaySource === models.OutfitDisplaySource.Wardrobe
          ? models.OutfitDisplaySource.Wardrobe
          : models.OutfitDisplaySource.Photo;

      return OutfitRepository.resolveCategoryIds(categoryNames).then(function (categoryIds) {
        var row = {
          id: id,
          title: (input.title || '').trim() || '穿搭',
          note: utils.optionalText(input.note) || null,
          category_id: categoryIds.length > 0 ? categoryIds[0] : null,
          display_source: displaySource,
          created_at: now,
          updated_at: now
        };

        var photoRows = photoUris.map(function (uri, index) {
          return {
            id: utils.createId('ophoto'),
            outfit_id: id,
            local_uri: uri,
            sort_order: index
          };
        });

        var itemRows = clothingItemIds.map(function (clothingId, index) {
          return {
            id: itemId(id, clothingId),
            outfit_id: id,
            clothing_id: clothingId,
            sort_order: index
          };
        });

        var relationRows = categoryIds.map(function (categoryId, index) {
          return {
            id: relationId(id, categoryId),
            outfit_id: id,
            category_id: categoryId,
            sort_order: index
          };
        });

        return Db.transaction(
          ['outfit_templates', 'outfit_photos', 'outfit_items', 'outfit_template_categories'],
          function (tx) {
            tx.objectStore('outfit_templates').put(row);
            var photoStore = tx.objectStore('outfit_photos');
            photoRows.forEach(function (photoRow) {
              photoStore.put(photoRow);
            });
            var outfitItemStore = tx.objectStore('outfit_items');
            itemRows.forEach(function (itemRow) {
              outfitItemStore.put(itemRow);
            });
            var relationStore = tx.objectStore('outfit_template_categories');
            relationRows.forEach(function (relationRow) {
              relationStore.put(relationRow);
            });
            return true;
          }
        ).then(function () {
          return OutfitRepository.getOutfitById(id);
        }).then(function (outfit) {
          return OutfitRepository.reindexOutfit(outfit).then(function () {
            return outfit;
          });
        });
      });
    },

    updateOutfit: function (input) {
      return OutfitRepository.getOutfitById(input.id).then(function (existing) {
        if (!existing) {
          throw new Error('穿搭不存在，请重新选择');
        }

        var photoUris = (input.photoUris || []).filter(function (uri) {
          return !!uri;
        });
        var clothingItemIds = utils.uniquePreservingOrder(input.clothingItemIds || []);
        var categoryNames = normalizeOutfitCategoryNames(input.categoryNames || []);
        var displaySource =
          input.displaySource === models.OutfitDisplaySource.Wardrobe
            ? models.OutfitDisplaySource.Wardrobe
            : models.OutfitDisplaySource.Photo;

        return OutfitRepository.resolveCategoryIds(categoryNames).then(function (categoryIds) {
          var row = {
            id: input.id,
            title: (input.title || '').trim() || '穿搭',
            note: utils.optionalText(input.note) || null,
            category_id: categoryIds.length > 0 ? categoryIds[0] : null,
            display_source: displaySource,
            created_at: existing.createdAt,
            updated_at: new Date().toISOString()
          };

          return Promise.all([
            Db.getAllByIndex('outfit_photos', 'idx_outfit_photos_outfit_id', input.id),
            Db.getAll('outfit_items'),
            Db.getAll('outfit_template_categories')
          ]).then(function (results) {
            var oldPhotoRows = results[0];
            var allItemRows = results[1];
            var allRelationRows = results[2];
            var oldUris = oldPhotoRows.map(function (photoRow) {
              return photoRow.local_uri;
            });
            var oldItemRows = allItemRows.filter(function (itemRow) {
              return itemRow.outfit_id === input.id;
            });
            var oldRelationRows = allRelationRows.filter(function (relationRow) {
              return relationRow.outfit_id === input.id;
            });

            var photoRows = photoUris.map(function (uri, index) {
              return {
                id: utils.createId('ophoto'),
                outfit_id: input.id,
                local_uri: uri,
                sort_order: index
              };
            });
            var itemRows = clothingItemIds.map(function (clothingId, index) {
              return {
                id: itemId(input.id, clothingId),
                outfit_id: input.id,
                clothing_id: clothingId,
                sort_order: index
              };
            });
            var relationRows = categoryIds.map(function (categoryId, index) {
              return {
                id: relationId(input.id, categoryId),
                outfit_id: input.id,
                category_id: categoryId,
                sort_order: index
              };
            });

            return Db.transaction(
              ['outfit_templates', 'outfit_photos', 'outfit_items', 'outfit_template_categories'],
              function (tx) {
                tx.objectStore('outfit_templates').put(row);

                var photoStore = tx.objectStore('outfit_photos');
                oldPhotoRows.forEach(function (photoRow) {
                  photoStore.delete(photoRow.id);
                });
                photoRows.forEach(function (photoRow) {
                  photoStore.put(photoRow);
                });

                var outfitItemStore = tx.objectStore('outfit_items');
                oldItemRows.forEach(function (itemRow) {
                  outfitItemStore.delete(itemRow.id);
                });
                itemRows.forEach(function (itemRow) {
                  outfitItemStore.put(itemRow);
                });

                var relationStore = tx.objectStore('outfit_template_categories');
                oldRelationRows.forEach(function (relationRow) {
                  relationStore.delete(relationRow.id);
                });
                relationRows.forEach(function (relationRow) {
                  relationStore.put(relationRow);
                });
                return true;
              }
            ).then(function () {
              return HW.removeOrphanPhotoBlobs(oldUris);
            }).then(function () {
              return OutfitRepository.getOutfitById(input.id);
            }).then(function (outfit) {
              return OutfitRepository.reindexOutfit(outfit).then(function () {
                return outfit;
              });
            });
          });
        });
      });
    },

    deleteOutfit: function (id) {
      var removedUris = [];
      return Promise.all([
        Db.getAllByIndex('outfit_photos', 'idx_outfit_photos_outfit_id', id),
        Db.getAll('outfit_items'),
        Db.getAll('outfit_template_categories')
      ]).then(function (results) {
        var photoRows = results[0];
        var itemRows = results[1].filter(function (row) {
          return row.outfit_id === id;
        });
        var relationRows = results[2].filter(function (row) {
          return row.outfit_id === id;
        });

        removedUris = photoRows.map(function (row) {
          return row.local_uri;
        });

        return Db.transaction(
          ['outfit_templates', 'outfit_photos', 'outfit_items', 'outfit_template_categories'],
          function (tx) {
            tx.objectStore('outfit_templates').delete(id);
            var photoStore = tx.objectStore('outfit_photos');
            photoRows.forEach(function (row) {
              photoStore.delete(row.id);
            });
            var itemStore = tx.objectStore('outfit_items');
            itemRows.forEach(function (row) {
              itemStore.delete(row.id);
            });
            var relationStore = tx.objectStore('outfit_template_categories');
            relationRows.forEach(function (row) {
              relationStore.delete(row.id);
            });
            return true;
          }
        );
      }).then(function () {
        return HW.SearchRepository.deleteDocument(models.SearchEntityType.Outfit, id);
      }).then(function () {
        return HW.removeOrphanPhotoBlobs(removedUris);
      }).then(function () {
        return true;
      });
    },

    /**
     * 删除分类：只清除关联关系，不删除穿搭/衣物/照片
     * @returns {Promise<number>} 受影响的穿搭数量
     */
    deleteOutfitCategory: function (id) {
      return Db.getAll('outfit_template_categories').then(function (relationRows) {
        var affected = relationRows.filter(function (row) {
          return row.category_id === id;
        });
        var affectedOutfitIds = affected.map(function (row) {
          return row.outfit_id;
        });

        return Db.transaction(
          ['outfit_categories', 'outfit_template_categories', 'outfit_templates'],
          function (tx) {
            tx.objectStore('outfit_categories').delete(id);
            var relationStore = tx.objectStore('outfit_template_categories');
            affected.forEach(function (row) {
              relationStore.delete(row.id);
            });
            return true;
          }
        ).then(function () {
          /* 重建受影响穿搭的首分类镜像 */
          return Promise.all(
            affectedOutfitIds.map(function (outfitId) {
              return Db.getAll('outfit_template_categories').then(function (rows) {
                var remaining = rows.filter(function (row) {
                  return row.outfit_id === outfitId;
                });
                return Db.get('outfit_templates', outfitId).then(function (template) {
                  if (!template) {
                    return undefined;
                  }
                  template.category_id =
                    remaining.length > 0 ? remaining[0].category_id : null;
                  template.updated_at = template.updated_at;
                  return Db.put('outfit_templates', template).then(function () {
                    return OutfitRepository.getOutfitById(outfitId);
                  });
                });
              });
            })
          ).then(function (outfits) {
            var valid = outfits.filter(function (outfit) {
              return outfit !== undefined;
            });
            return Promise.all(
              valid.map(function (outfit) {
                return OutfitRepository.reindexOutfit(outfit);
              })
            ).then(function () {
              return affectedOutfitIds.length;
            });
          });
        });
      });
    },

    getOutfitCount: function () {
      return Db.getAll('outfit_templates').then(function (rows) {
        return rows.length;
      });
    },

    /** 重建单套穿搭的搜索文档 */
    reindexOutfit: function (outfit) {
      if (!outfit) {
        return Promise.resolve();
      }
      return HW.ClothingRepository.listClothing().then(function (clothingItems) {
        var nameMap = new Map();
        clothingItems.forEach(function (item) {
          nameMap.set(item.id, item.name);
        });
        var clothingNames = (outfit.clothingItemIds || []).map(function (clothingId) {
          return nameMap.get(clothingId);
        }).filter(function (name) {
          return name !== undefined;
        });
        var document = HW.SearchDocumentBuilder.buildOutfitSearchDocument(outfit, clothingNames);
        return HW.SearchRepository.upsertDocument(document);
      });
    },

    /** 分类名 → 分类 id 列表（同名复用） */
    resolveCategoryIds: function (categoryNames) {
      var names = normalizeOutfitCategoryNames(categoryNames);
      if (names.length === 0) {
        return Promise.resolve([]);
      }
      return Db.getAll('outfit_categories').then(function (rows) {
        var byName = new Map();
        rows.forEach(function (row) {
          byName.set(utils.normalizeSearchText(row.name), row.id);
        });

        var promises = names.map(function (name) {
          var key = utils.normalizeSearchText(name);
          if (byName.has(key)) {
            return Promise.resolve(byName.get(key));
          }
          var id = utils.createId('ocategory');
          return Db.put('outfit_categories', {
            id: id,
            name: name,
            created_at: new Date().toISOString()
          }).then(function () {
            byName.set(key, id);
            return id;
          });
        });

        return Promise.all(promises);
      });
    },

    normalizeOutfitCategoryName: normalizeOutfitCategoryName,
    normalizeOutfitCategoryNames: normalizeOutfitCategoryNames
  };

  HW.OutfitRepository = OutfitRepository;
})(window);
