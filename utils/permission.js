/**
 * 权限管理工具
 * 提供权限检查和权限拦截相关功能
 */

/**
 * Permission 类
 * 提供权限管理相关方法
 */
class Permission {
  /**
   * 检查ID是否为笔记本ID
   * 笔记本ID格式：14位数字 + 短横线 + 7位字母数字
   * @param {string} id - 待检查的ID
   * @returns {boolean} 是否为笔记本ID
   */
  static isNotebookId(id) {
    if (!id || typeof id !== 'string') {
      return false;
    }
    return /^\d{14}-[a-zA-Z0-9]{7}$/.test(id);
  }

  /**
   * 检查笔记本权限（同步方法）
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {string} notebookId - 笔记本ID
   * @returns {{hasPermission: boolean, notebookId: string|null, error: string|null}}
   */
  static checkNotebookPermission(skill, notebookId) {
    if (!notebookId) {
      return {
        hasPermission: false,
        notebookId: null,
        error: '笔记本ID不能为空'
      };
    }
    
    const hasPermission = skill.checkPermission(notebookId);
    const { permissionMode, notebookList } = skill.config;
    
    let errorMessage = null;
    if (!hasPermission) {
      if (permissionMode === 'whitelist') {
        errorMessage = `笔记本 ${notebookId} 不在白名单中。当前白名单: [${notebookList.join(', ')}]`;
      } else if (permissionMode === 'blacklist') {
        errorMessage = `笔记本 ${notebookId} 在黑名单中，禁止访问`;
      } else {
        errorMessage = `无权访问笔记本 ${notebookId}`;
      }
    }
    
    return {
      hasPermission,
      notebookId,
      error: errorMessage
    };
  }

  /**
   * 检查文档权限
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {string} docId - 文档ID或笔记本ID
   * @returns {Promise<{hasPermission: boolean, notebookId: string|null, error: string|null}>}
   */
  static async checkDocumentPermission(skill, docId) {
    if (!docId) {
      return {
        hasPermission: false,
        notebookId: null,
        error: '文档ID不能为空'
      };
    }

    try {
      const pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: docId });
      
      const notebookId = pathInfo?.notebook || pathInfo?.box;
      
      if (!pathInfo || !notebookId) {
        return {
          hasPermission: false,
          notebookId: null,
          error: '无法获取文档所在的笔记本信息'
        };
      }
      const hasPermission = skill.checkPermission(notebookId);
      const { permissionMode, notebookList } = skill.config;
      
      let errorMessage = null;
      if (!hasPermission) {
        if (permissionMode === 'whitelist') {
          errorMessage = `文档所在的笔记本 ${notebookId} 不在白名单中。当前白名单: [${notebookList.join(', ')}]`;
        } else if (permissionMode === 'blacklist') {
          errorMessage = `文档所在的笔记本 ${notebookId} 在黑名单中，禁止访问`;
        } else {
          errorMessage = `无权操作文档 ${docId}`;
        }
      }
      
