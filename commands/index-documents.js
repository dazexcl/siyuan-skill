/**
 * 索引文档命令
 * 将 Siyuan 文档索引到向量数据库
 */

/**
 * 指令配置
 */
const command = {
  name: 'index-documents',
  description: '将文档索引到向量数据库',
  usage: 'index-documents [--notebook <id>] [--doc-ids <ids>] [--force] [--incremental] [--batch-size <size>]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.notebookId - 笔记本 ID（可选，索引指定笔记本）
   * @param {Array} args.docIds - 文档 ID 数组（可选，索引指定文档）
   * @param {boolean} args.force - 是否强制重建索引（清空所有数据）
   * @param {boolean} args.incremental - 是否增量索引（只索引有变化的文档）
   * @param {number} args.batchSize - 批处理大小（默认：10）
   * @returns {Promise<Object>} 执行结果
   */
  async execute(skill, args = {}) {
    const {
      notebookId,
      docIds,
      force = false,
      incremental = true,
      batchSize = 10
    } = args;

    if (!skill.isVectorSearchReady()) {
      await skill.initVectorSearch();
    }

    if (!skill.isVectorSearchReady()) {
      return {
        success: false,
        error: '向量搜索功能不可用，请检查 Qdrant 连接'
      };
    }

    try {
      let documentsToIndex = [];
      let skippedCount = 0;

      if (docIds && Array.isArray(docIds) && docIds.length > 0) {
        documentsToIndex = await this.fetchDocumentsByIds(skill, docIds);
      } else if (notebookId) {
        documentsToIndex = await this.fetchDocumentsByNotebook(skill, notebookId);
      } else {
        documentsToIndex = await this.fetchAllDocuments(skill);
      }

      if (documentsToIndex.length === 0) {
        return {
          success: true,
          indexed: 0,
          message: '没有找到需要索引的文档'
        };
      }

      if (force) {
        console.log('强制重建索引，清空现有数据...');
        await skill.vectorManager.clearCollection();
      } else if (incremental) {
        // 增量索引：只索引有变化的文档
        const originalDocIds = [...new Set(documentsToIndex
          .filter(d => !d.metadata?.isChunk)
          .map(d => d.originalDocId || d.docId))];
        
        if (originalDocIds.length > 0) {
          console.log('增量索引模式：检查文档更新状态...');
          const indexedUpdateTimes = await skill.vectorManager.getIndexedDocumentsUpdateTime(originalDocIds);
          
          // 找出需要更新的原始文档ID
          const originalDocsNeedUpdate = new Set();
          
          for (const docId of originalDocIds) {
            const indexedTime = indexedUpdateTimes.get(docId);
            // 获取该原始文档的最新更新时间
            const doc = documentsToIndex.find(d => (d.originalDocId || d.docId) === docId && !d.metadata?.isChunk);
            const docTime = doc?.metadata?.updated || 0;
            
            // 如果文档未索引或已更新，则需要索引
            if (!indexedTime || docTime > indexedTime) {
              originalDocsNeedUpdate.add(docId);
            }
          }
          
          // 过滤出需要更新的文档（包括分块）
          const docsNeedUpdate = [];
          const docsUnchanged = [];
          
          for (const doc of documentsToIndex) {
            const originalId = doc.originalDocId || doc.docId;
            
            // 如果原始文档需要更新，则包含所有分块
            if (originalDocsNeedUpdate.has(originalId)) {
              docsNeedUpdate.push(doc);
            } else {
              docsUnchanged.push(doc);
            }
          }
          
          skippedCount = docsUnchanged.length;
          documentsToIndex = docsNeedUpdate;
          
          console.log(`发现 ${originalDocsNeedUpdate.size} 个原始文档需要更新，跳过 ${skippedCount} 个未变化的文档/分块`);
        }
      }

      if (documentsToIndex.length === 0) {
        return {
          success: true,
          indexed: 0,
          skipped: skippedCount,
          message: '所有文档已是最新，无需重新索引'
        };
      }

      console.log(`开始索引 ${documentsToIndex.length} 个文档...`);

      const result = await skill.vectorManager.indexBatch(documentsToIndex);

      return {
        success: result.success,
        indexed: result.indexed,
        skipped: skippedCount,
        total: result.total + skippedCount,
        errors: result.errors,
        message: `成功索引 ${result.indexed} 个文档${skippedCount > 0 ? `，跳过 ${skippedCount} 个未变化的文档` : ''}`
      };
    } catch (error) {
      console.error('索引文档失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  /**
   * 根据文档 ID 获取文档（支持分块）
   * @param {Object} skill - 技能实例
   * @param {Array} docIds - 文档 ID 数组
   * @returns {Promise<Array>} 文档数组（包含分块）
   */
  async fetchDocumentsByIds(skill, docIds) {
    const documents = [];

    for (const docId of docIds) {
      try {
        // 获取文档的基本信息
        const docInfo = await skill.connector.request('/api/block/getBlockInfo', { id: docId });
        
        if (!docInfo) {
          console.warn(`文档 ${docId} 不存在`);
          continue;
        }

        // 获取文档的完整内容
        const content = await skill.connector.request('/api/export/exportMdContent', {
          id: docId
        });

        if (content && content.content) {
          let pathInfo = null;
          try {
            pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: docId });
          } catch (e) {
            // 忽略错误
          }

          // 检查内容长度，如果超过限制则使用分块
          // nomic-embed-text 限制 8192 tokens，中文字符可能占用更多 token
          // 安全起见，使用较小的分块大小
          const maxContentLength = 2000;
          const docContent = content.content;

          if (docContent.length > maxContentLength) {
            // 使用思源笔记API获取文档的块列表
            const chunks = await this.fetchDocumentChunks(skill, docId);
            
            // 为每个块创建索引项
            chunks.forEach((chunk, index) => {
              documents.push({
                docId: `${docId}_chunk_${index}`,
                originalDocId: docId,
                content: chunk.content,
                chunkIndex: index,
                totalChunks: chunks.length,
                metadata: {
                  title: content.hPath?.split('/').pop() || docId,
                  path: content.hPath || '',
                  notebookId: pathInfo?.box || '',
                  updated: Date.now(),
                  isChunk: true,
                  originalDocId: docId
                }
              });
            });
            
            console.log(`文档 ${docId} 已分为 ${chunks.length} 个块进行索引`);
          } else {
            // 内容长度在限制内，直接索引
            documents.push({
              docId,
              content: docContent,
              metadata: {
                title: content.hPath?.split('/').pop() || docId,
                path: content.hPath || '',
                notebookId: pathInfo?.box || '',
                updated: Date.now()
              }
            });
          }
        }
      } catch (error) {
        console.warn(`获取文档 ${docId} 失败:`, error.message);
      }
    }

    return documents;
  },

  /**
   * 获取文档的分块内容
   * @param {Object} skill - 技能实例
   * @param {string} docId - 文档 ID
   * @returns {Promise<Array>} 分块数组
   */
  async fetchDocumentChunks(skill, docId) {
    const chunks = [];
    
    try {
      // 获取文档的所有子块
      const childBlocks = await skill.connector.request('/api/block/getChildBlocks', { id: docId });
      
      if (!childBlocks || childBlocks.length === 0) {
        // 如果没有子块，使用文档的完整内容
        const content = await skill.connector.request('/api/export/exportMdContent', { id: docId });
        if (content && content.content) {
          chunks.push({
            content: content.content,
            type: 'full'
          });
        }
        return chunks;
      }

      // 遍历所有子块，收集内容
      let currentChunk = '';
      const maxChunkLength = 1500; // 每个块的最大长度（安全值，避免超出embedding模型限制）
      const minChunkLength = 300; // 最小长度，避免过小的块

      for (const block of childBlocks) {
        // 获取块内容
        let blockContent = '';
        
        if (block.type === 'h') {
          // 标题块
          const level = block.headingLevel || 1;
          const prefix = '#'.repeat(level);
          blockContent = `${prefix} ${block.content || ''}\n\n`;
        } else if (block.type === 'p') {
          // 段落块
          blockContent = `${block.content || ''}\n\n`;
        } else if (block.type === 'l') {
          // 列表块
          blockContent = `- ${block.content || ''}\n`;
        } else if (block.type === 'i') {
          // 列表项
          blockContent = `  - ${block.content || ''}\n`;
        } else if (block.type === 'c') {
          // 代码块
          blockContent = `\`\`\`\n${block.content || ''}\n\`\`\`\n\n`;
        } else if (block.type === 'tb') {
          // 表格块
          blockContent = `${block.content || ''}\n\n`;
        } else if (block.type === 'b') {
          // 引用块
          blockContent = `> ${block.content || ''}\n\n`;
        } else if (block.type === 'd') {
          // 子文档块，递归获取
          const subChunks = await this.fetchDocumentChunks(skill, block.id);
          subChunks.forEach(subChunk => {
            chunks.push(subChunk);
          });
          continue;
        } else {
          // 其他类型的块
          blockContent = `${block.content || ''}\n\n`;
        }

        // 如果块内容为空，跳过
        if (!blockContent.trim()) {
          continue;
        }

        // 检查是否需要创建新的块
        if (currentChunk.length + blockContent.length > maxChunkLength && currentChunk.length >= minChunkLength) {
          chunks.push({
            content: currentChunk.trim(),
            type: 'chunk'
          });
          currentChunk = blockContent;
        } else {
          currentChunk += blockContent;
        }
      }

      // 添加最后一个块
      if (currentChunk.trim().length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          type: 'chunk'
        });
      }

    } catch (error) {
      console.warn(`获取文档 ${docId} 的分块失败:`, error.message);
      // 回退到完整内容
      const content = await skill.connector.request('/api/export/exportMdContent', { id: docId });
      if (content && content.content) {
        chunks.push({
          content: content.content,
          type: 'full'
        });
      }
    }

    return chunks;
  },

  /**
   * 根据笔记本 ID 获取所有文档（支持分块）
   * @param {Object} skill - 技能实例
   * @param {string} notebookId - 笔记本 ID
   * @returns {Promise<Array>}
   */
  async fetchDocumentsByNotebook(skill, notebookId) {
    const documents = [];

    try {
      const sqlQuery = `SELECT id, content, path, updated, box FROM blocks WHERE box = '${notebookId}' AND type = 'd'`;
      const blocks = await skill.connector.request('/api/query/sql', { stmt: sqlQuery });

      if (blocks && Array.isArray(blocks)) {
        for (const block of blocks) {
          try {
            const content = await skill.connector.request('/api/export/exportMdContent', {
              id: block.id
            });

            if (content && content.content) {
              const docContent = content.content;
              const maxContentLength = 2000; // embedding模型的上下文限制（安全值）

              if (docContent.length > maxContentLength) {
                // 使用思源笔记API获取文档的块列表
                const chunks = await this.fetchDocumentChunks(skill, block.id);
                
                // 为每个块创建索引项
                chunks.forEach((chunk, index) => {
                  documents.push({
                    docId: `${block.id}_chunk_${index}`,
                    originalDocId: block.id,
                    content: chunk.content,
                    chunkIndex: index,
                    totalChunks: chunks.length,
                    metadata: {
                      title: block.path?.split('/').pop() || block.id,
                      path: block.path || '',
                      notebookId: block.box || notebookId,
                      updated: block.updated || Date.now(),
                      isChunk: true,
                      originalDocId: block.id
                    }
                  });
                });
                
                console.log(`文档 ${block.id} 已分为 ${chunks.length} 个块进行索引`);
              } else {
                // 内容长度在限制内，直接索引
                documents.push({
                  docId: block.id,
                  content: docContent,
                  metadata: {
                    title: block.path?.split('/').pop() || block.id,
                    path: block.path || '',
                    notebookId: block.box || notebookId,
                    updated: block.updated || Date.now()
                  }
                });
              }
            }
          } catch (error) {
            console.warn(`获取文档 ${block.id} 内容失败:`, error.message);
          }
        }
      }
    } catch (error) {
      console.error('获取笔记本文档失败:', error.message);
    }

    return documents;
  },

  /**
   * 获取所有笔记本的文档
   * @param {Object} skill - 技能实例
   * @returns {Promise<Array>}
   */
  async fetchAllDocuments(skill) {
    const documents = [];

    try {
      const notebooks = await skill.connector.request('/api/notebook/lsNotebooks');
      
      if (notebooks && Array.isArray(notebooks)) {
        for (const notebook of notebooks) {
          if (skill.checkPermission && !skill.checkPermission(notebook.id)) {
            continue;
          }

          const notebookDocs = await this.fetchDocumentsByNotebook(skill, notebook.id);
          documents.push(...notebookDocs);
        }
      }
    } catch (error) {
      console.error('获取所有文档失败:', error.message);
    }

    return documents;
  }
};

module.exports = command;
