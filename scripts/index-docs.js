#!/usr/bin/env node
/**
 * index-docs.js - 索引文档到向量数据库
 *
 * 将 Siyuan Notes 文档分块并索引到 Qdrant 向量数据库
 * 支持增量索引和强制重建索引
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');
const EmbeddingManager = require('./lib/embedding-manager');
const VectorManager = require('./lib/vector-manager');

const HELP_TEXT = `用法: index-docs [选项]

将 Siyuan Notes 文档索引到向量数据库

选项:
  --notebook <id>       指定笔记本ID
  --force               强制重新索引
  -h, --help            显示帮助信息

示例:
  index-docs
  index-docs --notebook <notebook-id>
  index-docs --force`;

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
  const hasValueOpts = new Set(['notebook']);

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
    }
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
 * 清理 kramdown 内容，移除不需要索引的属性
 * @param {string} content - 原始 kramdown 内容
 * @param {string[]} skipAttrs - 跳过的属性列表
 * @returns {string} 清理后的纯文本
 */
function cleanKramdownContent(content, skipAttrs = []) {
  if (!content) return '';

  let cleaned = content;

  // 移除 YAML front matter
  cleaned = cleaned.replace(/^---\n[\s\S]*?\n---\n/, '');

  // 移除代码块标记但保留内容
  cleaned = cleaned.replace(/```[\w]*\n/g, '');
  cleaned = cleaned.replace(/```\n?/g, '');

  // 移除行内代码标记
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // 移除链接语法但保留文本
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 移除图片
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // 移除标题标记
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // 移除粗体和斜体标记
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1');

  // 移除块引用标记
  cleaned = cleaned.replace(/^>\s*/gm, '');

  // 移除列表标记
  cleaned = cleaned.replace(/^[\*\-\+]\s+/gm, '');
  cleaned = cleaned.replace(/^\d+\.\s+/gm, '');

  // 移除 HTML 标签
  cleaned = cleaned.replace(/<[^>]+>/g, '');

  // 移除多余的空白
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.trim();

  return cleaned;
}

/**
 * 处理单个文档的索引
 * @param {Object} doc - 文档对象
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {EmbeddingManager} embeddingManager - 嵌入管理器
 * @param {VectorManager} vectorManager - 向量管理器
 * @param {Object} config - 配置对象
 * @param {IndexStats} stats - 统计对象
 * @returns {Promise<number>} 成功索引的块数
 */
async function indexDocument(doc, connector, embeddingManager, vectorManager, config, stats) {
  try {
    // 获取文档完整内容 (kramdown 格式)
    const kramdownResult = await connector.request('/api/block/getBlockKramdown', {
      id: doc.id,
      idType: 'id'  // 使用文档ID
    });

    if (!kramdownResult || !kramdownResult.data) {
      stats.addError(doc.id, '无法获取文档内容');
      return 0;
    }

    // 获取文档标题
    const docInfo = await connector.request('/api/block/getBlockInfo', {
      id: doc.id
    });

    // 提取内容
    const rawContent = kramdownResult.data.content || '';
    const title = docInfo.rootTitle || doc.name || 'Untitled';

    // 清理内容
    const skipAttrs = config.embedding?.skipIndexAttrs || [];
    const cleanContent = cleanKramdownContent(rawContent, skipAttrs);

    if (!cleanContent || cleanContent.length < (config.embedding?.minChunkLength || 200)) {
      // 内容太短，跳过
      return 0;
    }

    // 分块
    const chunks = embeddingManager.splitIntoChunks(cleanContent);
    if (chunks.length === 0) {
      return 0;
    }

    stats.totalChunks += chunks.length;

    // 先删除该文档的旧向量（增量索引）
    await vectorManager.deleteById(doc.id);

    // 为每个块生成嵌入并存储
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await embeddingManager.generateEmbedding(chunk);

      if (embedding) {
        // 截取内容前200字作为预览
        const contentPreview = chunk.length > 200 ? chunk.substring(0, 200) + '...' : chunk;

        vectors.push({
          id: `${doc.id}_chunk_${i}`,  // 使用文档ID+块索引作为唯一ID
          vector: embedding,
          payload: {
            blockId: doc.id,
            notebookId: doc.box || '',
            path: doc.path || '',
            title: title,
            content: contentPreview,
            chunkIndex: i,
            totalChunks: chunks.length
          }
        });
        stats.indexedChunks++;
      }
    }

    // 批量存储向量
    if (vectors.length > 0) {
      const result = await vectorManager.upsertVectors(vectors);
      if (!result.success) {
        stats.addError(doc.id, result.message);
        return 0;
      }
    }

    stats.indexedDocs++;
    return vectors.length;
  } catch (error) {
    stats.addError(doc.id, error.message);
    return 0;
  }
}

