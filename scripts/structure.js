#!/usr/bin/env node
/**
 * structure.js - 获取笔记本/文档结构（目录树）
 * 
 * 支持三种输入方式：
 * - 笔记本ID
 * - 文档ID（自动检测）
 * - 路径（通过 --path 参数）
 * 
 * 功能特性：
 * - 自动检测输入的 ID 是笔记本ID还是文档ID
 * - 使用 listDocsByPath API 递归获取文档结构
 * - 统计文档总数
 * 
 * 注意：思源笔记中没有纯容器的"文件夹"概念，所有节点都是文档
 * - hasChildren: true 表示该文档包含子文档
 * - 所有文档都存储在 documents 数组中，通过 documents 字段嵌套表示层级关系
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');
const { checkPermissionResult } = require('./lib/permission');
const { createErrorResult, createSuccessResult, outputResult, outputError, logIfNotRaw } = require('./lib/result-helper');

/**
 * 帮助文本
 */
const HELP_TEXT = `用法: structure [<notebookId|docId>] [选项]

获取指定笔记本或文档的目录结构

位置参数:
  notebookId|docId    笔记本ID或文档ID（可选，与--path二选一）

选项:
  --path <path>       文档路径（与位置参数二选一）
  --depth <n>         递归深度（默认1，-1表示无限）
  --force             强制使用第一个匹配结果（当路径匹配多个文档时）
  -r, --raw           直接输出数据，不包裹响应对象
  -h, --help          显示帮助信息

示例:
  structure 20231030-notebook-id
  structure 20231030-doc-id --depth 2
  structure --path "/笔记本名"
  structure --path "/笔记本名/文档名" --depth -1
  structure --path "/笔记本名/文档名" --force
  structure 20231030-notebook-id --raw

`;

/**
 * 构建绝对路径（apath）
 * @param {string} notebookName - 笔记本名称
 * @param {string} hPath - 人类可读路径
 * @returns {string} 绝对路径
 */
function buildAPath(notebookName, hPath) {
  return notebookName ? `/${notebookName}${hPath}` : hPath || '/';
}

/**
 * 将 Unix 时间戳转换为思源笔记时间戳格式
 * @param {number} unixTimestamp - Unix 时间戳（秒）
 * @returns {string} 思源笔记时间戳格式（YYYYMMDDHHmmss）
 */
