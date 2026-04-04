#!/usr/bin/env node
/**
 * search.js - 搜索内容
 *
 * 支持多种搜索模式:
 * - legacy/keyword: 使用 Siyuan 原生全文搜索
 * - semantic: 使用向量嵌入进行语义搜索
 * - hybrid: 结合 Siyuan 原生搜索和向量搜索的混合模式
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');
const EmbeddingManager = require('./lib/embedding-manager');
const VectorManager = require('./lib/vector-manager');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: search <query> [选项]

搜索 Siyuan Notes 中的内容

位置参数:
  query                 搜索关键词

选项:
  -m, --mode <mode>       搜索模式: legacy/keyword/semantic/hybrid
  -T, --type <type>       搜索类型: 0=文档,1=文档(标题+摘要),2=全文
  -l, --limit <num>       返回结果数量限制
  -P, --path <path>       限定搜索路径
  -n, --notebook-id <id>  限定笔记本ID
  --threshold <num>       语义搜索阈值 (0-1)
  -h, --help              显示帮助信息

示例:
  search "关键词"
  search "项目" --mode keyword --limit 10
  search "笔记" --notebook-id <id>
  search "类似概念" --mode semantic
  search "综合查询" --mode hybrid --threshold 0.5`;

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
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['mode', 'type', 'limit', 'path', 'notebookId', 'threshold']);
  const SHORT_OPTS = { m: 'mode', T: 'type', l: 'limit', P: 'path', n: 'notebookId' };

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
    } else if (arg.startsWith('-') && arg.length === 2) {
      const shortKey = SHORT_OPTS[arg[1]];
      if (shortKey && i + 1 < argv.length) {
        options[shortKey] = argv[++i];
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, ...options };
}

/**
 * 执行 Siyuan 原生搜索
 * @param {SiyuanConnector} connector - Siyuan 连接器实例
 * @param {string} query - 搜索关键词
 * @param {string} mode - 搜索模式
 * @param {number} type - 搜索类型
 * @param {number} limit - 结果数量限制
 * @param {Object} params - 额外参数
 * @returns {Promise<Array>} 搜索结果数组
 */
async function executeSiyuanSearch(connector, query, mode, type, limit, params) {
  const methodMap = { legacy: 0, keyword: 1, semantic: 2, hybrid: 3 };
  const requestData = {
    query,
    method: methodMap[mode] || 0,
    types: [type],
    limit
  };

  if (params.path) requestData.path = params.path;
  if (params.notebookId) requestData.box = params.notebookId;

  const result = await connector.request('/api/search/fullTextSearchBlock', requestData);
  return result && result.data ? result.data.blocks || [] : [];
}

/**
 * 执行向量语义搜索
 * @param {EmbeddingManager} embeddingManager - 嵌入管理器实例
 * @param {VectorManager} vectorManager - 向量管理器实例
 * @param {string} query - 搜索查询
 * @param {number} limit - 结果数量限制
 * @param {number} threshold - 相似度阈值
 * @returns {Promise<Array>} 向量搜索结果数组
 */
async function executeVectorSearch(embeddingManager, vectorManager, query, limit, threshold) {
  // 生成查询向量
  const queryVector = await embeddingManager.generateEmbedding(query);
  if (!queryVector) {
    throw new Error('无法生成查询向量');
  }

  // 执行向量搜索
  const results = await vectorManager.searchSimilar(queryVector, limit, threshold);
  return results;
}

/**
 * 主函数 - 执行搜索
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const params = parseArgs(args);
  if (params.positional.length === 0) {
    console.error('错误: 请提供搜索关键词');
    process.exit(1);
  }

  const query = params.positional[0];
  const mode = params.mode || 'legacy';
  const type = parseInt(params.type) || 0;
  const limit = parseInt(params.limit) || 32;
  const threshold = parseFloat(params.threshold) || 0;

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    // 权限检查：如果指定了 notebookId，需要验证
    if (params.notebookId) {
      checkPermission(config, params.notebookId);
    }

    // 根据搜索模式执行不同逻辑
    if (mode === 'semantic') {
      // 语义搜索模式
      await executeSemanticSearch(config, query, limit, threshold);
    } else if (mode === 'hybrid') {
      // 混合搜索模式
      await executeHybridSearch(config, connector, query, type, limit, threshold, params);
    } else {
      // legacy 或 keyword 模式 - 使用 Siyuan 原生搜索
      const blocks = await executeSiyuanSearch(connector, query, mode, type, limit, params);
      console.log(JSON.stringify({
        success: true,
        data: { blocks },
        query: { keyword: query, mode, type, limit }
      }, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

/**
 * 执行语义搜索
 * @param {Object} config - 配置对象
 * @param {string} query - 搜索查询
 * @param {number} limit - 结果数量限制
 * @param {number} threshold - 相似度阈值
 */
