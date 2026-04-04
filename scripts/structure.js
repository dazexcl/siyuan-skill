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
 * - 统计文档和文件夹数量
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');
const { checkPermission, checkPermissionResult } = require('./lib/permission');

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
  -h, --help          显示帮助信息

示例:
  structure 20231030-notebook-id
  structure 20231030-doc-id --depth 2
  structure --path "/笔记本名"
  structure --path "/笔记本名/文档名" --depth -1
  structure --path "/笔记本名/文档名" --force

API 使用:
  - /api/filetree/getPathByID - 检测ID类型
  - /api/notebook/openNotebook - 打开笔记本
  - /api/filetree/listDocsByPath - 获取文档列表
`;

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
  const hasValueOpts = new Set(['path', 'depth', 'force']);

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
      // 短选项处理
      if (arg === '-h') {
        options.help = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, ...options };
}

/**
 * 统计文档数量
 * @param {Object} structure - 文档结构
 * @returns {number} 文档数量
 */
function countDocuments(structure) {
  let count = structure.documents ? structure.documents.length : 0;
  if (structure.folders) {
    for (const folder of structure.folders) {
      count += countDocuments(folder);
    }
  }
  return count;
}

/**
 * 统计文件夹数量
 * @param {Object} structure - 文档结构
 * @returns {number} 文件夹数量
 */
function countFolders(structure) {
  let count = structure.folders ? structure.folders.length : 0;
  if (structure.folders) {
    for (const folder of structure.folders) {
      count += countFolders(folder);
    }
  }
  return count;
}

/**
 * 构建文档结构（使用 listDocsByPath API）
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} notebookId - 笔记本ID
 * @param {string} startPath - 起始路径（系统路径）
 * @param {number} depth - 递归深度
 * @param {string} parentHPath - 父级可读路径
 * @returns {Promise<Object>} 文档结构
 */
async function buildDocStructure(connector, notebookId, startPath = '/', depth = 1, parentHPath = '') {
  const structure = {
    notebookId: notebookId,
    path: startPath,
    hpath: parentHPath || '/',
    documents: [],
    folders: []
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
        path: docPath,
        hpath: docHPath,
        updated: file.mtime ? new Date(file.mtime * 1000).toISOString() : null,
        created: file.ctime ? new Date(file.ctime * 1000).toISOString() : null,
        size: file.size || 0
      };

      if (hasChildren && depth !== 1) {
        const childStructure = await buildDocStructure(
          connector,
          notebookId,
          docPath,
          depth === -1 ? -1 : depth - 1,
          docHPath
        );

        structure.folders.push({
          ...docInfo,
          type: 'folder',
          documents: childStructure.documents,
          folders: childStructure.folders,
          subFileCount: file.subFileCount
        });
      } else {
        structure.documents.push({
          ...docInfo,
          type: 'doc',
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
 * 根据人类可读路径解析为笔记本ID和文档路径
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} hPath - 人类可读路径（如：/笔记本名/文档名）
 * @param {boolean} force - 是否强制使用第一个匹配结果（默认false）
 * @param {string} defaultNotebook - 默认笔记本ID
 * @returns {Promise<Object>} 解析结果
 */
async function pathToId(connector, hPath, force = false, defaultNotebook = null) {
  try {
    // 解析路径
    const pathParts = hPath.split('/').filter(p => p.trim() !== '');
    if (pathParts.length === 0) {
      return {
        success: false,
        error: '无效路径',
        message: '路径不能为空'
      };
    }

    // 获取所有笔记本列表
    const notebooks = await getNotebooks(connector);
    if (!notebooks || notebooks.length === 0) {
      return {
        success: false,
        error: '获取笔记本列表失败',
        message: '无法获取笔记本列表'
      };
    }

    // 查找第一个路径部分对应的笔记本
    let notebookId = null;
    let notebookName = null;
    let foundNotebook = false;

    // 首先检查是否为已知的笔记本ID格式 (14位数字 + 短横线 + 7位字母数字)
    if (/^\d{14}-[a-zA-Z0-9]{7}$/.test(pathParts[0])) {
      const nbById = notebooks.find(nb => nb.id === pathParts[0]);
      if (nbById) {
        notebookId = nbById.id;
        notebookName = nbById.name;
        foundNotebook = true;
      }
    } else {
      // 尝试查找匹配的笔记本名称
      for (const nb of notebooks) {
        if (nb.name === pathParts[0]) {
          notebookId = nb.id;
          notebookName = nb.name;
          foundNotebook = true;
          break;
        }
      }
    }

    // 如果未找到匹配的笔记本，检查是否有默认笔记本配置
    if (!foundNotebook) {
      if (defaultNotebook) {
        notebookId = defaultNotebook;
        const defaultNbInfo = notebooks.find(nb => nb.id === defaultNotebook);
        notebookName = defaultNbInfo?.name || '默认笔记本';
      } else {
        // 回退：使用第一个可用笔记本
        if (notebooks.length > 0) {
          notebookId = notebooks[0].id;
          notebookName = notebooks[0].name || '未命名笔记本';
          console.log(`未找到名为 "${pathParts[0]}" 的笔记本，使用第一个可用笔记本: ${notebookId}`);
        } else {
          return {
            success: false,
            error: '未找到笔记本',
            message: `系统中没有可用的笔记本`
          };
        }
      }
    }

    // 如果只有笔记本名称，返回笔记本 ID
    if (pathParts.length === 1 && foundNotebook) {
      return {
        success: true,
        data: {
          id: notebookId,
          name: notebookName,
          path: hPath,
          type: 'notebook'
        },
        message: '路径解析成功'
      };
    }

    // 根据是否找到匹配的笔记本决定路径处理方式
    if (foundNotebook) {
      // 构建相对路径（不包含笔记本名称）
      const relativePath = '/' + pathParts.slice(1).join('/');

      // 使用 getIDsByHPath API 获取文档 ID
      const result = await connector.request('/api/filetree/getIDsByHPath', {
        notebook: notebookId,
        path: relativePath
      });

      if (result && Array.isArray(result) && result.length > 0) {
        // 检查是否有多个匹配结果
        if (result.length > 1 && !force) {
          return {
            success: false,
            error: '多个匹配文档',
            message: `找到 ${result.length} 个匹配的文档，请使用搜索命令判断实际要使用的文档，或使用 --force 参数直接获取第一个结果`
          };
        }

        // 获取文档属性以获取标题
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
            multipleMatches: result.length > 1,
            parentId: notebookId
          },
          message: result.length > 1 ? '找到多个匹配文档，返回第一个结果' : '路径解析成功'
        };
      }

      return {
        success: false,
        error: '未找到文档',
        message: `未找到路径对应的文档：${hPath}`
      };
    } else {
      // 未找到匹配的笔记本，整个路径都被视为文档路径
      const relativePath = '/' + pathParts.join('/');
      const result = await connector.request('/api/filetree/getIDsByHPath', {
        notebook: notebookId,
        path: relativePath
      });

      if (result && Array.isArray(result) && result.length > 0) {
        // 检查是否有多个匹配结果
        if (result.length > 1 && !force) {
          return {
            success: false,
            error: '多个匹配文档',
            message: `找到 ${result.length} 个匹配的文档，请使用搜索命令判断实际要使用的文档，或使用 --force 参数直接获取第一个结果`
          };
        }

        // 获取文档属性以获取标题
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
          message: result.length > 1 ? '找到多个匹配文档，返回第一个结果' : '路径解析成功'
        };
      }

      return {
        success: false,
        error: '未找到文档',
        message: `未找到路径对应的文档：${hPath}`
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: '路径解析失败'
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

  // 验证参数
  const hasPositionalId = params.positional.length > 0;
  const hasPath = !!params.path;

  if (!hasPositionalId && !hasPath) {
    const errorResult = {
      success: false,
      error: '参数错误',
      message: '必须提供笔记本ID、文档ID或路径'
    };
    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }

  if (hasPositionalId && hasPath) {
    const errorResult = {
      success: false,
      error: '参数冲突',
      message: '位置参数和 --path 参数只能提供一个'
    };
    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }

  let notebookId = null;
  let documentId = null;
  let depth = params.depth !== undefined ? parseInt(params.depth, 10) : 1;
  let startPath = '/';
  let isDocumentId = false;
  let notebooks = null;

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    console.log('获取文档结构...');

    // 处理路径参数
    if (hasPath) {
      console.log('解析路径:', params.path);
      const pathResult = await pathToId(connector, params.path, params.force || false, config.defaultNotebook);

      if (!pathResult.success) {
        const errorResult = {
          success: false,
          error: pathResult.error || '路径解析失败',
          message: pathResult.message
        };
        console.log(JSON.stringify(errorResult, null, 2));
        process.exit(1);
      }

      const pathData = pathResult.data;
      if (pathData.type === 'notebook') {
        notebookId = pathData.id;
        console.log(`路径 "${params.path}" 解析为笔记本ID: ${notebookId}`);
      } else {
        notebookId = pathData.notebook || pathData.parentId;
        documentId = pathData.id;
        isDocumentId = true;
        startPath = pathData.path || '/';
        console.log(`路径 "${params.path}" 解析为文档ID: ${documentId}, 笔记本ID: ${notebookId}`);
      }
    }

    // 处理位置参数（笔记本ID或文档ID）
    if (hasPositionalId) {
      notebookId = params.positional[0];

      // 尝试检测是否为文档ID
      try {
        const pathInfo = await connector.request('/api/filetree/getPathByID', { id: notebookId });

        if (pathInfo) {
          isDocumentId = true;
          documentId = notebookId;
          notebookId = pathInfo.box || pathInfo.notebook;
          startPath = pathInfo.path || '/';
          console.log(`检测到文档ID ${documentId}，使用笔记本ID ${notebookId}`);
        }
      } catch (error) {
        // 如果 getPathByID 失败，验证是否为笔记本ID
        if (error.message && error.message.includes('tree not found')) {
          console.log('无法获取文档路径信息，验证是否为笔记本ID');
        }

        notebooks = await getNotebooks(connector);
        const notebookExists = notebooks.some(nb => nb.id === notebookId);

        if (notebookExists) {
          console.log(`检测到笔记本ID ${notebookId}`);
        } else {
          const errorResult = {
            success: false,
            error: '资源不存在',
            message: `文档或笔记本不存在: ${notebookId}`,
            reason: 'not_found'
          };
          console.log(JSON.stringify(errorResult, null, 2));
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
      const errorResult = {
        success: false,
        error: '权限不足',
        message: permissionCheck.error,
        reason: 'permission_denied'
      };
      console.log(JSON.stringify(errorResult, null, 2));
      process.exit(1);
    }

    // 打开笔记本
    await connector.request('/api/notebook/openNotebook', { notebook: notebookId });

    // 构建文档结构
    const structure = await buildDocStructure(connector, notebookId, startPath, depth);

    const result = {
      success: true,
      data: structure,
      timestamp: Date.now(),
      documentCount: countDocuments(structure),
      folderCount: countFolders(structure),
      type: isDocumentId ? 'doc' : 'notebook'
    };

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    const errorResult = {
      success: false,
      error: error.name || '执行失败',
      message: error.message
    };
    console.log(JSON.stringify(errorResult, null, 2));
    process.exit(1);
  }
}

main();