function formatSiyuanTimestamp(unixTimestamp) {
  const date = new Date(unixTimestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * 统计文档数量（递归统计所有文档）
 * @param {Object} structure - 文档结构
 * @returns {number} 文档总数
 */
function countDocuments(structure) {
  let count = structure.documents ? structure.documents.length : 0;
  
  if (structure.documents) {
    for (const doc of structure.documents) {
      if (doc.documents) {
        count += countDocuments(doc);
      }
    }
  }
  
  return count;
}

/**
 * 构建文档结构（使用 listDocsByPath API）
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} notebookId - 笔记本ID
 * @param {string} notebookName - 笔记本名称
 * @param {string} startPath - 起始路径（系统路径）
 * @param {number} depth - 递归深度
 * @param {string} parentHPath - 父级可读路径
 * @returns {Promise<Object>} 文档结构
 * 
 * 注意：hasChildren: true 表示该文档包含子文档
 */
async function buildDocStructure(connector, notebookId, notebookName, startPath = '/', depth = 1, parentHPath = '') {
  const structure = {
    notebookId: notebookId,
    notebookName: notebookName,
    path: {
      apath: buildAPath(notebookName, parentHPath),
      storage: startPath,
      hpath: parentHPath || '/'
    },
    documents: []
  };

  if (depth === 0) {
    return structure;
  }

  try {
    const result = await connector.request('/api/filetree/listDocsByPath', {
      notebook: notebookId,
      path: startPath
    });

    if (!result || !result.files || !Array.isArray(result.files)) {
      return structure;
    }

    for (const file of result.files) {
      const docName = file.name.replace(/\.sy$/, '');
      const docPath = file.path;
      const docId = file.id;
      const hasChildren = file.subFileCount > 0;
      const docHPath = parentHPath ? `${parentHPath}/${docName}` : `/${docName}`;

      const docInfo = {
        id: docId,
        title: docName,
        path: {
          apath: buildAPath(notebookName, docHPath),
          storage: docPath,
          hpath: docHPath
        },
        updated: file.mtime ? formatSiyuanTimestamp(file.mtime) : null,
        created: file.ctime ? formatSiyuanTimestamp(file.ctime) : null,
        size: file.size || 0
      };

      if (hasChildren && depth !== 1) {
        const nextDepth = depth === -1 ? -1 : depth - 1;
        
        if (nextDepth !== 0) {
          const childStructure = await buildDocStructure(
            connector,
            notebookId,
            notebookName,
            docPath,
            nextDepth,
            docHPath
          );

          structure.documents.push({
            ...docInfo,
            hasChildren: true,
            subFileCount: file.subFileCount,
            documents: childStructure.documents
          });
        } else {
          structure.documents.push({
            ...docInfo,
            hasChildren: true,
            subFileCount: file.subFileCount
          });
        }
      } else {
        structure.documents.push({
          ...docInfo,
          hasChildren: hasChildren,
          subFileCount: file.subFileCount || 0
        });
      }
    }

    return structure;
  } catch (error) {
    console.error(`获取路径 ${startPath} 的文档结构失败:`, error.message);
    return structure;
  }
}

/**
 * 获取笔记本列表
 * @param {SiyuanConnector} connector - 连接器实例
 * @returns {Promise<Array>} 笔记本列表
 */
async function getNotebooks(connector) {
  const result = await connector.request('/api/notebook/lsNotebooks');
  return result && result.notebooks ? result.notebooks : [];
}

/**
 * 校验思源笔记 ID 格式（笔记本ID或文档ID）
 * @param {string} id - ID
 * @returns {boolean} 是否为有效的 ID
 */
function isValidSiyuanId(id) {
  return /^\d{14}-\w{7}$/.test(id);
}

/**
 * 根据ID或名称查找笔记本
 * @param {Array} notebooks - 笔记本列表
 * @param {string} identifier - 笔记本ID或名称
 * @returns {Object|null} 笔记本对象
 */
function findNotebook(notebooks, identifier) {
  if (isValidSiyuanId(identifier)) {
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
 * @param {Object} connector - 连接器实例
 * @param {string} hPath - 人类可读路径
 * @param {boolean} force - 是否强制返回第一个结果
 * @param {string} defaultNotebook - 默认笔记本ID
 * @param {Object} config - 配置对象
 * @returns {Promise<Object>} 转换结果
 */
async function pathToId(connector, hPath, force = false, defaultNotebook = null, config = null) {
  try {
    const pathParts = hPath.split('/').filter(p => p.trim() !== '');
    if (pathParts.length === 0) {
      return createErrorResult('无效路径', '路径不能为空');
    }

    const notebooks = await getNotebooks(connector);
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
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  const params = parseArgs(args, {
    hasValueOpts: ['path', 'depth'],
    shortOpts: { 'h': 'help', 'r': 'raw' },
    defaults: { force: false }
  });

  if (params.options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  // 验证参数
  const hasPositionalId = params.positionalArgs.length > 0;
  const hasPath = !!params.options.path;

  if (!hasPositionalId && !hasPath) {
    console.log(JSON.stringify(createErrorResult('参数错误', '必须提供笔记本ID、文档ID或路径'), null, 2));
    process.exit(1);
  }

  if (hasPositionalId && hasPath) {
    console.log(JSON.stringify(createErrorResult('参数冲突', '位置参数和 --path 参数只能提供一个'), null, 2));
    process.exit(1);
  }

  let notebookId = null;
  let documentId = null;
  let depth = params.options.depth !== undefined ? parseInt(params.options.depth, 10) : 1;
  let startPath = '/';
  let isDocumentId = false;
  let notebooks = null;
  let parentHPath = '';
  const raw = params.options.raw || false;

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    logIfNotRaw('获取文档结构...', raw);

    // 处理路径参数
    if (hasPath) {
      logIfNotRaw(`解析路径: ${params.options.path}`, raw);
      const pathResult = await pathToId(connector, params.options.path, params.options.force || false, config.defaultNotebook, config);

      if (!pathResult.success) {
        console.log(JSON.stringify(createErrorResult(pathResult.error || '路径解析失败', pathResult.message), null, 2));
        process.exit(1);
      }

      const pathData = pathResult.data;
      if (!pathData.notebook) {
        // 没有 notebook 字段，说明是笔记本
        notebookId = pathData.id;
        logIfNotRaw(`路径 "${params.options.path}" 解析为笔记本ID: ${notebookId}`, raw);
      } else {
        // 有 notebook 字段，说明是文档
        notebookId = pathData.notebook;
        documentId = pathData.id;
        isDocumentId = true;
        parentHPath = pathData.path || params.options.path;
        
        const pathInfo = await connector.request('/api/filetree/getPathByID', { id: documentId });
        startPath = (pathInfo && pathInfo.path) ? pathInfo.path : '/';
        
        if (startPath !== '/') {
          logIfNotRaw(`路径 "${params.options.path}" 解析为文档ID: ${documentId}, 笔记本ID: ${notebookId}, 系统路径: ${startPath}`, raw);
        } else {
          logIfNotRaw(`无法获取文档 ${documentId} 的系统路径，使用默认路径: ${startPath}`, raw);
        }
      }
    }

    // 处理位置参数（笔记本ID或文档ID）
    if (hasPositionalId) {
      const candidateId = params.positionalArgs[0];
      let pathInfo = null;

      try {
        pathInfo = await connector.request('/api/filetree/getPathByID', { id: candidateId });
      } catch (error) {
        logIfNotRaw('获取文档路径信息失败，验证是否为笔记本ID', raw);
      }

      if (pathInfo && pathInfo.path && pathInfo.path !== '/') {
        // 成功获取路径信息，说明是文档ID
        isDocumentId = true;
        documentId = candidateId;
        notebookId = pathInfo.box || pathInfo.notebook;
        startPath = pathInfo.path || '/';
        logIfNotRaw(`检测到文档ID ${documentId}，使用笔记本ID ${notebookId}`, raw);
      } else {
        // 获取失败或返回空路径，验证是否为笔记本ID
        logIfNotRaw('无法获取文档路径信息，验证是否为笔记本ID', raw);

        notebooks = await getNotebooks(connector);
        const notebookExists = notebooks.some(nb => nb.id === candidateId);

        if (notebookExists) {
          notebookId = candidateId;
          logIfNotRaw(`检测到笔记本ID ${notebookId}`, raw);
        } else {
          console.log(JSON.stringify(createErrorResult('资源不存在', `文档或笔记本不存在: ${candidateId}`, { reason: 'not_found' }), null, 2));
          process.exit(1);
        }
      }
    }

    // 权限检查
    if (!notebooks) {
      notebooks = await getNotebooks(connector);
    }
    const permissionCheck = checkPermissionResult(config, notebookId, notebooks);
    if (!permissionCheck.hasPermission) {
      console.log(JSON.stringify(createErrorResult('权限不足', permissionCheck.error, { reason: 'permission_denied' }), null, 2));
      process.exit(1);
    }

    // 获取笔记本名称
    const notebookInfo = notebooks.find(nb => nb.id === notebookId);
    const notebookName = notebookInfo ? notebookInfo.name : null;

    // 打开笔记本
    await connector.request('/api/notebook/openNotebook', { notebook: notebookId });

    // 构建文档结构
    const structure = await buildDocStructure(connector, notebookId, notebookName, startPath, depth, parentHPath);

    outputResult(structure, raw, {
      timestamp: Date.now(),
      documentCount: countDocuments(structure),
      type: isDocumentId ? 'doc' : 'notebook',
      query: {
        notebookId: notebookId,
        documentId: documentId || null,
        startPath: startPath,
        depth: depth
      }
    });
    process.exit(0);
  } catch (error) {
    outputError(error, raw, {
      details: {
        notebookId: notebookId,
        documentId: documentId || null,
        startPath: startPath,
        depth: depth
      }
    });
    process.exit(1);
  }
}

main();