      return {
        hasPermission,
        notebookId,
        error: errorMessage
      };
    } catch (error) {
      console.warn('获取文档路径信息失败:', error.message);
      
      if (error.message && error.message.includes('tree not found')) {
        if (this.isNotebookId(docId)) {
          const hasPermission = skill.checkPermission(docId);
          const { permissionMode, notebookList } = skill.config;
          
          let errorMessage = null;
          if (!hasPermission) {
            if (permissionMode === 'whitelist') {
              errorMessage = `笔记本 ${docId} 不在白名单中。当前白名单: [${notebookList.join(', ')}]`;
            } else if (permissionMode === 'blacklist') {
              errorMessage = `笔记本 ${docId} 在黑名单中，禁止访问`;
            } else {
              errorMessage = `无权访问笔记本 ${docId}`;
            }
          }
          
          return {
            hasPermission,
            notebookId: docId,
            error: errorMessage
          };
        }
        
        return {
          hasPermission: false,
          notebookId: null,
          error: '文档不存在或ID无效'
        };
      }
      
      return {
        hasPermission: false,
        notebookId: null,
        error: '获取文档路径信息失败'
      };
    }
  }

  /**
   * 检查父文档/笔记本权限
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {string} parentId - 父文档/笔记本ID
   * @param {string} defaultNotebook - 默认笔记本ID
   * @returns {Promise<{hasPermission: boolean, notebookId: string, error: string|null}>}
   */
  static async checkParentPermission(skill, parentId, defaultNotebook) {
    if (!parentId) {
      return {
        hasPermission: false,
        notebookId: null,
        error: '父文档ID不能为空'
      };
    }

    try {
      const pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: parentId });
      
      let notebookId = defaultNotebook;
      const extractedNotebookId = pathInfo?.notebook || pathInfo?.box;
      if (extractedNotebookId) {
        notebookId = extractedNotebookId;
      }
      
      if (!notebookId) {
        return {
          hasPermission: false,
          notebookId: null,
          error: '无法获取笔记本ID'
        };
      }
      
      const hasPermission = skill.checkPermission(notebookId);
      const { permissionMode, notebookList } = skill.config;
      
      let errorMessage = null;
      if (!hasPermission) {
        if (permissionMode === 'whitelist') {
          errorMessage = `笔记本 ${notebookId} 不在白名单中。当前白名单: [${notebookList.join(', ')}]`;
        } else if (permissionMode === 'blacklist') {
          errorMessage = `笔记本 ${notebookId} 在黑名单中，禁止访问`;
        } else {
          errorMessage = `无权在笔记本 ${notebookId} 中操作`;
        }
      }
      
      return {
        hasPermission,
        notebookId,
        error: errorMessage
      };
    } catch (error) {
      console.warn('获取父文档路径信息失败:', error.message);
      
      if (error.message && error.message.includes('tree not found')) {
        if (this.isNotebookId(parentId)) {
          const hasPermission = skill.checkPermission(parentId);
          const { permissionMode, notebookList } = skill.config;
          
          let errorMessage = null;
          if (!hasPermission) {
            if (permissionMode === 'whitelist') {
              errorMessage = `笔记本 ${parentId} 不在白名单中。当前白名单: [${notebookList.join(', ')}]`;
            } else if (permissionMode === 'blacklist') {
              errorMessage = `笔记本 ${parentId} 在黑名单中，禁止访问`;
            } else {
              errorMessage = `无权在笔记本 ${parentId} 中操作`;
            }
          }
          
          return {
            hasPermission,
            notebookId: parentId,
            error: errorMessage
          };
        }
        
        if (defaultNotebook) {
          const hasPermission = skill.checkPermission(defaultNotebook);
          const { permissionMode, notebookList } = skill.config;
          
          let errorMessage = null;
          if (!hasPermission) {
            if (permissionMode === 'whitelist') {
              errorMessage = `默认笔记本 ${defaultNotebook} 不在白名单中。当前白名单: [${notebookList.join(', ')}]`;
            } else if (permissionMode === 'blacklist') {
              errorMessage = `默认笔记本 ${defaultNotebook} 在黑名单中，禁止访问`;
            } else {
              errorMessage = `无权在笔记本 ${defaultNotebook} 中操作`;
            }
          }
          
          return {
            hasPermission,
            notebookId: defaultNotebook,
            error: errorMessage
          };
        }
        
        return {
          hasPermission: false,
          notebookId: null,
          error: '文档不存在或ID无效'
        };
      }
      
      if (defaultNotebook) {
        const hasPermission = skill.checkPermission(defaultNotebook);
        const { permissionMode, notebookList } = skill.config;
        
        let errorMessage = null;
        if (!hasPermission) {
          if (permissionMode === 'whitelist') {
            errorMessage = `默认笔记本 ${defaultNotebook} 不在白名单中。当前白名单: [${notebookList.join(', ')}]`;
          } else if (permissionMode === 'blacklist') {
            errorMessage = `默认笔记本 ${defaultNotebook} 在黑名单中，禁止访问`;
          } else {
            errorMessage = `无权在笔记本 ${defaultNotebook} 中操作`;
          }
        }
        
        return {
          hasPermission,
          notebookId: defaultNotebook,
          error: errorMessage
        };
      }
      
      return {
        hasPermission: false,
        notebookId: null,
        error: '无法获取笔记本ID'
      };
    }
  }

  /**
   * 权限拦截包装器
   * @param {Function} handler - 处理函数
   * @param {Object} options - 选项
   * @param {string} options.type - 权限类型 ('document' | 'parent')
   * @param {string} [options.idParam] - ID参数名
   * @param {string} [options.defaultNotebook] - 默认笔记本ID
   * @returns {Function} 包装后的处理函数
   */
  static createPermissionWrapper(handler, options) {
    return async (skill, args = {}) => {
      try {
        let permissionResult;
        
        if (options.type === 'document') {
          const docId = args[options.idParam || 'docId'];
          if (!docId) {
            return {
              success: false,
              error: '缺少必要参数',
              message: `必须提供 ${options.idParam || 'docId'} 参数`
            };
          }
          permissionResult = await this.checkDocumentPermission(skill, docId);
        } else if (options.type === 'parent') {
          const parentId = args[options.idParam || 'parentId'];
          permissionResult = await this.checkParentPermission(skill, parentId, options.defaultNotebook);
        } else {
          return {
            success: false,
            error: '无效的权限类型',
            message: '权限类型必须是 document 或 parent'
          };
        }
        
        if (!permissionResult.hasPermission) {
          return {
            success: false,
            error: '权限不足',
            message: permissionResult.error || '无权操作'
          };
        }
        
        // 调用原始处理函数，并传入 notebookId
        return await handler(skill, args, permissionResult.notebookId);
      } catch (error) {
        console.error('权限检查失败:', error);
        return {
          success: false,
          error: error.message,
          message: '权限检查失败'
        };
      }
    };
  }

  /**
   * 创建权限检查回调函数
   * 用于在列表过滤等场景中进行权限检查
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @returns {Function} 回调函数：接收notebookId，返回是否有权限
   */
  static createCheckPermissionCallback(skill) {
    return (notebookId) => {
      return skill.checkPermission(notebookId);
    };
  }
}

module.exports = Permission;