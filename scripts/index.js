#!/usr/bin/env node
/**
 * index.js - 索引文档到向量数据库
 *
 * 将 Siyuan Notes 文档分块并索引到 Qdrant 向量数据库
 * 支持增量索引和强制重建索引
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const EmbeddingManager = require('./lib/embedding-manager');
const VectorManager = require('./lib/vector-manager');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: index [<id>] [选项]

将 Siyuan Notes 文档索引到向量数据库

参数:
  <id>                  位置参数：笔记本ID或文档ID（自动识别）

选项:
  --notebook <id>       指定笔记本 ID
  --doc-ids <ids>       指定文档 ID 列表（逗号分隔）
  --force               强制重建索引
  --remove              只移除索引，不重新索引
  --batch-size <size>   批处理大小（默认：5）
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
 * 将连字符命名转换为驼峰命名
 * @param {string} str - 输入字符串
 * @returns {string} 驼峰命名字符串
 */
function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 解析命令行参数
 * @param {string[]} argv - 命令行参数数组
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(argv) {
  const options = {};
  const hasValueOpts = new Set(['notebook', 'docIds', 'batchSize']);
  const positionalArgs = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > -1) {
        options[camelCase(arg.slice(2, eqIndex))] = arg.slice(eqIndex + 1);
      } else {
        const key = camelCase(arg.slice(2));
        if (hasValueOpts.has(key) && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          options[key] = argv[++i];
        } else {
          options[key] = true;
        }
      }
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }

  if (positionalArgs.length > 0) {
    options.id = positionalArgs[0];
  }

  return options;
}

/**
 * 索引统计信息
 */
