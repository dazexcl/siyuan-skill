/**
 * 文档 ID 和路径转换指令
 * 支持文档 ID 转路径、路径转文档 ID
 */

const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 根据人类可读路径获取文档 ID
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
    
    if (/^\d{14}-\w{7}$/.test(pathParts[0])) {
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
      } else {
        if (notebooksResult.notebooks.length > 0) {
          notebookId = notebooksResult.notebooks[0].id;
          notebookName = notebooksResult.notebooks[0].name || '未命名笔记本';
          console.log(`未找到名为 "${pathParts[0]}" 的笔记本，使用第一个可用笔记本: ${notebookId}`);
        } else {
          return {
            success: false,
            error: '未找到笔记本',
            message: '系统中没有可用的笔记本'
          };
        }
      }
    }
    
    if (foundNotebook) {
      if (pathParts.length === 1) {
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
      
      const relativePath = '/' + pathParts.slice(1).join('/');
    
      const result = await connector.request('/api/filetree/getIDsByHPath', {
        notebook: notebookId,
        path: relativePath
      });
      
      if (result && Array.isArray(result) && result.length > 0) {
        if (result.length > 1 && !force) {
          return {
            success: false,
            error: '多个匹配文档',
            message: `找到 ${result.length} 个匹配的文档，请使用搜索命令判断实际要使用的文档，或使用 --force 参数直接获取第一个结果`
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
            multipleMatches: result.length > 1,
            parentId: notebookId
          },
          message: result.length > 1 ? '找到多个匹配文档，返回第一个结果' : '路径转 ID 成功'
        };
      }
      
      return {
        success: false,
        error: '未找到文档',
        message: `未找到路径对应的文档：${hPath}`
      };
    } else {
      const relativePath = '/' + pathParts.join('/');
      const result = await connector.request('/api/filetree/getIDsByHPath', {
        notebook: notebookId,
        path: relativePath
      });
      
      if (result && Array.isArray(result) && result.length > 0) {
        if (result.length > 1 && !force) {
          return {
            success: false,
            error: '多个匹配文档',
            message: `找到 ${result.length} 个匹配的文档，请使用搜索命令判断实际要使用的文档，或使用 --force 参数直接获取第一个结果`
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
    }
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
 * 判断是否为路径格式
 */
function isPathFormat(value) {
  return value && (value.startsWith('/') || value.includes('/'));
}

/**
 * 判断是否为文档 ID 格式
 */
function isIdFormat(value) {
  return value && /^\d{14}-\w{7}$/.test(value);
}

/**
 * 指令配置
 */
const command = {
  name: 'convert',
  aliases: ['path'],
  description: '文档 ID 和路径互转',
  usage: 'siyuan convert <id|path> [--force]',
  sortOrder: 110,
  
  initOptions: {},
  options: {
    '--id': { hasValue: true, description: '文档ID' },
    '--path': { hasValue: true, description: '文档路径' },
    '--force': { isFlag: true, description: '强制匹配（返回第一个结果）' }
  },
  positionalCount: 1,
  
  notes: [
    'ID 转路径，路径转 ID',
    '路径格式: /笔记本名/文档路径'
  ],
  
  examples: [
    'siyuan convert <id>',
    'siyuan convert /笔记本/文档路径',
    'siyuan path <id>'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed, args) {
    const executeArgs = {};
    let hasIdOrPath = false;
    
    for (let i = 1; i < args.length; i++) {
      if (args[i] === '--id' && i + 1 < args.length) {
        executeArgs.id = args[++i];
        hasIdOrPath = true;
      } else if (args[i] === '--path' && i + 1 < args.length) {
        executeArgs.path = args[++i];
        hasIdOrPath = true;
      } else if (args[i] === '--force') {
        executeArgs.force = true;
      } else if (!args[i].startsWith('--') && !hasIdOrPath) {
        const value = args[i];
        if (/^\d{14}-[a-zA-Z0-9]{7}$/.test(value)) {
          executeArgs.id = value;
        } else {
          executeArgs.path = value;
        }
        hasIdOrPath = true;
      }
    }
    
    return executeArgs;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed, args);
    
    if (!executeArgs.id && !executeArgs.path) {
      console.error('错误：请提供文档 ID 或路径');
      console.log('用法：siyuan convert --id <docId> 或 siyuan convert --path <hPath>');
      process.exit(1);
    }
    
    console.log('转换 ID/路径...');
    console.log('转换参数:', executeArgs);
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  async execute(skill, args = {}) {
    const { id, path, force = false } = args;
    
    if (!id && !path) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 或 path 参数'
      };
    }
    
    if (id && path) {
      return {
        success: false,
        error: '参数冲突',
        message: 'id 和 path 参数只能提供一个'
      };
    }
    
    try {
      if (id) {
        console.log('将文档 ID 转换为路径:', id);
        return await idToPath(skill.connector, id);
      } else if (path) {
        console.log('将路径转换为文档 ID:', path);
        const defaultNb = skill.config.defaultNotebook;
        return await pathToId(skill.connector, path, force, defaultNb);
      }
    } catch (error) {
      console.error('转换失败:', error);
      return {
        success: false,
        error: error.message,
        message: '转换失败'
      };
    }
  }
};

module.exports = command;
module.exports.pathToId = pathToId;
module.exports.idToPath = idToPath;
module.exports.isPathFormat = isPathFormat;
module.exports.isIdFormat = isIdFormat;
