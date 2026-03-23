/**
 * 索引文档命令
 * 功能：增量索引、孤立索引清理、自动分块、强制重建、移除索引
 */

const command = {
  name: 'index-documents',
  description: '将文档索引到向量数据库',
  usage: 'index-documents [--notebook <id>] [--doc-ids <ids>] [--force] [--remove]',

  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.notebookId - 笔记本 ID（可选，索引指定笔记本）
   * @param {Array} args.docIds - 文档 ID 数组（可选，索引指定文档）
   * @param {boolean} args.force - 是否强制重建索引（按范围删除后重建）
   * @param {boolean} args.remove - 只移除索引，不重新索引
   * @returns {Promise<Object>} 执行结果
   */
  async execute(skill, args = {}) {
    const { notebookId, docIds, force = false, remove = false } = args;

    if (!skill.isVectorSearchReady()) {
      await skill.initVectorSearch();
    }
    if (!skill.isVectorSearchReady()) {
      return { success: false, error: '向量搜索功能不可用，请检查 Qdrant 连接' };
    }

    if (remove) {
      return await this.removeIndex(skill, { notebookId, docIds });
    }

    try {
      let documentsToIndex = [];
      let skippedCount = 0;
      let cleanedCount = 0;
      let skippedDocIds = [];

      // 根据参数获取待索引文档
      if (docIds?.length > 0) {
        const result = await this.fetchDocumentsByIds(skill, docIds);
        documentsToIndex = result.documents;
        skippedDocIds = result.skippedDocIds;
      } else if (notebookId) {
        const result = await this.fetchDocumentsByNotebook(skill, notebookId);
        documentsToIndex = result.documents;
        skippedDocIds = result.skippedDocIds;
      } else {
        const result = await this.fetchAllDocuments(skill);
        documentsToIndex = result.documents;
        skippedDocIds = result.skippedDocIds;
      }

      if (documentsToIndex.length === 0 && skippedDocIds.length === 0) {
        return { success: true, indexed: 0, message: '没有找到需要索引的文档' };
      }

      // 强制重建：先删除现有索引
      if (force) {
        await this.deleteExistingIndices(skill, { notebookId, docIds });
      } else {
        // 增量索引：检查更新、清理孤立索引、清理跳过文档的索引
        const result = await this.processIncrementalIndex(skill, { documentsToIndex, notebookId, docIds, skippedDocIds });
        skippedCount = result.skippedCount;
        cleanedCount = result.cleanedCount;
        documentsToIndex = result.documentsToIndex;
      }

      if (documentsToIndex.length === 0) {
        return this.buildResult(0, skippedCount, cleanedCount);
      }

      console.log(`开始索引 ${documentsToIndex.length} 个文档...`);
      const batchResult = await skill.vectorManager.indexBatch(documentsToIndex);

      return this.buildResult(batchResult.indexed, skippedCount, cleanedCount, batchResult);
    } catch (error) {
      console.error('索引文档失败:', error);
      return { success: false, error: error.message };
    }
  },

  // 强制重建：删除现有索引
  async deleteExistingIndices(skill, { notebookId, docIds }) {
    if (docIds?.length > 0) {
      console.log(`强制重建索引，删除 ${docIds.length} 个指定文档的现有索引...`);
      await skill.vectorManager.deleteDocumentsWithChunks(docIds);
    } else if (notebookId) {
      console.log(`强制重建索引，删除笔记本 ${notebookId} 的现有索引...`);
      await skill.vectorManager.deleteNotebookDocuments(notebookId);
    } else {
      console.log('强制重建索引，清空现有数据...');
      await skill.vectorManager.clearCollection();
    }
  },

  // 增量索引：清理孤立索引 + 检查更新 + 清理跳过文档的索引
  async processIncrementalIndex(skill, { documentsToIndex, notebookId, docIds, skippedDocIds }) {
    const originalDocIds = [...new Set(documentsToIndex.map(d => d.originalDocId || d.docId))];
    let skippedCount = 0;
    let cleanedCount = 0;

    console.log('增量索引模式：检查文档更新状态...');

    // 清理跳过索引文档的旧索引
    if (skippedDocIds && skippedDocIds.length > 0) {
      console.log(`清理 ${skippedDocIds.length} 个跳过索引文档的旧索引...`);
      await skill.vectorManager.deleteDocumentsWithChunks(skippedDocIds);
      cleanedCount += skippedDocIds.length;
    }

    if (originalDocIds.length === 0) {
      return { skippedCount, cleanedCount, documentsToIndex };
    }

    // 清理孤立索引（只在索引笔记本或全部文档时执行）
    if (!docIds || docIds.length === 0) {
      const orphanedCount = await this.cleanOrphanedIndices(skill, { originalDocIds, notebookId });
      cleanedCount += orphanedCount;
    }

    // 获取已索引文档的更新时间，找出需要更新的文档
    const indexedUpdateTimes = await skill.vectorManager.getIndexedDocumentsUpdateTime(originalDocIds);
    const originalDocsNeedUpdate = new Set();

    for (const docId of originalDocIds) {
      const indexedTime = indexedUpdateTimes.get(docId);
      const doc = documentsToIndex.find(d => (d.originalDocId || d.docId) === docId && !d.metadata?.isChunk);
      const docTime = doc?.metadata?.updated || 0;
      if (!indexedTime || docTime > indexedTime) {
        originalDocsNeedUpdate.add(docId);
      }
    }

    // 删除需要更新的文档的旧索引（包括分块）
    if (originalDocsNeedUpdate.size > 0) {
      console.log(`删除 ${originalDocsNeedUpdate.size} 个已更新文档的旧索引（含分块）...`);
      await skill.vectorManager.deleteDocumentsWithChunks(Array.from(originalDocsNeedUpdate));
    }

    // 分区：需要更新的文档 vs 未变化的文档
    const { docsNeedUpdate, docsUnchanged } = this.partitionDocuments(documentsToIndex, originalDocsNeedUpdate);
    skippedCount = docsUnchanged.length;

    console.log(`发现 ${originalDocsNeedUpdate.size} 个原始文档需要更新，跳过 ${skippedCount} 个未变化的文档/分块`);

    return { skippedCount, cleanedCount, documentsToIndex: docsNeedUpdate };
  },

  // 清理孤立索引（思源已删除但向量库残留的索引）
  async cleanOrphanedIndices(skill, { originalDocIds, notebookId }) {
    const siyuanDocIds = new Set(originalDocIds);
    const indexedDocIds = await skill.vectorManager.getIndexedOriginalDocIds(notebookId ? { notebookId } : {});
    const orphanedDocIds = [...indexedDocIds].filter(id => !siyuanDocIds.has(id));

    if (orphanedDocIds.length > 0) {
      console.log(`发现 ${orphanedDocIds.length} 个孤立索引（思源已删除），正在清理...`);
      await skill.vectorManager.deleteDocumentsWithChunks(orphanedDocIds);
      return orphanedDocIds.length;
    }
    return 0;
  },

  // 分区文档
  partitionDocuments(documents, docIdsNeedUpdate) {
    const docsNeedUpdate = [];
    const docsUnchanged = [];
    for (const doc of documents) {
      const originalId = doc.originalDocId || doc.docId;
      if (docIdsNeedUpdate.has(originalId)) {
        docsNeedUpdate.push(doc);
      } else {
        docsUnchanged.push(doc);
      }
    }
    return { docsNeedUpdate, docsUnchanged };
  },

  // 构建返回结果
  buildResult(indexed, skipped, cleaned, batchResult = null) {
    const messages = [];
    if (indexed > 0) messages.push(`成功索引 ${indexed} 个文档`);
    if (cleaned > 0) messages.push(`清理 ${cleaned} 个孤立索引`);
    if (skipped > 0) messages.push(`跳过 ${skipped} 个未变化的文档`);

    const result = {
      success: batchResult ? batchResult.errors.length === 0 : true,
      indexed, skipped, cleaned,
      message: messages.length > 0 ? messages.join('，') : '所有文档已是最新，无需重新索引'
    };

    if (batchResult) {
      result.total = batchResult.total + skipped;
      result.errors = batchResult.errors;
    }
    return result;
  },

  // 通过文档 ID 获取文档
  async fetchDocumentsByIds(skill, docIds) {
    const documents = [];
    const skippedDocIds = [];
    for (const docId of docIds) {
      try {
        const docInfo = await skill.connector.request('/api/block/getBlockInfo', { id: docId });
        if (!docInfo) {
          console.warn(`文档 ${docId} 不存在`);
          continue;
        }
        const result = await this.processDocument(skill, docId, { notebookId: null, updated: docInfo.updated });
        if (result.skipped) {
          skippedDocIds.push(docId);
        } else {
          documents.push(...result.docs);
        }
      } catch (error) {
        console.warn(`获取文档 ${docId} 失败:`, error.message);
      }
    }
    return { documents, skippedDocIds };
  },

  // 通过笔记本 ID 获取文档
  async fetchDocumentsByNotebook(skill, notebookId) {
    const documents = [];
    const skippedDocIds = [];
    try {
      const sqlQuery = `SELECT id, content, path, updated, box FROM blocks WHERE box = '${notebookId}' AND type = 'd'`;
      const blocks = await skill.connector.request('/api/query/sql', { stmt: sqlQuery });

      if (blocks?.length > 0) {
        for (const block of blocks) {
          try {
            const result = await this.processDocument(skill, block.id, { notebookId, updated: block.updated });
            if (result.skipped) {
              skippedDocIds.push(block.id);
            } else {
              documents.push(...result.docs);
            }
          } catch (error) {
            console.warn(`获取文档 ${block.id} 内容失败:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('获取笔记本文档失败:', error.message);
    }
    return { documents, skippedDocIds };
  },

  // 获取所有文档
  async fetchAllDocuments(skill) {
    const documents = [];
    const skippedDocIds = [];
    try {
      const notebooksResponse = await skill.connector.request('/api/notebook/lsNotebooks');
      const notebooks = notebooksResponse?.notebooks || notebooksResponse || [];

      for (const notebook of notebooks) {
        if (skill.checkPermission && !skill.checkPermission(notebook.id)) continue;
        const result = await this.fetchDocumentsByNotebook(skill, notebook.id);
        documents.push(...result.documents);
        skippedDocIds.push(...result.skippedDocIds);
      }
    } catch (error) {
      console.error('获取所有文档失败:', error.message);
    }
    return { documents, skippedDocIds };
  },

  // 处理单个文档：获取内容、标签、路径，根据长度决定是否分块
  async processDocument(skill, docId, options = {}) {
    const { notebookId: defaultNotebookId, updated: defaultUpdated } = options;
    const embeddingConfig = skill.config?.embedding || {};
    const maxContentLength = embeddingConfig.maxContentLength || 1000;
    const skipIndexAttrs = embeddingConfig.skipIndexAttrs || [];

    const content = await skill.connector.request('/api/export/exportMdContent', { id: docId });
    if (!content?.content) return { docs: [], skipped: false };

    const docContent = content.content.trim();
    if (!docContent) {
      console.log(`文档 ${docId} 内容为空，跳过索引`);
      return { docs: [], skipped: false };
    }

    // 获取文档属性（包含 tags 和原始 attrs）
    const docAttrs = await this.fetchDocumentAttrs(skill, docId);
    
    // 检查是否需要跳过索引
    const skipReason = this.shouldSkipIndex(docAttrs, skipIndexAttrs);
    if (skipReason) {
      console.log(`文档 ${docId} 跳过索引: ${skipReason}`);
      return { docs: [], skipped: true };
    }

    const pathInfo = await this.fetchPathInfo(skill, docId);

    const docTitle = content.hPath?.split('/').pop() || docId;
    const docPath = content.hPath || '';
    const notebookId = defaultNotebookId || pathInfo?.notebook || '';
    const docUpdatedTime = defaultUpdated ? defaultUpdated * 1000 : Date.now();

    const metadata = { title: docTitle, path: docPath, notebookId, updated: docUpdatedTime, tags: docAttrs.tags };

    if (docContent.length > maxContentLength) {
      const docs = await this.createChunkedDocuments(skill, docId, docContent, metadata);
      return { docs, skipped: false };
    }
    return { docs: [{ docId, content: docContent, metadata }], skipped: false };
  },

  /**
   * 获取文档属性（包含 tags 和原始 attrs）
   * @param {Object} skill - 技能实例
   * @param {string} docId - 文档 ID
   * @returns {Promise<Object>} { tags: [], _raw: {} }
   */
  async fetchDocumentAttrs(skill, docId) {
    try {
      const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id: docId });
      const result = { tags: [], _raw: {} };
      
      if (attrs) {
        result._raw = attrs;
        if (attrs.tags) {
          result.tags = attrs.tags.split(',').map(t => t.trim()).filter(Boolean);
        }
      }
      
      return result;
    } catch (e) {
      return { tags: [], _raw: {} };
    }
  },

  /**
   * 获取文档标签（兼容旧调用方式）
   * @param {Object} skill - 技能实例
   * @param {string} docId - 文档 ID
   * @returns {Promise<string[]>} 标签数组
   */
  async fetchDocumentTags(skill, docId) {
    const attrs = await this.fetchDocumentAttrs(skill, docId);
    return attrs.tags;
  },

  /**
   * 检查文档是否应该跳过索引
   * @param {Object} attrs - 文档属性 { tags: [], _raw: {} }
   * @param {string[]} skipIndexAttrs - 跳过索引的属性名列表
   * @returns {string|null} 跳过原因，null 表示不跳过
   */
  shouldSkipIndex(attrs, skipIndexAttrs) {
    if (!skipIndexAttrs || skipIndexAttrs.length === 0) return null;
    
    const rawAttrs = attrs._raw || {};
    
    for (const skipAttr of skipIndexAttrs) {
      const value = rawAttrs[skipAttr];
      if (value !== undefined && value !== '' && value !== 'false') {
        return `${skipAttr}=${value}`;
      }
    }
    
    return null;
  },

  async fetchPathInfo(skill, docId) {
    try {
      return await skill.connector.request('/api/filetree/getPathByID', { id: docId });
    } catch (e) {
      return null;
    }
  },

  // 创建分块文档
  async createChunkedDocuments(skill, docId, content, metadata) {
    const chunks = await this.fetchDocumentChunks(skill, docId, content);
    const documents = chunks.map((chunk, index) => ({
      docId: `${docId}_chunk_${index}`,
      originalDocId: docId,
      content: chunk.content,
      chunkIndex: index,
      totalChunks: chunks.length,
      metadata: { ...metadata, isChunk: true, originalDocId: docId }
    }));
    console.log(`文档 ${docId} 已分为 ${chunks.length} 个块进行索引`);
    return documents;
  },

  // 获取文档分块：通过递归获取子块，按配置的分块大小进行分块
  async fetchDocumentChunks(skill, docId, fallbackContent = null) {
    const chunks = [];
    const embeddingConfig = skill?.config?.embedding || {};
    const maxChunkLength = embeddingConfig.maxChunkLength || 800;
    const minChunkLength = embeddingConfig.minChunkLength || 200;

    try {
      const childBlocks = await skill.connector.request('/api/block/getChildBlocks', { id: docId });

      if (!childBlocks?.length) {
        if (fallbackContent) {
          chunks.push({ content: fallbackContent, type: 'full' });
        } else {
          const content = await skill.connector.request('/api/export/exportMdContent', { id: docId });
          if (content?.content) chunks.push({ content: content.content, type: 'full' });
        }
        return chunks;
      }

      let currentChunk = '';
      for (const block of childBlocks) {
        const blockContent = this.formatBlockContent(block);
        if (!blockContent) continue;

        // 子文档块递归处理
        if (block.type === 'd') {
          const subChunks = await this.fetchDocumentChunks(skill, block.id);
          subChunks.forEach(subChunk => chunks.push(subChunk));
          continue;
        }

        if (currentChunk.length + blockContent.length > maxChunkLength && currentChunk.length >= minChunkLength) {
          chunks.push({ content: currentChunk.trim(), type: 'chunk' });
          currentChunk = blockContent;
        } else {
          currentChunk += blockContent;
        }
      }
      if (currentChunk.trim()) chunks.push({ content: currentChunk.trim(), type: 'chunk' });
    } catch (error) {
      console.warn(`获取文档 ${docId} 的分块失败:`, error.message);
      if (fallbackContent) chunks.push({ content: fallbackContent, type: 'full' });
    }
    return chunks;
  },

  // 格式化块内容（根据块类型）
  formatBlockContent(block) {
    const content = block.content || '';
    if (!content.trim()) return '';

    const formatters = {
      'h': () => `${'#'.repeat(block.headingLevel || 1)} ${content}\n\n`,
      'p': () => `${content}\n\n`,
      'l': () => `- ${content}\n`,
      'i': () => `  - ${content}\n`,
      'c': () => `\`\`\`\n${content}\n\`\`\`\n\n`,
      'tb': () => `${content}\n\n`,
      'b': () => `> ${content}\n\n`
    };
    return (formatters[block.type] || (() => `${content}\n\n`))();
  },

  // 移除索引
  async removeIndex(skill, { notebookId, docIds }) {
    try {
      if (docIds?.length > 0) {
        console.log(`移除 ${docIds.length} 个文档的索引...`);
        await skill.vectorManager.deleteDocumentsWithChunks(docIds);
        return { success: true, removed: docIds.length, message: `已移除 ${docIds.length} 个文档的索引` };
      }
      if (notebookId) {
        console.log(`移除笔记本 ${notebookId} 的索引...`);
        await skill.vectorManager.deleteNotebookDocuments(notebookId);
        return { success: true, removed: 'notebook', message: `已移除笔记本 ${notebookId} 的索引` };
      }
      console.log('移除所有索引...');
      await skill.vectorManager.clearCollection();
      return { success: true, removed: 'all', message: '已移除所有索引' };
    } catch (error) {
      console.error('移除索引失败:', error.message);
      return { success: false, error: error.message };
    }
  }
};

module.exports = command;