class IndexStats {
  constructor() {
    this.totalDocs = 0;
    this.indexedDocs = 0;
    this.totalChunks = 0;
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
}

/**
 * 处理单个文档的索引
 * @param {Object} doc - 文档对象
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {EmbeddingManager} embeddingManager - 嵌入管理器
 * @param {VectorManager} vectorManager - 向量管理器
 * @param {Object} config - 配置对象
 * @param {IndexStats} stats - 统计对象
 * @returns {Promise<Object>} { vectors: [], skipped: boolean }
 */
async function indexDocument(doc, connector, embeddingManager, vectorManager, config, stats) {
  try {
    const result = {
      vectors: [],
      skipped: false,
      docId: doc.id,
      originalDocId: doc.id
    };

    const embeddingConfig = config?.embedding || {};
    const maxContentLength = embeddingConfig.maxContentLength || 1000;
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
      stats.addError(doc.id, '无法获取文档内容');
      return result;
    }

    const docContent = content.content.trim();
    if (!docContent) {
      result.skipped = true;
      return result;
    }

    const pathInfo = await fetchPathInfo(connector, doc.id);
    const docTitle = content.hPath?.split('/').pop() || doc.id;
    const docPath = content.hPath || '';
    const notebookId = doc.box || pathInfo?.notebook || '';
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
      stats.totalChunks += chunks.length;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await embeddingManager.generateEmbedding(chunk);

        if (embedding) {
          const contentPreview = chunk.length > 200 ? chunk.substring(0, 200) + '...' : chunk;

          result.vectors.push({
            docId: `${doc.id}_chunk_${i}`,
            content: chunk,
            metadata: {
              ...metadata,
              block_id: `${doc.id}_chunk_${i}`,
              content_preview: contentPreview,
              chunk_index: i,
              total_chunks: chunks.length,
              original_doc_id: doc.id,
              is_chunk: true
            }
          });
          stats.indexedChunks++;
        }
      }
    } else {
      const embedding = await embeddingManager.generateEmbedding(docContent);
      if (embedding) {
        const contentPreview = docContent.length > 200 ? docContent.substring(0, 200) + '...' : docContent;

        result.vectors.push({
          docId: doc.id,
          content: docContent,
          metadata: {
            ...metadata,
            block_id: doc.id,
            content_preview: contentPreview
          }
        });
        stats.indexedChunks++;
      }
    }

    stats.indexedDocs++;
    return result;
  } catch (error) {
    stats.addError(doc.id, error.message);
    return { vectors: [], skipped: false, docId: doc.id, originalDocId: doc.id };
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
async function fetchDocumentChunks(connector, docId, fallbackContent = null, config = {}) {
  const chunks = [];
  const embeddingConfig = config?.embedding || {};
  const maxChunkLength = embeddingConfig.maxChunkLength || 800;
  const minChunkLength = embeddingConfig.minChunkLength || 200;

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
        const subChunks = await fetchDocumentChunks(connector, block.id, null, config);
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
 * @returns {Promise<Array>} 文档列表
 */
async function getDocsByIds(connector, docIds) {
  const docs = [];
  for (const docId of docIds) {
    try {
      const docInfo = await connector.request('/api/block/getBlockInfo', { id: docId });
      if (docInfo) {
        docs.push({
          id: docId,
          name: docInfo.rootTitle || docId,
          box: docInfo.box || '',
          path: docInfo.path || '',
          updated: docInfo.updated
        });
      }
    } catch (error) {
      console.warn(`获取文档 ${docId} 失败:`, error.message);
    }
  }
  return docs;
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
 * 增量索引：清理孤立索引 + 检查更新 + 清理跳过文档的索引
 * @param {Object} params - 参数对象
 * @param {Array} documentResults - 文档索引结果列表
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {VectorManager} vectorManager - 向量管理器
 * @returns {Promise<Object>} { skippedCount, cleanedCount, docsNeedIndex }
 */
async function processIncrementalIndex(params, documentResults, connector, vectorManager) {
  const { notebookId } = params;
  let skippedCount = 0;
  let cleanedCount = 0;

  console.log('增量索引模式：检查文档更新状态...');

  // 跳过索引的文档
  const skippedDocIds = documentResults
    .filter(r => r.skipped)
    .map(r => r.docId);
  const skippedDocIdSet = new Set(skippedDocIds);

  // 清理跳过索引文档的旧索引
  if (skippedDocIds.length > 0) {
    console.log(`清理 ${skippedDocIds.length} 个跳过索引文档的旧索引...`);
    await vectorManager.deleteDocumentsWithChunks(skippedDocIds);
    cleanedCount += skippedDocIds.length;
  }

  // 获取需要索引的文档（未跳过的）
  const docsToIndex = documentResults.filter(r => !r.skipped);
  const originalDocIds = new Set(docsToIndex.map(d => d.originalDocId || d.docId));

  if (originalDocIds.size === 0) {
    return { skippedCount, cleanedCount, docsNeedIndex: [] };
  }

  // 清理孤立索引（只在索引笔记本或全部文档时执行）
  if (!params.docIds || params.docIds.length === 0) {
    const orphanedCount = await cleanOrphanedIndices(vectorManager, originalDocIds, notebookId);
    cleanedCount += orphanedCount;
  }

  // 获取已索引文档的更新时间，找出需要更新的文档
  const indexedUpdateTimes = await vectorManager.getIndexedDocumentsUpdateTime(Array.from(originalDocIds));
  const originalDocsNeedUpdate = new Set();

  for (const docId of originalDocIds) {
    const indexedTime = indexedUpdateTimes.get(docId);
    const docResult = docsToIndex.find(d => (d.originalDocId || d.docId) === docId && d.vectors.length > 0);
    const docTime = docResult?.vectors[0]?.metadata?.updated || 0;
    if (!indexedTime || docTime > indexedTime) {
      originalDocsNeedUpdate.add(docId);
    }
  }

  // 删除需要更新的文档的旧索引（包括分块）
  if (originalDocsNeedUpdate.size > 0) {
    console.log(`删除 ${originalDocsNeedUpdate.size} 个已更新文档的旧索引（含分块）...`);
    await vectorManager.deleteDocumentsWithChunks(Array.from(originalDocsNeedUpdate));
  }

  // 分区：需要更新的文档 vs 未变化的文档
  const docsNeedIndex = [];
  for (const docResult of docsToIndex) {
    const originalId = docResult.originalDocId || docResult.docId;
    if (originalDocsNeedUpdate.has(originalId)) {
      docsNeedIndex.push(docResult);
    } else {
      skippedCount += docResult.vectors.length;
    }
  }

  console.log(`发现 ${originalDocsNeedUpdate.size} 个原始文档需要更新，跳过 ${skippedCount} 个未变化的文档/分块`);

  return { skippedCount, cleanedCount, docsNeedIndex };
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
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const params = parseArgs(args);
  const stats = new IndexStats();

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

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

    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    const embeddingManager = new EmbeddingManager(config.embedding);
    const vectorManager = new VectorManager(config, embeddingManager);

    // 初始化 Embedding Manager
    console.error('正在初始化嵌入服务...');
    const embeddingInitResult = await embeddingManager.initialize();
    if (!embeddingInitResult) {
      console.log(JSON.stringify({
        success: false,
        message: '初始化嵌入服务失败，请检查 Ollama 服务'
      }, null, 2));
      process.exit(1);
    }

    // 确保集合存在
    console.error('正在初始化向量数据库...');
    const collectionResult = await vectorManager.ensureCollection();
    if (!collectionResult.success) {
      console.log(JSON.stringify({
        success: false,
        message: `初始化向量数据库失败: ${collectionResult.message}`
      }, null, 2));
      process.exit(1);
    }
    console.error(collectionResult.message);

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
    }

    // 移除索引模式
    if (params.remove) {
      const result = await removeIndex(vectorManager, params);
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    // 获取文档列表（只处理白名单笔记本）
    let docs = [];
    if (params.docIds && params.docIds.length > 0) {
      docs = await getDocsByIds(connector, params.docIds);
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
          console.log(`跳过笔记本 ${notebook.name} (${notebook.id}): 不在白名单中`);
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
    console.error(`发现 ${docs.length} 个文档`);

    // 强制重建：先删除现有索引
    if (params.force) {
      await deleteExistingIndices(vectorManager, params);
    }

    // 处理所有文档
    const documentResults = [];
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];

      if ((i + 1) % 10 === 0 || i === docs.length - 1) {
        console.error(`进度: ${i + 1}/${docs.length} 文档已处理`);
      }

      const result = await indexDocument(doc, connector, embeddingManager, vectorManager, config, stats);
      documentResults.push(result);
    }

    let skippedCount = 0;
    let cleanedCount = 0;
    let docsNeedIndex = [];

    if (params.force) {
      // 强制重建：索引所有文档
      docsNeedIndex = documentResults;
      // 跳过索引的文档不计入
      skippedCount = documentResults.filter(r => r.skipped).length;
    } else {
      // 增量索引：检查更新、清理孤立索引
      const incrementalResult = await processIncrementalIndex(params, documentResults, connector, vectorManager);
      skippedCount = incrementalResult.skippedCount;
      cleanedCount = incrementalResult.cleanedCount;
      docsNeedIndex = incrementalResult.docsNeedIndex;
    }

    if (docsNeedIndex.length === 0) {
      console.log(JSON.stringify({
        success: true,
        indexed: 0,
        skipped: skippedCount,
        cleaned: cleanedCount,
        message: skippedCount > 0 ? `跳过 ${skippedCount} 个未变化的文档` : '所有文档已是最新，无需重新索引'
      }, null, 2));
      process.exit(0);
    }

    // 收集所有需要索引的向量
    const allVectors = [];
    for (const docResult of docsNeedIndex) {
      allVectors.push(...docResult.vectors);
    }

    console.log(`开始索引 ${allVectors.length} 个向量...`);

    // 批量存储向量
    const batchSize = params.batchSize || config.embedding?.batchSize || 5;
    let indexedCount = 0;
    let errors = [];

    for (let i = 0; i < allVectors.length; i += batchSize) {
      const batch = allVectors.slice(i, i + batchSize);
      const result = await vectorManager.indexBatch(batch);
      
      if (result.success) {
        indexedCount += result.indexed || batch.length;
      } else {
        errors.push({
          batch: Math.floor(i / batchSize),
          message: result.message || '索引失败'
        });
      }
    }

    // 构建返回结果
    const messages = [];
    if (indexedCount > 0) messages.push(`成功索引 ${indexedCount} 个向量`);
    if (cleanedCount > 0) messages.push(`清理 ${cleanedCount} 个孤立索引`);
    if (skippedCount > 0) messages.push(`跳过 ${skippedCount} 个未变化的文档/分块`);

    console.log(JSON.stringify({
      success: errors.length === 0,
      indexed: indexedCount,
      skipped: skippedCount,
      cleaned: cleanedCount,
      total: allVectors.length + skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: messages.length > 0 ? messages.join('，') : '索引完成'
    }, null, 2));

    process.exit(errors.length === 0 ? 0 : 1);
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