/**
 * 递归获取笔记本中的所有文档
 * @param {SiyuanConnector} connector - Siyuan 连接器
 * @param {string} notebookId - 笔记本ID
 * @param {string} path - 当前路径
 * @returns {Promise<Array>} 文档列表
 */
async function getAllDocs(connector, notebookId, path = '/') {
  const docs = [];

  try {
    const result = await connector.request('/api/filetree/listDocsByPath', {
      notebook: notebookId,
      path: path
    });

    if (result && result.data) {
      for (const doc of result.data) {
        // 添加当前文档
        docs.push({
          id: doc.id,
          name: doc.name,
          box: notebookId,
          path: doc.path
        });

        // 递归获取子目录中的文档
        if (doc.subFileCount > 0) {
          const subDocs = await getAllDocs(connector, notebookId, doc.path);
          docs.push(...subDocs);
        }
      }
    }
  } catch (error) {
    console.error(`获取文档列表失败 (${notebookId}:${path}):`, error.message);
  }

  return docs;
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

    // 检查向量搜索是否启用
    if (!config.vectorSearch || !config.vectorSearch.enabled) {
      console.log(JSON.stringify({
        success: false,
        message: '向量搜索未启用。请在 config.json 中配置 vectorSearch.enabled = true'
      }, null, 2));
      process.exit(1);
    }

    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    const embeddingManager = new EmbeddingManager(config);
    const vectorManager = new VectorManager(config);

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

    // 获取笔记本列表
    const notebooks = await connector.request('/api/notebook/lsNotebooks');
    const targetNotebooks = params.notebook
      ? (notebooks.data || []).filter(n => n.id === params.notebook)
      : (notebooks.data || []);

    if (targetNotebooks.length === 0) {
      console.log(JSON.stringify({
        success: false,
        message: params.notebook ? `未找到笔记本: ${params.notebook}` : '未找到任何笔记本'
      }, null, 2));
      process.exit(1);
    }

    console.error(`准备索引 ${targetNotebooks.length} 个笔记本...`);

    // 遍历笔记本
    for (const notebook of targetNotebooks) {
      console.error(`\n处理笔记本: ${notebook.name} (${notebook.id})`);

      // 获取所有文档
      const docs = await getAllDocs(connector, notebook.id);
      stats.totalDocs += docs.length;

      console.error(`发现 ${docs.length} 个文档`);

      // 索引每个文档
      for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];

        // 进度输出
        if ((i + 1) % 10 === 0 || i === docs.length - 1) {
          console.error(`进度: ${i + 1}/${docs.length} 文档已处理`);
        }

        await indexDocument(doc, connector, embeddingManager, vectorManager, config, stats);
      }
    }

    // 输出统计结果
    console.log(JSON.stringify({
      success: true,
      data: {
        totalDocs: stats.totalDocs,
        indexedDocs: stats.indexedDocs,
        totalChunks: stats.totalChunks,
        indexedChunks: stats.indexedChunks,
        failedDocs: stats.failedDocs,
        errors: stats.errors.length > 0 ? stats.errors.slice(0, 10) : undefined  // 最多显示10个错误
      },
      message: `索引完成: ${stats.indexedDocs}/${stats.totalDocs} 文档, ${stats.indexedChunks} 个文本块${stats.failedDocs > 0 ? `, ${stats.failedDocs} 个失败` : ''}`
    }, null, 2));

    process.exit(0);
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
