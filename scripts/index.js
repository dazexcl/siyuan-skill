#!/usr/bin/env node
/**
 * index.js - 索引文档到向量数据库
 *
 * 将 Siyuan Notes 文档分块并索引到 Qdrant 向量数据库
 * 支持增量索引和强制重建索引
 */
const SiyuanConnector = require('./lib/connector');
const EmbeddingManager = require('./lib/embedding-manager');
const VectorManager = require('./lib/vector-manager');
const { checkPermission } = require('./lib/permission');
const ConcurrentQueue = require('./lib/concurrent-queue');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: index [<id>] [选项]

将 Siyuan Notes 文档索引到向量数据库

参数:
  <id>                  位置参数：笔记本ID或文档ID（自动识别）

选项:
  --notebook <id>       指定笔记本 ID
  --doc-ids <ids>       指定文档 ID 列表（逗号分隔）
  --force               强制重建索引
  --remove              只移除索引，不重新索引
  --quiet               静默模式，不输出进度信息
  -h, --help            显示帮助信息

示例:
  # 增量索引所有笔记本
  index

  # 增量索引指定笔记本
  index --notebook <notebook-id>

  # 传入笔记本ID（位置参数）
  index <notebook-id>

  # 传入文档ID（位置参数）
  index <doc-id>

  # 索引指定文档
  index --doc-ids "doc-id-1,doc-id-2"

  # 强制重建索引
  index --force
  index --notebook <notebook-id> --force

  # 移除索引
  index --remove
  index --notebook <notebook-id> --remove
  index --doc-ids "doc-id-1,doc-id-2" --remove`;

/**
 * 索引统计信息
 */
class IndexStats {
  constructor() {
    this.totalDocs = 0;
    this.processedDocs = 0;
    this.indexedDocs = 0;
    this.indexedChunks = 0;
    this.failedDocs = 0;
    this.errors = [];
  }

  /**
   * 记录错误
   * @param {string} docId - 文档ID
   * @param {string} error - 错误信息
   */
  addError(docId, error) {
    this.failedDocs++;
    this.errors.push({ docId, error });
  }

  /**
   * 记录成功的索引
   * @param {number} chunkCount - 成功索引的分块数
   */
  addIndexed(chunkCount = 1) {
    this.indexedDocs++;
    this.indexedChunks += chunkCount;
  }

  /**
   * 跳过文档
   */
  skipDoc() {
    this.processedDocs++;
  }
}

/**
 * 处理单个文档的索引
 * @param {Object} doc - 文档对象
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {EmbeddingManager} embeddingManager - 嵌入管理器
 * @param {VectorManager} vectorManager - 向量管理器
 * @param {Object} config - 配置对象
 * @returns {Promise<Object>} { vectors: [], skipped: boolean, docId, docName, docLength, chunkCount }
 */
async function indexDocument(doc, connector, embeddingManager, vectorManager, config) {
  try {
    const result = {
      vectors: [],
      skipped: false,
      docId: doc.id,
      originalDocId: doc.id,
      docName: doc.name,
      docLength: 0,
      chunkCount: 0
    };

    // 优化：一次性获取配置，避免重复访问 config?.embedding
    const embeddingConfig = config?.embedding || {};
    const maxContentLength = embeddingConfig.maxContentLength;
    const skipIndexAttrs = embeddingConfig.skipIndexAttrs || [];

    // 获取文档属性（包含 tags 和原始 attrs）
    const docAttrs = await fetchDocumentAttrs(connector, doc.id);
    
    // 检查是否需要跳过索引
    const skipReason = shouldSkipIndex(docAttrs, skipIndexAttrs);
    if (skipReason) {
      result.skipped = true;
      return result;
    }

    // 获取文档内容
    const content = await connector.request('/api/export/exportMdContent', { id: doc.id });
    if (!content?.content) {
      throw new Error('无法获取文档内容');
    }

    const docContent = content.content.trim();
    if (!docContent) {
      result.skipped = true;
      return result;
    }

    const pathInfo = await fetchPathInfo(connector, doc.id);
    const notebookId = doc.box || pathInfo?.box || pathInfo?.notebook || '';
    const docTitle = content.hPath?.split('/').pop() || doc.id;
    const docPath = content.hPath || '';
    const docUpdatedTime = doc.updated ? doc.updated * 1000 : Date.now();

    const metadata = { 
      title: docTitle, 
      path: docPath, 
      notebookId: notebookId,
      updated: docUpdatedTime, 
      tags: docAttrs.tags 
    };

    if (docContent.length > maxContentLength) {
      const chunks = await fetchDocumentChunks(connector, doc.id, docContent, config);
      result.docLength = docContent.length;
      result.chunkCount = chunks.length;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await embeddingManager.generateEmbedding(chunk);

        if (embedding) {
          const vectorData = createVectorData(`${doc.id}_chunk_${i}`, chunk, {
            ...metadata,
            id: `${doc.id}_chunk_${i}`,
            block_id: doc.id,
            chunk_index: i,
            total_chunks: chunks.length,
            is_chunk: true
          });
          result.vectors.push(vectorData);
        }
      }
    } else {
      result.docLength = docContent.length;
      result.chunkCount = 1;
      const embedding = await embeddingManager.generateEmbedding(docContent);
      if (embedding) {
        const vectorData = createVectorData(doc.id, docContent, {
          ...metadata,
          id: doc.id,
          block_id: doc.id
        });
        result.vectors.push(vectorData);
      }
    }

    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * 获取文档属性（包含 tags 和原始 attrs）
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {string} docId - 文档 ID
 * @returns {Promise<Object>} { tags: [], _raw: {} }
 */
async function fetchDocumentAttrs(connector, docId) {
  try {
    const attrs = await connector.request('/api/attr/getBlockAttrs', { id: docId });
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
}

/**
 * 获取路径信息
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {string} docId - 文档 ID
 * @returns {Promise<Object>} 路径信息
 */
async function fetchPathInfo(connector, docId) {
  try {
    return await connector.request('/api/filetree/getPathByID', { id: docId });
  } catch (e) {
    return null;
  }
}

/**
 * 轻量级检查文档是否需要索引
 * @param {Object} doc - 文档对象
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {Object} config - 配置对象
 * @returns {Promise<Object>} { needsIndex: boolean, docInfo: Object }
 */
async function checkDocumentNeedsIndex(doc, connector, config) {
  try {
    const embeddingConfig = config?.embedding || {};
    const maxContentLength = embeddingConfig.maxContentLength;

    const content = await connector.request('/api/export/exportMdContent', { id: doc.id });
    if (!content?.content) {
      return { needsIndex: false, docInfo: { ...doc, length: 0, chunks: 0, skip: true, skipReason: '无法获取文档内容' } };
    }

    const docContent = content.content.trim();
    if (!docContent) {
      return { needsIndex: false, docInfo: { ...doc, length: 0, chunks: 0, skip: true, skipReason: '文档内容为空' } };
    }

    const docInfo = {
      ...doc,
      length: docContent.length,
      chunks: docContent.length > maxContentLength ? 0 : 1,
      updated: doc.updated ? doc.updated * 1000 : Date.now(),
      skip: false
    };

    const pathInfo = await fetchPathInfo(connector, doc.id);
    const notebookId = doc.box || pathInfo?.box || pathInfo?.notebook || '';
    docInfo.notebookId = notebookId;
    docInfo.box = notebookId;

    return { needsIndex: true, docInfo };
  } catch (error) {
    return { needsIndex: false, docInfo: { ...doc, length: 0, chunks: 0, skip: true, skipReason: error.message } };
  }
}

/**
 * 检查文档是否应该跳过索引
 * @param {Object} attrs - 文档属性 { tags: [], _raw: {} }
 * @param {string[]} skipIndexAttrs - 跳过索引的属性名列表
 * @returns {string|null} 跳过原因，null 表示不跳过
 */
function shouldSkipIndex(attrs, skipIndexAttrs) {
  if (!skipIndexAttrs || skipIndexAttrs.length === 0) return null;
  
  const rawAttrs = attrs._raw || {};
  
  for (const skipAttr of skipIndexAttrs) {
    const value = rawAttrs[skipAttr];
    if (value !== undefined && value !== '' && value !== 'false') {
      return `${skipAttr}=${value}`;
    }
  }
  
  return null;
}

/**
 * 获取文档分块
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {string} docId - 文档 ID
 * @param {string} fallbackContent - 回退内容
 * @param {Object} config - 配置对象
 * @returns {Promise<string[]>} 分块内容数组
 */
async function fetchDocumentChunks(connector, docId, fallbackContent = null, config = {}, depth = 0) {
  const chunks = [];
  const embeddingConfig = config?.embedding || {};
  const maxChunkLength = embeddingConfig.maxChunkLength;
  const minChunkLength = embeddingConfig.minChunkLength;
  const maxDepth = embeddingConfig.maxDepth;

  // 防止无限递归
  if (depth > maxDepth) {
    console.warn(`文档 ${docId} 超过最大递归深度 ${maxDepth}`);
    if (fallbackContent) chunks.push(fallbackContent);
    return chunks;
  }

  try {
    const childBlocks = await connector.request('/api/block/getChildBlocks', { id: docId });

    if (!childBlocks?.length) {
      if (fallbackContent) {
        chunks.push(fallbackContent);
      }
      return chunks;
    }

    let currentChunk = '';
    for (const block of childBlocks) {
      const blockContent = formatBlockContent(block);
      if (!blockContent) continue;

      // 子文档块递归处理
      if (block.type === 'd') {
        const subChunks = await fetchDocumentChunks(connector, block.id, null, config, depth + 1);
        subChunks.forEach(subChunk => chunks.push(subChunk));
        continue;
      }

      if (currentChunk.length + blockContent.length > maxChunkLength && currentChunk.length >= minChunkLength) {
        chunks.push(currentChunk.trim());
        currentChunk = blockContent;
      } else {
        currentChunk += blockContent;
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());
  } catch (error) {
    console.warn(`获取文档 ${docId} 的分块失败:`, error.message);
    if (fallbackContent) chunks.push(fallbackContent);
  }
  return chunks;
}

/**
 * 生成向量数据
 * @param {string} docId - 文档ID
 * @param {string} content - 内容
 * @param {Object} metadata - 元数据
 * @returns {Object} 向量数据
 */
function createVectorData(docId, content, metadata) {
  const contentPreview = content.length > 200 ? content.substring(0, 200) + '...' : content;
  return {
    docId,
    content,
    metadata: {
      ...metadata,
      content_preview: contentPreview
    }
  };
}

/**
 * 格式化块内容
 * @param {Object} block - 块对象
 * @returns {string} 格式化后的内容
 */
function formatBlockContent(block) {
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
}

/**
 * 递归获取笔记本中的所有文档
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {string} notebookId - 笔记本ID
 * @returns {Promise<Array>} 文档列表
 */
async function getAllDocs(connector, notebookId) {
  const docs = [];
  
  try {
    const sqlQuery = `SELECT id, content, path, updated, box FROM blocks WHERE box = '${notebookId}' AND type = 'd'`;
    const blocks = await connector.request('/api/query/sql', { stmt: sqlQuery });

    if (blocks?.length > 0) {
      for (const block of blocks) {
        docs.push({
          id: block.id,
          name: block.content || block.id,
          box: notebookId,
          path: block.path || '',
          updated: block.updated
        });
      }
    }
  } catch (error) {
    console.error(`获取笔记本文档失败 (${notebookId}):`, error.message);
  }

  return docs;
}

/**
 * 通过文档ID获取文档列表
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {string[]} docIds - 文档ID列表
 * @param {Object} config - 配置对象（用于白名单检查）
 * @returns {Promise<Object>} { docs: Array, invalidDocIds: Array }
 */
async function getDocsByIds(connector, docIds, config = null) {
  const docs = [];
  const invalidDocIds = [];
  
  for (const docId of docIds) {
    try {
      const docInfo = await connector.request('/api/block/getBlockInfo', { id: docId });
      if (docInfo) {
        let notebookId = docInfo.box || '';
        if (!notebookId) {
          try {
            const pathInfo = await connector.request('/api/filetree/getPathByID', { id: docId });
            notebookId = pathInfo?.box || pathInfo?.notebook || '';
          } catch (e) {
            // 忽略错误，使用空字符串
          }
        }
        
        const doc = {
          id: docId,
          name: docInfo.rootTitle || docId,
          box: notebookId,
          path: docInfo.path || '',
          updated: docInfo.updated
        };
        
        if (config && notebookId) {
          try {
            checkPermission(config, notebookId);
            docs.push(doc);
          } catch (e) {
            // 跳过不在白名单中的文档，不输出
          }
        } else {
          docs.push(doc);
        }
      } else {
        invalidDocIds.push(docId);
      }
    } catch (error) {
      invalidDocIds.push(docId);
    }
  }
  
  return { docs, invalidDocIds };
}

/**
 * 强制重建：删除现有索引
 * @param {VectorManager} vectorManager - 向量管理器
 * @param {Object} params - 参数对象
 */
async function deleteExistingIndices(vectorManager, params) {
  const { docIds, notebookId } = params;
  
  if (docIds?.length > 0) {
    console.log(`强制重建索引，删除 ${docIds.length} 个指定文档的现有索引...`);
    await vectorManager.deleteDocumentsWithChunks(docIds);
  } else if (notebookId) {
    console.log(`强制重建索引，删除笔记本 ${notebookId} 的现有索引...`);
    await vectorManager.deleteNotebookDocuments(notebookId);
  } else {
    console.log('强制重建索引，清空现有数据...');
    await vectorManager.clearCollection();
  }
}

/**
 * 清理孤立索引
 * @param {VectorManager} vectorManager - 向量管理器
 * @param {Set} siyuanDocIds - 思源笔记中的文档ID集合
 * @param {string} notebookId - 笔记本ID（可选）
 * @returns {Promise<number>} 清理的数量
 */
async function cleanOrphanedIndices(vectorManager, siyuanDocIds, notebookId = null) {
  const indexedDocIds = await vectorManager.getIndexedOriginalDocIds(notebookId ? { notebookId } : {});
  const orphanedDocIds = [...indexedDocIds].filter(id => !siyuanDocIds.has(id));

  if (orphanedDocIds.length > 0) {
    console.log(`发现 ${orphanedDocIds.length} 个孤立索引（思源已删除），正在清理...`);
    await vectorManager.deleteDocumentsWithChunks(orphanedDocIds);
    return orphanedDocIds.length;
  }
  return 0;
}

/**
 * 移除索引
 * @param {VectorManager} vectorManager - 向量管理器
 * @param {Object} params - 参数对象
 * @returns {Promise<Object>} 移除结果
 */
async function removeIndex(vectorManager, params) {
  const { docIds, notebookId } = params;
  
  try {
    if (docIds?.length > 0) {
      console.log(`移除 ${docIds.length} 个文档的索引...`);
      await vectorManager.deleteDocumentsWithChunks(docIds);
      return { success: true, removed: docIds.length, message: `已移除 ${docIds.length} 个文档的索引` };
    }
    if (notebookId) {
      console.log(`移除笔记本 ${notebookId} 的索引...`);
      await vectorManager.deleteNotebookDocuments(notebookId);
      return { success: true, removed: 'notebook', message: `已移除笔记本 ${notebookId} 的索引` };
    }
    console.log('移除所有索引...');
    await vectorManager.clearCollection();
    return { success: true, removed: 'all', message: '已移除所有索引' };
  } catch (error) {
    console.error('移除索引失败:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 主函数 - 执行文档索引
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['notebook', 'doc-ids'],
    flagOpts: ['quiet']
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  
  // 将位置参数合并到 options
  if (positionalArgs.length > 0) {
    options.id = positionalArgs[0];
  }
  const params = options;
  
  // 兼容性处理：支持 kebab-case 和 camelCase 两种格式
  if (params['doc-ids'] && !params.docIds) {
    params.docIds = params['doc-ids'];
  }
  const stats = new IndexStats();
  const quiet = params.quiet;

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    // 检查向量搜索配置是否完整
    if (!config.qdrant || !config.qdrant.url) {
      console.log(JSON.stringify({
        success: false,
        message: 'Qdrant 未配置。请在 config.json 中配置 qdrant.url'
      }, null, 2));
      process.exit(1);
    }

    if (!config.embedding || !config.embedding.baseUrl) {
      console.log(JSON.stringify({
        success: false,
        message: 'Embedding 服务未配置。请在 config.json 中配置 embedding.baseUrl'
      }, null, 2));
      process.exit(1);
    }

    const embeddingManager = new EmbeddingManager(config.embedding);
    const vectorManager = new VectorManager(config, embeddingManager);

    // 初始化 Embedding Manager
    if (!quiet) console.error('正在初始化嵌入服务...');
    const embeddingInitResult = await embeddingManager.initialize();
    if (!embeddingInitResult) {
      console.log(JSON.stringify({
        success: false,
        message: '初始化嵌入服务失败，请检查 Ollama 服务'
      }, null, 2));
      process.exit(1);
    }

    // 确保集合存在
    if (!quiet) console.error('正在初始化向量数据库...');
    const collectionResult = await vectorManager.ensureCollection();
    if (!collectionResult.success) {
      console.log(JSON.stringify({
        success: false,
        message: `初始化向量数据库失败: ${collectionResult.message}`
      }, null, 2));
      process.exit(1);
    }
    if (!quiet) console.error(collectionResult.message);

    // 处理位置参数
    if (params.id) {
      // 尝试识别是笔记本ID还是文档ID
      const notebooks = await connector.request('/api/notebook/lsNotebooks');
      const notebookList = notebooks.notebooks || [];
      const isNotebook = notebookList.some(n => n.id === params.id);

      if (isNotebook) {
        params.notebook = params.id;
      } else {
        params.docIds = params.id.split(',');
      }
      delete params.id;
    }

    // 处理 doc-ids 参数
    if (params.docIds) {
      if (typeof params.docIds === 'string') {
        params.docIds = params.docIds.split(',').map(id => id.trim());
      }
      
      // 验证文档ID格式
      const invalidIds = params.docIds.filter(id => {
        // 思源笔记的ID格式通常是: YYYYMMDDHHmmss-xxxxxx
        return !/^\d{14}-[a-z0-9]{6,}$/.test(id);
      });
      
      if (invalidIds.length > 0) {
        console.log(JSON.stringify({
          success: false,
          message: `错误: 无效的文档ID格式: ${invalidIds.join(', ')}`,
          invalidIds
        }, null, 2));
        process.exit(1);
      }
      
      console.error(`处理 ${params.docIds.length} 个指定文档...`);
    }

    // 移除索引模式
    if (params.remove) {
      const result = await removeIndex(vectorManager, params);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    // 获取文档列表（只处理白名单笔记本）
    let docs = [];
    let invalidDocIds = [];
    
    if (params.docIds && params.docIds.length > 0) {
      const result = await getDocsByIds(connector, params.docIds, config);
      docs = result.docs;
      invalidDocIds = result.invalidDocIds;
      
      // 如果所有文档ID都无效，返回错误
      if (docs.length === 0 && invalidDocIds.length > 0) {
        console.log(JSON.stringify({
          success: false,
          message: `错误: 所有文档ID均无效或不存在: ${invalidDocIds.join(', ')}`,
          invalidDocIds
        }, null, 2));
        process.exit(1);
      }
    } else if (params.notebook) {
      // 检查笔记本权限
      try {
        checkPermission(config, params.notebook);
        docs = await getAllDocs(connector, params.notebook);
      } catch (e) {
        console.log(JSON.stringify({
          success: false,
          message: `笔记本 ${params.notebook} 不在白名单中或无权限`
        }, null, 2));
        process.exit(1);
      }
    } else {
      // 获取所有笔记本并过滤白名单
      const notebooks = await connector.request('/api/notebook/lsNotebooks');
      const notebookList = notebooks.notebooks || [];
      
      for (const notebook of notebookList) {
        try {
          checkPermission(config, notebook.id);
          const notebookDocs = await getAllDocs(connector, notebook.id);
          docs.push(...notebookDocs);
        } catch (e) {
          // 跳过不在白名单中的笔记本，不输出
        }
      }
    }

    if (docs.length === 0) {
      console.log(JSON.stringify({
        success: true,
        indexed: 0,
        skipped: 0,
        cleaned: 0,
        message: '没有找到需要索引的文档'
      }, null, 2));
      process.exit(0);
    }

    stats.totalDocs = docs.length;
    if (!quiet) console.error(`发现 ${docs.length} 个文档`);

    // 强制重建：先删除现有索引
    if (params.force) {
      await deleteExistingIndices(vectorManager, params);
    }

    // 增量索引：先检查哪些文档需要更新
    let docsToProcess = [];
    let skippedCount = 0;
    let cleanedCount = 0;

    if (!params.force) {
      if (!quiet) console.error('检查文档更新状态...');

      const allDocInfos = await Promise.all(
        docs.map(doc => checkDocumentNeedsIndex(doc, connector, config))
      );

      const docIds = allDocInfos.filter(d => d.needsIndex).map(d => d.docInfo.id);
      const indexedUpdateTimes = await vectorManager.getIndexedDocumentsUpdateTime(docIds);

      for (const { needsIndex, docInfo } of allDocInfos) {
        if (!needsIndex || docInfo.skip) {
          skippedCount++;
          continue;
        }

        const indexedTime = indexedUpdateTimes.get(docInfo.id) || 0;
        if (docInfo.updated > indexedTime) {
          docsToProcess.push(docInfo);
        } else {
          skippedCount++;
        }
      }

      if (!quiet) console.error(`发现 ${docsToProcess.length} 个文档需要更新，跳过 ${skippedCount} 个未变化文档`);

      const siyuanDocIds = new Set(docs.map(d => d.id));
      cleanedCount = await cleanOrphanedIndices(vectorManager, siyuanDocIds, params.notebook || null);

      if (docsToProcess.length === 0) {
        console.log(JSON.stringify({
          success: true,
          indexed: 0,
          skipped: skippedCount,
          cleaned: 0,
          message: '所有文档已是最新，无需重新索引'
        }, null, 2));
        process.exit(0);
      }
    } else {
      docsToProcess = docs;
    }

    // 创建索引队列，并发数由配置控制
    const indexConcurrency = config.embedding?.indexConcurrency || 2;
    const indexQueue = new ConcurrentQueue(indexConcurrency);
    let indexedCount = 0;
    const indexErrors = [];
    const totalDocs = docsToProcess.length;
    let processedDocs = 0;

    // 处理文档并立即将索引任务加入队列
    for (let i = 0; i < docsToProcess.length; i++) {
      const doc = docsToProcess[i];

      try {
        const result = await indexDocument(doc, connector, embeddingManager, vectorManager, config);
        processedDocs++;

        const length = result.docLength || 0;
        const chunks = result.chunkCount || 1;
        if (!quiet) console.error(`${doc.name} (${processedDocs}/${totalDocs}) - ${length}字符/${chunks}块`);

        if (result.vectors.length > 0) {
          indexQueue.add(async () => {
            try {
              const batchResult = await vectorManager.indexBatch(result.vectors);
              if (batchResult.success) {
                const indexed = batchResult.indexed || result.vectors.length;
                indexedCount += indexed;
                stats.addIndexed(indexed);
              } else {
                indexErrors.push({
                  doc: doc.name,
                  message: batchResult.message || '索引失败'
                });
                stats.addError(doc.id, batchResult.message || '索引失败');
              }
            } catch (error) {
              indexErrors.push({
                doc: doc.name,
                message: error.message
              });
              stats.addError(doc.id, error.message);
            }
          });
        } else if (!result.skipped) {
          stats.skipDoc();
        }
      } catch (error) {
        processedDocs++;
        stats.addError(doc.id, error.message);
        indexErrors.push({
          doc: doc.name,
          message: error.message
        });
        if (!quiet) console.error(`${doc.name} (${processedDocs}/${totalDocs}) - 处理失败: ${error.message}`);
      }
    }
    if (!quiet) console.error('文档处理完成，等待索引队列...');

    await indexQueue.waitForAll();

    const messages = [];
    if (stats.indexedDocs > 0) messages.push(`成功索引 ${stats.indexedDocs} 个文档 (${stats.indexedChunks} 个向量)`);
    if (cleanedCount > 0) messages.push(`清理 ${cleanedCount} 个孤立索引`);
    if (skippedCount > 0) messages.push(`跳过 ${skippedCount} 个未变化的文档`);
    if (stats.failedDocs > 0) messages.push(`${stats.failedDocs} 个文档处理失败`);

    console.log(JSON.stringify({
      success: indexErrors.length === 0,
      indexedDocs: stats.indexedDocs,
      indexedChunks: stats.indexedChunks,
      skipped: skippedCount,
      cleaned: cleanedCount,
      failed: stats.failedDocs,
      total: stats.indexedDocs + skippedCount + stats.failedDocs,
      errors: indexErrors.length > 0 ? indexErrors : undefined,
      message: messages.length > 0 ? messages.join('，') : '索引完成'
    }, null, 2));

    process.exit(indexErrors.length === 0 ? 0 : 1);
  } catch (error) {
    console.error('执行失败:', error.message);
    console.log(JSON.stringify({
      success: false,
      message: `索引失败: ${error.message}`,
      data: {
        totalDocs: stats.totalDocs,
        indexedDocs: stats.indexedDocs,
        indexedChunks: stats.indexedChunks,
        failedDocs: stats.failedDocs
      }
    }, null, 2));
    process.exit(1);
  }
}

main();