async function executeSemanticSearch(config, query, limit, threshold) {
  // 检查向量搜索是否启用
  if (!config.vectorSearch || !config.vectorSearch.enabled) {
    console.log(JSON.stringify({
      success: false,
      message: '向量搜索未启用。请在 config.json 中配置 vectorSearch.enabled = true'
    }, null, 2));
    process.exit(1);
  }

  const embeddingManager = new EmbeddingManager(config);
  const vectorManager = new VectorManager(config);

  try {
    const results = await executeVectorSearch(embeddingManager, vectorManager, query, limit, threshold);

    console.log(JSON.stringify({
      success: true,
      data: {
        blocks: results.map(r => ({
          id: r.id,
          score: r.score,
          content: r.payload?.content || '',
          title: r.payload?.title || '',
          notebookId: r.payload?.notebookId || '',
          path: r.payload?.path || ''
        }))
      },
      query: { keyword: query, mode: 'semantic', limit, threshold }
    }, null, 2));
  } catch (error) {
    // 向量搜索失败，输出错误
    console.log(JSON.stringify({
      success: false,
      message: `向量搜索失败: ${error.message}`,
      fallback: true
    }, null, 2));
    process.exit(1);
  }
}

/**
 * 执行混合搜索
 * @param {Object} config - 配置对象
 * @param {SiyuanConnector} connector - Siyuan 连接器实例
 * @param {string} query - 搜索查询
 * @param {number} type - 搜索类型
 * @param {number} limit - 结果数量限制
 * @param {number} threshold - 相似度阈值
 * @param {Object} params - 额外参数
 */
async function executeHybridSearch(config, connector, query, type, limit, threshold, params) {
  // 检查向量搜索是否启用
  if (!config.vectorSearch || !config.vectorSearch.enabled) {
    // 向量搜索未启用，fallback 到 Siyuan 原生搜索
    console.error('警告: 向量搜索未启用，使用 Siyuan 原生搜索');
    const blocks = await executeSiyuanSearch(connector, query, 'hybrid', type, limit, params);
    console.log(JSON.stringify({
      success: true,
      data: { blocks },
      query: { keyword: query, mode: 'hybrid', type, limit },
      warning: '向量搜索未启用，使用原生搜索'
    }, null, 2));
    return;
  }

  const embeddingManager = new EmbeddingManager(config);
  const vectorManager = new VectorManager(config);

  try {
    // 并行执行 Siyuan 原生搜索和向量搜索
    const [siyuanResults, queryVector] = await Promise.all([
      executeSiyuanSearch(connector, query, 'hybrid', type, limit, params),
      embeddingManager.generateEmbedding(query)
    ]);

    if (!queryVector) {
      // 向量生成失败，仅使用 Siyuan 结果
      console.error('警告: 无法生成查询向量，仅使用 Siyuan 原生搜索结果');
      console.log(JSON.stringify({
        success: true,
        data: { blocks: siyuanResults },
        query: { keyword: query, mode: 'hybrid', type, limit },
        warning: '向量生成失败，仅使用原生搜索'
      }, null, 2));
      return;
    }

    // 执行混合搜索
    const hybridResults = await vectorManager.hybridSearch(
      queryVector,
      siyuanResults.map(b => ({
        id: b.id,
        score: b.score || 0.5,
        content: b.content || ''
      })),
      limit
    );

    console.log(JSON.stringify({
      success: true,
      data: {
        blocks: hybridResults.map(r => ({
          id: r.id,
          score: r.score,
          vectorScore: r.vectorScore,
          keywordScore: r.keywordScore,
          content: r.payload?.content || '',
          title: r.payload?.title || '',
          notebookId: r.payload?.notebookId || '',
          path: r.payload?.path || ''
        }))
      },
      query: { keyword: query, mode: 'hybrid', type, limit, threshold }
    }, null, 2));
  } catch (error) {
    // 混合搜索失败，fallback 到 Siyuan 原生搜索
    console.error(`警告: 混合搜索失败 (${error.message})，使用 Siyuan 原生搜索`);
    const blocks = await executeSiyuanSearch(connector, query, 'hybrid', type, limit, params);
    console.log(JSON.stringify({
      success: true,
      data: { blocks },
      query: { keyword: query, mode: 'hybrid', type, limit },
      warning: `混合搜索失败: ${error.message}`
    }, null, 2));
  }
}

main();
