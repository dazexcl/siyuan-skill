/**
 * 文档 ID 和路径转换指令
 * 支持文档 ID 转路径、路径转文档 ID
 */

/**
 * 根据人类可读路径获取文档 ID
 * @param {Object} connector - Siyuan 连接器
 * @param {string} hPath - 人类可读路径，例如：/openclaw/更新记录
 * @param {boolean} force - 是否强制返回第一个结果（忽略多个匹配）
 * @returns {Promise<Object>} 转换结果
 */
async function pathToId(connector, hPath, force = false) {
  try {
    // 解析路径，获取笔记本 ID 和相对路径
    const pathParts = hPath.split('/').filter(p => p.trim() !== '');
    if (pathParts.length === 0) {
      return {
        success: false,
        error: '无效路径',
        message: '路径不能为空'
      };
    }
    
    // 获取所有笔记本列表
    const notebooksResult = await connector.request('/api/notebook/lsNotebooks', {});
    if (!notebooksResult || !notebooksResult.notebooks) {
      return {
        success: false,
        error: '获取笔记本列表失败',
        message: '无法获取笔记本列表'
      };
    }
    
    // 查找第一个路径部分对应的笔记本 ID
    let notebookId = null;
    let notebookName = null;
    let foundNotebook = false;
    
    // 首先检查是否为已知的笔记本ID格式 (15位数字 + 短横线 + 5位字母数字)
    if (/^\d{15}-\w{5}$/.test(pathParts[0])) {
      const nbById = notebooksResult.notebooks.find(nb => nb.id === pathParts[0]);
      if (nbById) {
        notebookId = nbById.id;
        notebookName = nbById.name;
        foundNotebook = true;
      }
    } else {
      // 尝试查找匹配的笔记本名称
      for (const nb of notebooksResult.notebooks) {
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
      // 检查是否配置了默认笔记本
      const defaultNotebook = process.env.SIYUAN_DEFAULT_NOTEBOOK;
      if (defaultNotebook) {
        notebookId = defaultNotebook;
        const defaultNbInfo = notebooksResult.notebooks.find(nb => nb.id === defaultNotebook);
        notebookName = defaultNbInfo?.name || '默认笔记本';
        console.log(`未找到名为 "${pathParts[0]}" 的笔记本，使用默认笔记本: ${notebookId}`);
      } else {
        // 如果没有配置默认笔记本，使用第一个可用的笔记本
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
    
    // 根据是否找到匹配的笔记本决定路径处理方式
    if (foundNotebook) {
      // 如果只有笔记本名称，返回笔记本 ID
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
      
      // 构建完整的人类可读路径（不包含笔记本名称）
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
        message: result.length > 1 ? '找到多个匹配文档，返回第一个结果' : '路径转 ID 成功'
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
 * @param {Object} connector - Siyuan 连接器
 * @param {string} id - 文档 ID
 * @returns {Promise<Object>} 转换结果
 */
async function idToPath(connector, id) {
  try {
    // 使用 getPathByID API 获取存储路径
    const pathInfo = await connector.request('/api/filetree/getPathByID', { id });
    
    if (!pathInfo || !pathInfo.notebook || !pathInfo.path) {
      return {
        success: false,
        error: '未找到文档',
        message: `未找到 ID 对应的文档：${id}`
      };
    }
    
    // 获取笔记本信息
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
    
    // 使用 getHPathByID API 获取人类可读路径
    const hPath = await connector.request('/api/filetree/getHPathByID', { id });
    
    // 构建完整路径
    const fullPath = notebookName ? `/${notebookName}${hPath}` : hPath;
    
    // 获取文档属性以获取标题
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
 * @param {string} value - 待判断的值
 * @returns {boolean} 是否为路径格式
 */
function isPathFormat(value) {
  return value && (value.startsWith('/') || value.includes('/'));
}

/**
 * 判断是否为文档 ID 格式（15 位数字 + 短横线 + 5 位字母数字）
 * @param {string} value - 待判断的值
 * @returns {boolean} 是否为 ID 格式
 */
function isIdFormat(value) {
  return value && /^\d{15}-\w{5}$/.test(value);
}

/**
 * 指令配置
 */
const command = {
  name: 'convert-path',
  description: '文档 ID 和路径互相转换',
  usage: 'convert-path --id <docId> 或 convert-path --path <hPath> [--force]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.id - 文档 ID
   * @param {string} args.path - 人类可读路径
   * @param {boolean} args.force - 是否强制返回第一个结果（忽略多个匹配）
   * @returns {Promise<Object>} 转换结果
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
        // ID 转路径
        console.log('将文档 ID 转换为路径:', id);
        return await idToPath(skill.connector, id);
      } else if (path) {
        // 路径转 ID
        console.log('将路径转换为文档 ID:', path);
        return await pathToId(skill.connector, path, force);
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
