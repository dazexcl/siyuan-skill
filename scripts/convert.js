#!/usr/bin/env node
/**
 * convert.js - 文档ID与路径互转
 * 
 * 支持完整的路径解析和ID转换功能
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');

const HELP_TEXT = `用法: convert [选项]

文档 ID 与路径之间的互相转换

选项:
  --id <id>         根据文档ID获取路径
  --path <path>     根据路径获取文档ID
  --force           强制返回第一个结果（忽略多个匹配）
  -h, --help        显示帮助信息

注意:
  --id 和 --path 二选一

示例:
  convert --id 20231030-doc-id
  convert --path "/笔记本名/文档名"
  convert --path "/笔记本名/文档名" --force`;

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
  const hasValueOpts = new Set(['id', 'path']);

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
    } else if (arg.startsWith('-') && arg.length === 2 && arg !== '-') {
      // 短选项暂不定义
    } else {
      positional.push(arg);
    }
  }
  return { positional, ...options };
}

/**
 * 根据人类可读路径获取文档 ID
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} hPath - 人类可读路径
 * @param {boolean} force - 是否强制返回第一个结果
 * @param {string} defaultNotebook - 默认笔记本ID
 * @returns {Promise<Object>} 转换结果
 */
async function pathToId(connector, hPath, force = false, defaultNotebook = null) {
  try {
    const pathParts = hPath.split('/').filter(p => p.trim() !== '');
    if (pathParts.length === 0) {
      return {
        success: false,
        error: '无效路径',
        message: '路径不能为空'
      };
    }

    const notebooksResult = await connector.request('/api/notebook/lsNotebooks', {});
    if (!notebooksResult || !notebooksResult.notebooks) {
      return {
        success: false,
        error: '获取笔记本列表失败',
        message: '无法获取笔记本列表'
      };
    }

    let notebookId = null;
    let notebookName = null;
    let foundNotebook = false;

    // 检查是否为笔记本ID格式
    if (/^\d{15}-\w{5}$/.test(pathParts[0])) {
      const nbById = notebooksResult.notebooks.find(nb => nb.id === pathParts[0]);
      if (nbById) {
        notebookId = nbById.id;
        notebookName = nbById.name;
        foundNotebook = true;
      }
    } else {
      for (const nb of notebooksResult.notebooks) {
        if (nb.name === pathParts[0]) {
          notebookId = nb.id;
          notebookName = nb.name;
          foundNotebook = true;
          break;
        }
      }
    }

    if (!foundNotebook) {
      if (defaultNotebook) {
        notebookId = defaultNotebook;
        const defaultNbInfo = notebooksResult.notebooks.find(nb => nb.id === defaultNotebook);
        notebookName = defaultNbInfo?.name || '默认笔记本';
      } else if (notebooksResult.notebooks.length > 0) {
        notebookId = notebooksResult.notebooks[0].id;
        notebookName = notebooksResult.notebooks[0].name || '未命名笔记本';
      } else {
        return {
          success: false,
          error: '未找到笔记本',
          message: '系统中没有可用的笔记本'
        };
      }
    }

    if (foundNotebook && pathParts.length === 1) {
      return {
        success: true,
        data: {
          id: notebookId,
          name: notebookName,
          path: hPath,
          type: 'notebook'
        },
        message: '路径转 ID 成功'
      };
    }

    const relativePath = foundNotebook
      ? '/' + pathParts.slice(1).join('/')
      : '/' + pathParts.join('/');

    const result = await connector.request('/api/filetree/getIDsByHPath', {
      notebook: notebookId,
      path: relativePath
    });

    if (result && Array.isArray(result) && result.length > 0) {
      if (result.length > 1 && !force) {
        return {
          success: false,
          error: '多个匹配文档',
          message: `找到 ${result.length} 个匹配的文档，请使用 --force 参数直接获取第一个结果`
        };
      }

      let docTitle = null;
      try {
        const attrs = await connector.request('/api/attr/getBlockAttrs', { id: result[0] });
        if (attrs && attrs.title) {
          docTitle = attrs.title;
        }
      } catch (error) {
        // 忽略错误
      }

      return {
        success: true,
        data: {
          id: result[0],
          name: docTitle || pathParts[pathParts.length - 1],
          path: hPath,
          type: 'document',
          notebook: notebookId,
          notebookName: notebookName,
          multipleMatches: result.length > 1
        },
        message: result.length > 1 ? '找到多个匹配文档，返回第一个结果' : '路径转 ID 成功'
      };
    }

    return {
      success: false,
      error: '未找到文档',
      message: `未找到路径对应的文档：${hPath}`
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '路径转 ID 失败'
    };
  }
}

/**
 * 根据文档 ID 获取人类可读路径
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} id - 文档 ID
 * @returns {Promise<Object>} 转换结果
 */
async function idToPath(connector, id) {
  try {
    const pathInfo = await connector.request('/api/filetree/getPathByID', { id });

    if (!pathInfo || !pathInfo.notebook || !pathInfo.path) {
      return {
        success: false,
        error: '未找到文档',
        message: `未找到 ID 对应的文档：${id}`
      };
    }

    const notebooksResult = await connector.request('/api/notebook/lsNotebooks', {});
    let notebookName = null;
    if (notebooksResult && notebooksResult.notebooks) {
      for (const nb of notebooksResult.notebooks) {
        if (nb.id === pathInfo.notebook) {
          notebookName = nb.name;
          break;
        }
      }
    }

    const hPath = await connector.request('/api/filetree/getHPathByID', { id });
    const fullPath = notebookName ? `/${notebookName}${hPath}` : hPath;

    let docTitle = null;
    try {
      const attrs = await connector.request('/api/attr/getBlockAttrs', { id });
      if (attrs && attrs.title) {
        docTitle = attrs.title;
      }
    } catch (error) {
      // 忽略错误
    }

    return {
      success: true,
      data: {
        id: id,
        path: fullPath,
        storagePath: pathInfo.path,
        notebook: pathInfo.notebook,
        notebookName: notebookName,
        title: docTitle,
        type: 'document'
      },
      message: 'ID 转路径成功'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'ID 转路径失败'
    };
  }
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

  if (!params.id && !params.path) {
    console.error('错误: 需要提供 --id 或 --path 参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (params.id && params.path) {
    console.error('错误: --id 和 --path 参数只能提供一个');
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

    if (params.id) {
      const result = await idToPath(connector, params.id);
      console.log(JSON.stringify(result, null, 2));
    } else if (params.path) {
      const result = await pathToId(connector, params.path, params.force || false, config.defaultNotebook);
      console.log(JSON.stringify(result, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
