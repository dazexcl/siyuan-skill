#!/usr/bin/env node
/**
 * convert.js - 文档 ID 与路径之间的互相转换
 * 
 * 支持功能：
 * - 根据文档ID获取人类可读路径
 * - 根据人类可读路径获取文档ID
 * - 支持默认笔记本配置
 * - 支持强制返回第一个匹配结果
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');
const { checkPermissionResult } = require('./lib/permission');
const { createErrorResult, createSuccessResult } = require('./lib/result-helper');

const HELP_TEXT = `用法: convert [选项]

文档 ID 与路径之间的互相转换

选项:
  --id <id>         根据文档ID获取人类可读路径
  --path <path>     根据人类可读路径获取文档ID
  --force           强制返回第一个结果（忽略多个匹配）
  -h, --help        显示帮助信息

注意:
  --id 和 --path 二选一

示例:
  convert --id 20231030-doc-id
  convert --path "/笔记本名/文档名"
  convert --path "/笔记本名/文档名" --force`;

/**
 * 校验文档ID格式
 * @param {string} id - 文档ID
 * @returns {boolean} 是否为有效的文档ID
 */
function isValidDocId(id) {
  return /^\d{14}-\w{7}$/.test(id);
}

/**
 * 校验笔记本ID格式
 * @param {string} id - 笔记本ID
 * @returns {boolean} 是否为有效的笔记本ID
 */
function isValidNotebookId(id) {
  return /^\d{14}-\w{7}$/.test(id);
}

/**
 * 获取笔记本列表
 * @returns {Promise<Array>} 笔记本列表
 */
async function getNotebooks() {
  const connector = SiyuanConnector.get();
  const result = await connector.request('/api/notebook/lsNotebooks', {});
  return result?.notebooks || [];
}

/**
 * 根据ID或名称查找笔记本
 * @param {Array} notebooks - 笔记本列表
 * @param {string} identifier - 笔记本ID或名称
 * @returns {Object|null} 笔记本对象
 */
function findNotebook(notebooks, identifier) {
  if (isValidNotebookId(identifier)) {
    return notebooks.find(nb => nb.id === identifier);
  }
  return notebooks.find(nb => nb.name === identifier);
}

/**
 * 解析路径中的笔记本信息
 * @param {Array} pathParts - 路径分割后的数组
 * @param {Array} notebooks - 笔记本列表
 * @param {string} defaultNotebook - 默认笔记本ID
 * @returns {Object} 笔记本信息 {id, name, found}
 */
function resolveNotebook(pathParts, notebooks, defaultNotebook = null) {
  const notebook = findNotebook(notebooks, pathParts[0]);
  
  if (notebook) {
    return {
      id: notebook.id,
      name: notebook.name,
      found: true
    };
  }
  
  if (defaultNotebook) {
    const defaultNb = notebooks.find(nb => nb.id === defaultNotebook);
    return {
      id: defaultNotebook,
      name: defaultNb?.name || null,
      found: false
    };
  }
  
  return {
    id: notebooks[0].id,
    name: notebooks[0].name || null,
    found: false
  };
}

/**
 * 根据人类可读路径获取文档 ID
 * @param {string} hPath - 人类可读路径
 * @param {boolean} force - 是否强制返回第一个结果
 * @param {string} defaultNotebook - 默认笔记本ID
 * @param {Object} config - 配置对象
 * @returns {Promise<Object>} 转换结果
 */
async function pathToId(hPath, force = false, defaultNotebook = null, config = null) {
  try {
    const pathParts = hPath.split('/').filter(p => p.trim() !== '');
    if (pathParts.length === 0) {
      return createErrorResult('无效路径', '路径不能为空');
    }

    const notebooks = await getNotebooks();
    if (notebooks.length === 0) {
      return createErrorResult('未找到笔记本', '系统中没有可用的笔记本');
    }

    const { id: notebookId, name: notebookName, found: foundNotebook } = resolveNotebook(pathParts, notebooks, defaultNotebook);

    if (config) {
      const permission = checkPermissionResult(config, notebookId, notebooks);
      if (!permission.hasPermission) {
        return createErrorResult('权限被拒绝', permission.error);
      }
    }

    if (foundNotebook && pathParts.length === 1) {
      return createSuccessResult({
        id: notebookId,
        path: hPath
      }, '路径转 ID 成功');
    }

    const relativePath = foundNotebook
      ? '/' + pathParts.slice(1).join('/')
      : '/' + pathParts.join('/');

    const connector = SiyuanConnector.get();
    const result = await connector.request('/api/filetree/getIDsByHPath', {
      notebook: notebookId,
      path: relativePath
    });

    if (Array.isArray(result) && result.length > 0) {
      if (result.length > 1 && !force) {
        return createErrorResult('多个匹配文档', `找到 ${result.length} 个匹配的文档，请使用 --force 参数直接获取第一个结果`);
      }

      return createSuccessResult({
        id: result[0],
        path: hPath,
        notebook: notebookId,
        multipleMatches: result.length > 1
      }, result.length > 1 ? '找到多个匹配文档，返回第一个结果' : '路径转 ID 成功');
    }

    return createErrorResult('未找到文档', `未找到路径对应的文档：${hPath}`);
  } catch (error) {
    return createErrorResult(error.message, '路径转 ID 失败');
  }
}

/**
 * 根据文档 ID 获取人类可读路径
 * @param {string} id - 文档 ID
 * @returns {Promise<Object>} 转换结果
 */
async function idToPath(id) {
  try {
    const connector = SiyuanConnector.get();
    const hPath = await connector.request('/api/filetree/getHPathByID', { id });

    if (!hPath) {
      return createErrorResult('未找到文档', `未找到 ID 对应的文档：${id}`);
    }

    return createSuccessResult({
      id: id,
      path: hPath
    }, 'ID 转人类可读路径成功');
  } catch (error) {
    return createErrorResult(error.message, 'ID 转人类可读路径失败');
  }
}

/**
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['id', 'path'],
    shortOpts: { 'h': 'help' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const params = { ...options, positional: positionalArgs };

  if (!params.id && !params.path && params.positional.length > 0) {
    const firstArg = params.positional[0];
    if (isValidDocId(firstArg)) {
      params.id = firstArg;
    } else {
      params.path = firstArg;
    }
  }

  if (!params.id && !params.path) {
    console.error('错误: 需要提供 --id 或 --path 参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (params.id && params.path) {
    console.error('错误: --id 和 --path 参数只能提供一个');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    if (!config.baseURL || !config.token) {
      console.error('错误: 配置文件中缺少必要的连接信息（baseURL 或 token）');
      process.exit(1);
    }

    let result;
    if (params.id) {
      result = await idToPath(params.id);
    } else {
      result = await pathToId(params.path, params.force || false, config.defaultNotebook, config);
    }

    console.log(JSON.stringify(result, null, 2));
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();