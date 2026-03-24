/**
 * 创建文档指令
 * 在 Siyuan Notes 中创建新文档
 */

const Permission = require('../utils/permission');

/**
 * 辅助函数：处理内容中的换行符
 * @param {string} content - 原始内容
 * @returns {string} 处理后的内容
 */
function processContent(content) {
  // 处理content中的换行符，将字面量\n转换为实际换行
  return content ? content.replace(/\\n/g, '\n') : '';
}

/**
 * 指令配置
 */
const command = {
  name: 'create-document',
  description: '在 Siyuan Notes 中创建新文档',
  usage: 'create-document --title <title> [--content <content>] [--force] (--parent-id <parentId> | --path <path>)',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.parentId - 父文档/笔记本ID（与 path 二选一）
   * @param {string} args.title - 文档标题
   * @param {string} args.content - 文档内容（可选）
   * @param {boolean} args.force - 是否强制创建（忽略重名检测）
   * @param {string} args.path - 文档路径（可选，与 parentId 二选一）
   * @returns {Promise<Object>} 创建结果
   */
  execute: async (skill, args = {}) => {
    const { parentId, title, content = '', force = false, path = '' } = args;
    
    if (!title) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 title 参数'
      };
    }
    
    if (parentId && path) {
      return {
        success: false,
        error: '参数冲突',
        message: '--parent-id 和 --path 参数只能二选一，不能同时使用'
      };
    }
    
    // 处理路径参数
    let effectiveParentId = parentId;
    
    if (path) {
      const pathEndsWithSlash = path.endsWith('/');
      const pathComponents = path.split('/').filter(component => component.trim() !== '');
      
      let currentParentId = skill.config.defaultNotebook;
      let createdDocId = null;
      let createdDocPath = null;
      let actualParentId = null;
      
      // 如果路径末尾有 /，需要创建中间目录，然后在其下创建标题文档
      const componentsToProcess = pathEndsWithSlash ? pathComponents.length : pathComponents.length - 1;
      // 标题优先级：1. 显式指定的 title 参数 2. 路径最后一段
      const finalTitle = title || (pathEndsWithSlash ? null : pathComponents[pathComponents.length - 1]);
      
      if (!finalTitle) {
        return {
          success: false,
          error: '缺少标题',
          message: '使用 --path "路径/" 在目录下创建时，需要提供标题参数'
        };
      }
      
      // 处理所有中间组件（创建目录结构）
      for (let i = 0; i < componentsToProcess; i++) {
        const component = pathComponents[i];
        
        try {
          const findResult = await skill.executeCommand('convert-path', {
            path: `/${pathComponents.slice(0, i + 1).join('/')}`,
            force: true
          });
          
          if (findResult.success && findResult.data) {
            currentParentId = findResult.data.id;
          } else {
            const createResult = await skill.documentManager.createDocument(
              currentParentId,
              component,
              '',
              { defaultNotebook: skill.config.defaultNotebook }
            );
            
            if (createResult.success === false) {
              return createResult;
            }
            
            if (createResult.id) {
              currentParentId = createResult.id;
            } else {
              return {
                success: false,
                error: `无法创建路径组件 "${component}"`
              };
            }
          }
        } catch (error) {
          return {
            success: false,
            error: `处理路径组件 "${component}" 时出错: ${error.message}`
          };
        }
      }
      
      // 创建最终文档前检查重名
      if (!force) {
        const fullPath = pathEndsWithSlash ? `${path}${finalTitle}` : path;
        const existCheck = await skill.executeCommand('convert-path', {
          path: fullPath,
          force: true
        });
        
        if (existCheck.success && existCheck.data) {
          return {
            success: false,
            error: '文档已存在',
            message: `文档 "${fullPath}" 已存在 (ID: ${existCheck.data.id})。使用 --force 强制创建。`,
            existingId: existCheck.data.id
          };
        }
      }
      
      // 创建最终文档
      actualParentId = currentParentId;
      const processedContent = processContent(content);
      const createResult = await skill.documentManager.createDocument(
        currentParentId,
        finalTitle,
        processedContent,
        { defaultNotebook: skill.config.defaultNotebook }
      );
      
      if (createResult.success === false) {
        return createResult;
      }
      
      if (createResult.id) {
        createdDocId = createResult.id;
        createdDocPath = pathEndsWithSlash ? `${path}${finalTitle}` : path;
      } else {
        return {
          success: false,
          error: `无法创建文档 "${finalTitle}"`
        };
      }
      
      if (createdDocId) {
        const notebookId = skill.config.defaultNotebook;
        return {
          success: true,
          data: {
            id: createdDocId,
            title: finalTitle,
            parentId: actualParentId,
            notebookId: notebookId,
            path: createdDocPath,
            contentLength: content.length
          },
          message: '文档创建成功',
          timestamp: Date.now()
        };
      }
      
      effectiveParentId = currentParentId;
    }
    
    // 如果未提供 parentId，使用默认笔记本 ID
    if (!effectiveParentId) {
      effectiveParentId = skill.config.defaultNotebook;
    }
    
    if (!effectiveParentId) {
      return {
        success: false,
        error: '未设置默认笔记本 ID',
        message: '请设置环境变量 SIYUAN_DEFAULT_NOTEBOOK 或在配置文件中设置 defaultNotebook，或使用 --parent-id 参数'
      };
    }
    
    // 使用权限包装器处理权限检查（提升到方法开头，确保所有操作都在权限检查后执行）
    // 将 effectiveParentId 保存到闭包中供权限包装器使用
    const savedParentId = effectiveParentId;
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      const { title, content = '', force = false, targetParentId } = args;
      
      // 重名检测（权限检查通过后执行）
      if (!force) {
        const existingDoc = await skill.documentManager.checkDocumentExists(
          notebookId, 
          targetParentId || notebookId, 
          title
        );
        
        if (existingDoc) {
          return {
            success: false,
            error: '文档已存在',
            message: `在目标位置已存在标题为"${title}"的文档（ID: ${existingDoc.id}），请使用 --force 参数强制创建`
          };
        }
      }
      
      try {
        let fullPath = '';
        
        const isNotebookId = effectiveParentId === notebookId;
        
        if (isNotebookId) {
          fullPath = `/${title}`;
        } else {
          let parentHPath = '';
          try {
            const hPathInfo = await skill.connector.request('/api/filetree/getHPathByID', { id: effectiveParentId });
            if (hPathInfo) {
              parentHPath = hPathInfo;
            }
          } catch (error) {
            console.warn('获取父文档hPath失败:', error.message);
          }
          fullPath = parentHPath ? `${parentHPath}/${title}` : `/${title}`;
        }
        
        // 处理内容中的换行符
        const formattedContent = processContent(content);
        
        // 使用createDocWithMd API创建文档
        const createResult = await skill.connector.request('/api/filetree/createDocWithMd', {
          notebook: notebookId,
          path: fullPath,
          markdown: formattedContent
        });
        
        if (createResult) {
          return {
            success: true,
            data: {
              id: createResult,
              title,
              parentId: effectiveParentId,
              notebookId: notebookId,
              path: fullPath,
              contentLength: formattedContent.length
            },
            message: '文档创建成功',
            timestamp: Date.now()
          };
        }
        
        // API返回null，检查是否真的创建成功
        console.warn('API返回null，检查文档是否真的创建成功');
        
        // 等待一小段时间，确保文档创建完成
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // 使用搜索 API 查找包含标题的文档
        const searchParams = {
          keyword: title,
          limit: 5
        };
        
        const searchResult = await skill.connector.request('/api/search/search', searchParams);
        
        if (searchResult && searchResult.length > 0) {
          console.log('找到包含标题的文档:', searchResult);
          return {
            success: true,
            data: {
              id: searchResult[0].id,
              title,
              parentId: effectiveParentId,
              notebookId: notebookId,
              path: fullPath,
              contentLength: formattedContent.length
            },
            message: '文档创建成功（通过搜索找到）',
            timestamp: Date.now()
          };
        }
        
        // 获取笔记本的文档结构，查找最近创建的文档
        const docStructure = await skill.connector.request('/api/filetree/getDocStructure', {
          notebook: notebookId
        });
        
        if (docStructure && docStructure.documents && docStructure.documents.length > 0) {
          // 按更新时间排序，返回最新的文档
          const sortedDocs = docStructure.documents.sort((a, b) => {
            return new Date(b.updated || 0) - new Date(a.updated || 0);
          });
          
          if (sortedDocs.length > 0) {
            console.log('找到笔记本中的文档:', sortedDocs[0]);
            return {
              success: true,
              data: {
                id: sortedDocs[0].id,
                title: sortedDocs[0].title || title,
                parentId: effectiveParentId,
                notebookId: notebookId,
                path: sortedDocs[0].path || fullPath,
                contentLength: formattedContent.length
              },
              message: '文档创建成功（通过文档结构找到）',
              timestamp: Date.now()
            };
          }
        }
        
        // 如果所有搜索都失败，返回错误
        const errorMessage = `文档创建失败：API返回null，且无法通过搜索找到创建的文档。\n` +
          `请检查：\n` +
          `1. API令牌是否正确\n` +
          `2. 笔记本ID是否有效\n` +
          `3. 服务器是否允许创建文档\n` +
          `4. Siyuan Notes版本是否兼容`;
        
        console.error(errorMessage);
        return {
          success: false,
          error: errorMessage,
          message: '文档创建失败'
        };
      } catch (error) {
        console.error('创建文档失败:', error);
        return {
          success: false,
          error: error.message,
          message: '创建文档失败'
        };
      }
    }, {
      type: 'parent',
      idParam: 'parentId',
      defaultNotebook: skill.config.defaultNotebook
    });
    
    return permissionHandler(skill, { ...args, parentId: effectiveParentId, targetParentId: savedParentId });
  }
};

module.exports = command;