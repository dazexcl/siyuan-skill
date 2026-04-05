#!/usr/bin/env node
/**
 * move.js - 移动文档到另一个目录
 * 支持文档ID或路径格式，包含重名检测和详细返回信息
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: move <docId|path> [targetParentId|path] [选项]

将文档从一个目录移动到另一个目录，支持文档ID或路径格式

位置参数:
  docId|path                  文档ID或路径（如：/笔记本名/路径）
  targetParentId|path         目标父目录ID或路径（可选）

选项:
  -T, --target <id|path>      目标父目录ID或路径
  -t, --new-title <title>     新标题（可选）
  -h, --help                  显示帮助信息

示例:
  move <id> <parentId>
  move <id> --target <parentId>
  move <id> <parentId> --new-title "新标题"
  move "/笔记本名/文档路径" "/笔记本名/目标路径"`;

/** 短选项到长选项的映射 */
const SHORT_OPTS = { T: 'target', t: 'newTitle' };

/**
 * 将短横线命名转为驼峰命名
 * @param {string} str - 输入字符串
 * @returns {string} 驼峰命名字符串
 */
function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 根据人类可读路径获取文档 ID
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} hPath - 人类可读路径，例如：/笔记本名/文档路径
 * @returns {Promise<string|null>} 文档 ID，找不到则返回 null
 */
async function getDocIdByHPath(connector, hPath) {
  try {
    const pathParts = hPath.split('/').filter(p => p.trim() !== '');
    if (pathParts.length === 0) {
      return null;
    }
    
    const notebooksResult = await connector.request('/api/notebook/lsNotebooks', {});
    if (!notebooksResult || !notebooksResult.notebooks) {
      return null;
    }
    
    let notebookId = null;
    for (const nb of notebooksResult.notebooks) {
      if (nb.name === pathParts[0] || nb.id === pathParts[0]) {
        notebookId = nb.id;
        break;
      }
    }
    
    if (!notebookId) {
      return null;
    }
    
    if (pathParts.length === 1) {
      return notebookId;
    }
    
    const relativePath = '/' + pathParts.slice(1).join('/');
    
    const result = await connector.request('/api/filetree/getIDsByHPath', {
      notebook: notebookId,
      path: relativePath
    });
    
    if (result && Array.isArray(result) && result.length > 0) {
      return result[0];
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 判断是否为路径格式
 * @param {string} value - 待判断的值
 * @returns {boolean} 是否为路径格式
 */
function isPathFormat(value) {
  return value && (value.startsWith('/') || value.includes('/'));
}

/**
 * 检查目标位置是否已存在同名文档
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} targetParentId - 目标父目录ID
 * @param {string} title - 文档标题
 * @param {string} excludeId - 排除的文档ID（自身）
 * @returns {Promise<Object|null>} 存在的文档信息，不存在则返回 null
 */
async function checkDuplicateDocument(connector, targetParentId, title, excludeId) {
  try {
    const targetInfo = await connector.request('/api/block/getBlockInfo', {
      id: targetParentId
    });
    
    if (!targetInfo || !targetInfo.box) {
      return null;
    }
    
    const hPathInfo = await connector.request('/api/filetree/getHPathByID', {
      id: targetParentId
    });
    
    if (!hPathInfo) {
      return null;
    }
    
    const children = await connector.request('/api/filetree/listDocsByPath', {
      notebook: targetInfo.box,
      path: hPathInfo
    });
    
    if (children && children.files) {
      for (const file of children.files) {
        if (file.title === title && file.id !== excludeId) {
          return file;
        }
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 解析命令行参数
 * @param {string[]} argv - 命令行参数数组
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['target', 'newTitle']);

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
  if (params.positional.length > 0) {
    params.docId = params.positional[0];
  }
  if (params.positional.length > 1 && !params.target) {
    params.targetParentId = params.positional[1];
  }
  if (params.target && !params.targetParentId) {
    params.targetParentId = params.target;
  }
  delete params.positional;
  delete params.target;

  if (!params.docId) {
    console.error('错误: 缺少必需的文档ID参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (!params.targetParentId) {
    console.error('错误: 缺少目标父目录ID参数');
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

    let originalDocPath = null;
    let originalTargetPath = null;
    let docId = params.docId;
    let targetParentId = params.targetParentId;

    if (isPathFormat(docId)) {
      originalDocPath = docId;
      docId = await getDocIdByHPath(connector, docId);
      if (!docId) {
        console.error(JSON.stringify({
          success: false,
          error: '未找到源文档',
          message: `无法通过路径找到源文档：${originalDocPath}`
        }, null, 2));
        process.exit(1);
      }
    }

    if (isPathFormat(targetParentId)) {
      originalTargetPath = targetParentId;
      targetParentId = await getDocIdByHPath(connector, targetParentId);
      if (!targetParentId) {
        console.error(JSON.stringify({
          success: false,
          error: '未找到目标位置',
          message: `无法通过路径找到目标位置：${originalTargetPath}`
        }, null, 2));
        process.exit(1);
      }
    }

    const docInfo = await connector.request('/api/block/getBlockInfo', {
      id: docId
    });

    checkPermission(config, docInfo.box);

    let targetInfo;
    try {
      targetInfo = await connector.request('/api/block/getBlockInfo', {
        id: targetParentId
      });
    } catch (error) {
      console.error(JSON.stringify({
        success: false,
        error: '目标位置不存在',
        message: `无法找到目标位置：${targetParentId}（${error.message}）`
      }, null, 2));
      process.exit(1);
    }

    if (!targetInfo) {
      console.error(JSON.stringify({
        success: false,
        error: '目标位置不存在',
        message: `无法找到目标位置：${targetParentId}`
      }, null, 2));
      process.exit(1);
    }

    let titleToUse = params.newTitle || docInfo.rootTitle;

    const existingDoc = await checkDuplicateDocument(
      connector,
      targetParentId,
      titleToUse,
      docId
    );

    if (existingDoc) {
      console.error(JSON.stringify({
        success: false,
        error: '目标位置已存在同名文档',
        message: `在目标位置已存在标题为"${titleToUse}"的文档（ID: ${existingDoc.id}），无法移动。请使用 --new-title 参数指定新标题`
      }, null, 2));
      process.exit(1);
    }

    const moveResult = await connector.request('/api/filetree/moveDocsByID', {
      fromIDs: [docId],
      toID: targetParentId
    });

    if (params.newTitle && params.newTitle !== docInfo.rootTitle) {
      await connector.request('/api/filetree/renameDocByID', {
        id: docId,
        title: params.newTitle
      });
      docInfo.rootTitle = params.newTitle;
    }

    let newPath = null;
    try {
      const newPathInfo = await connector.request('/api/filetree/getPathByID', { id: docId });
      if (newPathInfo) {
        newPath = newPathInfo;
      }
    } catch (error) {
      console.warn('获取新路径信息失败:', error.message);
    }

    console.log(JSON.stringify({
      success: true,
      data: {
        id: docId,
        from: originalDocPath || null,
        to: newPath?.path || null,
        targetParentId,
        originalTargetPath: originalTargetPath,
        newTitle: params.newTitle || null,
        moved: true
      },
      message: '文档迁移成功',
      timestamp: Date.now()
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      message: '迁移文档失败'
    }, null, 2));
    process.exit(1);
  }
}

main();
