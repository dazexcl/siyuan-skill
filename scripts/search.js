#!/usr/bin/env node
/**
 * search.js - 搜索内容
 *
 * 支持多种搜索模式:
 * - legacy/keyword: 使用 Siyuan 原生全文搜索
 * - semantic: 使用向量嵌入进行语义搜索
 * - hybrid: 结合 Siyuan 原生搜索和向量搜索的混合模式
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const EmbeddingManager = require('./lib/embedding-manager');
const VectorManager = require('./lib/vector-manager');
const SearchManager = require('./lib/search-manager');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: search <query> [选项]

搜索 Siyuan Notes 中的内容

位置参数:
  query                 搜索关键词

选项:
  -m, --mode <mode>           搜索模式: legacy/keyword/semantic/hybrid
  -T, --type <type>           搜索类型: d=文档, p=段落, h=标题, l=列表, i=项目, tb=代码块, c=代码块, s=数学公式, img=图片
  -l, --limit <num>           返回结果数量限制
  -P, --path <path>           限定搜索路径
  -n, --notebook-id <id>      限定笔记本ID
  --sort <type>               排序方式: relevance=相关性, date=日期
  --types <types>             多个类型过滤 (逗号分隔)
  --tags <tags>               标签过滤 (逗号分隔的标签列表)
  --where <condition>         自定义SQL WHERE条件
  --dense-weight <num>        语义搜索权重 (混合搜索, 默认0.7)
  --sparse-weight <num>       关键词搜索权重 (混合搜索, 默认0.3)
  --sql-weight <num>          SQL搜索权重 (混合搜索, 默认0)
  --threshold <num>           语义搜索阈值 (0-1)
  -h, --help                  显示帮助信息

示例:
  search "关键词"
  search "项目" --mode keyword --limit 10
  search "笔记" --notebook-id <id>
  search "类似概念" --mode semantic
  search "综合查询" --mode hybrid --threshold 0.5
  search "标签" --tags "技术,笔记" --sort date`;

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
  const hasValueOpts = new Set([
    'mode', 'type', 'types', 'limit', 'path', 'notebookId', 'notebook', 'threshold',
    'sort', 'tags', 'where', 'denseWeight', 'sparseWeight', 'sqlWeight'
  ]);
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
    process.stdout.write('错误: 请提供搜索关键词\n');
    process.exit(1);
  }

  const query = params.positional[0];
  if (!query || query.trim() === '') {
    process.stdout.write('错误: 搜索关键词不能为空\n');
    process.exit(1);
  }

  if (params.notebook && !params.notebookId) {
    params.notebookId = params.notebook;
  }

  const validModes = ['legacy', 'keyword', 'semantic', 'hybrid'];
  const mode = params.mode || 'legacy';
  if (params.mode && !validModes.includes(params.mode)) {
    process.stdout.write('错误: 无效的搜索模式，支持的模式: legacy, keyword, semantic, hybrid\n');
    process.exit(1);
  }
  const type = params.type;
  const types = params.types ? (typeof params.types === 'string' ? params.types.split(',').map(t => t.trim()) : params.types) : null;
  const tags = params.tags ? (typeof params.tags === 'string' ? params.tags.split(',').map(t => t.trim()) : params.tags) : null;
  const where = params.where || null;
  const sort = params.sort || 'relevance';
  const denseWeight = parseFloat(params.denseWeight) || 0.7;
  const sparseWeight = parseFloat(params.sparseWeight) || 0.3;
  const sqlWeight = parseFloat(params.sqlWeight) || 0;
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

    // 仅在配置了向量搜索相关参数时初始化
    let vectorManager = null;
    let embeddingManager = null;

    if (config.qdrant && config.qdrant.url && config.embedding && config.embedding.baseUrl) {
      try {
        embeddingManager = new EmbeddingManager(config.embedding);
        vectorManager = new VectorManager(config, embeddingManager);
        await vectorManager.initialize();
      } catch (error) {
        console.warn('向量搜索初始化失败，将使用传统搜索:', error.message);
        vectorManager = null;
      }
    }

    const searchManager = new SearchManager(connector, vectorManager);

    const searchOptions = {
      notebookId: params.notebookId,
      path: params.path,
      type: type,
      types: types,
      tags: tags,
      where: where,
      sort: sort,
      denseWeight: denseWeight,
      sparseWeight: sparseWeight,
      sqlWeight: sqlWeight,
      limit: limit,
      threshold: threshold,
      checkPermissionFn: (notebookId) => {
        try {
          checkPermission(config, notebookId);
          return true;
        } catch (e) {
          return false;
        }
      }
    };

    const result = await searchManager.search(query, {
      mode: mode,
      ...searchOptions
    });

    const blocks = result.results.map(r => ({
      id: r.id,
      score: r.relevanceScore || 0,
      content: r.content || r.excerpt || '',
      title: r.title || '',
      notebookId: r.box || r.notebookId || '',
      path: r.path || '',
      type: r.type || 'd'
    }));

    console.log(JSON.stringify({
      success: true,
      data: {
        blocks
      },
      query: {
        keyword: query,
        mode: mode,
        limit: limit,
        threshold: threshold
      }
    }, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
