#!/usr/bin/env node
/**
 * exists.js - 检查文档是否存在
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');

const HELP_TEXT = `用法: exists [选项]

检查指定位置是否存在同名文档

选项:
  -t, --title <title>        文档标题
  --path <path>              文档完整路径
  -p, --parent-id <id>       父文档ID
  -n, --notebook-id <id>     笔记本ID
  -h, --help                 显示帮助信息

注意:
  --title 与 --path 二选一

示例:
  exists --title "文档标题"
  exists --title "标题" --parent-id <id>
  exists --path "/目录/文档"`;

/** 短选项到长选项的映射 */
const SHORT_OPTS = { t: 'title', p: 'parentId', n: 'notebookId' };

/**
 * 将短横线命名转为驼峰命名
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
  const hasValueOpts = new Set(['title', 'path', 'parentId', 'notebookId']);

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
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  
  const params = parseArgs(args);
  // 第一个位置参数可作为 title
  if (params.positional.length > 0 && !params.title) {
    params.title = params.positional[0];
  }
  delete params.positional;

  if (!params.title && !params.path) {
    console.error('错误: 需要提供 --title 或 --path 参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    let searchPath = params.path;

    // 如果提供了 title 和 parentId，构建完整路径
    if (params.title && params.parentId) {
      const parentInfo = await connector.request('/api/block/getBlockInfo', {
        id: params.parentId
      });
      if (parentInfo?.data && parentInfo.data.rootPath) {
        searchPath = parentInfo.data.rootPath + '/' + params.title;
      }
    } else if (params.title && params.notebookId) {
      // 获取笔记本信息
      const notebooks = await connector.request('/api/notebook/lsNotebooks');
      const notebook = notebooks.data?.notebooks?.find(n => n.id === params.notebookId);
      if (notebook) {
        searchPath = '/' + notebook.name + '/' + params.title;
      }
    } else if (params.title) {
      // 只有标题，尝试搜索
      searchPath = params.title;
    }

    // 检查文档是否存在
    let exists = false;
    let docIds = [];
    let notebookId = null;

    if (searchPath) {
      try {
        // 如果路径以 / 开头，需要解析笔记本
        if (searchPath.startsWith('/')) {
          const pathParts = searchPath.split('/').filter(p => p);
          if (pathParts.length > 0) {
            const notebookName = pathParts[0];
            // 获取笔记本列表
            const notebooks = await connector.request('/api/notebook/lsNotebooks');
            const notebook = notebooks.data?.notebooks?.find(n => n.name === notebookName);
            if (notebook) {
              notebookId = notebook.id;
            }
          }
        }

        if (notebookId) {
          docIds = await connector.request('/api/filetree/getIDsByHPath', {
            notebook: notebookId,
            path: searchPath
          });
          exists = docIds && docIds.length > 0;
        }
      } catch (err) {
        // 路径不存在
        exists = false;
      }
    }

    console.log(JSON.stringify({
      exists: exists,
      path: searchPath,
      ids: docIds || []
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
