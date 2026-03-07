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
  usage: 'index-documents [--notebook <id>] [--doc-ids <ids>] [--force] [--batch-size <size>]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.notebookId - 笔记本 ID（可选，索引指定笔记本）
   * @param {Array} args.docIds - 文档 ID 数组（可选，索引指定文档）
   * @param {boolean} args.force - 是否强制重建索引
   * @param {number} args.batchSize - 批处理大小（默认：10）
   * @returns {Promise<Object>} 执行结果
   */
  async execute(skill, args = {}) {
    const {
      notebookId,
      docIds,
      force = false,
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
      }

      console.log(`开始索引 ${documentsToIndex.length} 个文档...`);

      const result = await skill.vectorManager.indexBatch(documentsToIndex);

      return {
        success: result.success,
        indexed: result.indexed,
        total: result.total,
        errors: result.errors,
        message: `成功索引 ${result.indexed}/${result.total} 个文档`
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
          const maxContentLength = 4000; // embedding模型的上下文限制
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
      const maxChunkLength = 3000; // 每个块的最大长度
      const minChunkLength = 500; // 最小长度，避免过小的块

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
              const maxContentLength = 4000; // embedding模型的上下文限制

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
