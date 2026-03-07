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
  usage: 'create-document --parent-id <parentId> --title <title> [--content <content>] [--force] [--path <path>]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.parentId - 父文档/笔记本ID
   * @param {string} args.title - 文档标题
   * @param {string} args.content - 文档内容（可选）
   * @param {boolean} args.force - 是否强制创建（忽略重名检测）
   * @param {string} args.path - 文档路径（可选，支持绝对路径或相对路径）
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
    
    // 处理路径参数
    let effectiveParentId = parentId;
    
    if (path) {
      // 递归创建路径文档
      const pathComponents = path.split('/').filter(component => component.trim() !== '');
      
      // 首先从技能配置获取默认笔记本，其次使用环境变量
      let currentParentId = skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK;
      
      for (let i = 0; i < pathComponents.length; i++) {
        const component = pathComponents[i];
        const isLastComponent = i === pathComponents.length - 1;
        const isSecondLast = i === pathComponents.length - 2;
        
        // 尝试查找当前路径下是否存在该文档
        try {
          const findResult = await skill.executeCommand('convert-path', {
            path: `/${pathComponents.slice(0, i + 1).join('/')}`,
            force: true
          });
          
          if (findResult.success && findResult.data) {
            currentParentId = findResult.data.id;
          } else {
            // 只有最后一个组件才创建文档，前面的组件只创建文件夹
            if (isLastComponent) {
              // 使用实际内容创建文档，处理换行符
              const processedContent = processContent(content);
              const createResult = await skill.documentManager.createDocument(
                currentParentId,
                component,
                processedContent
              );
              
              if (createResult.id) {
                currentParentId = createResult.id;
              } else {
                return {
                  success: false,
                  error: `无法创建路径组件 "${component}"`
                };
              }
            } else {
              // 中间组件创建文件夹（使用占位内容）
              const createResult = await skill.documentManager.createDocument(
                currentParentId,
                component,
                `# ${component}\n\n`
              );
              
              if (createResult.id) {
                currentParentId = createResult.id;
              } else {
                return {
                  success: false,
                  error: `无法创建路径组件 "${component}"`
                };
              }
            }
          }
        } catch (error) {
          return {
            success: false,
            error: `处理路径组件 "${component}" 时出错: ${error.message}`
          };
        }
      }
      
      // 设置最终的父ID：如果最后一个组件存在，使用它的ID作为父ID；否则使用倒数第二个组件的ID作为父ID
      const lastComponentIndex = pathComponents.length - 1;
      const secondLastComponentIndex = pathComponents.length - 2;
      
      // 检查最后一个组件是否存在
      const lastComponentExists = await skill.executeCommand('convert-path', {
        path: `/${pathComponents.slice(0, lastComponentIndex + 1).join('/')}`,
        force: true
      });
      
      if (lastComponentExists.success && lastComponentExists.data) {
        // 最后一个组件存在，使用它的ID作为父ID
        effectiveParentId = lastComponentExists.data.id;
      } else if (secondLastComponentIndex >= 0) {
        // 最后一个组件不存在，使用倒数第二个组件的ID作为父ID
        const secondLastComponentExists = await skill.executeCommand('convert-path', {
          path: `/${pathComponents.slice(0, secondLastComponentIndex + 1).join('/')}`,
          force: true
        });
        
        if (secondLastComponentExists.success && secondLastComponentExists.data) {
          // 使用倒数第二个组件的ID作为父ID
          effectiveParentId = secondLastComponentExists.data.id;
        }
      }
    }
    
    // 如果未提供 parentId，使用默认笔记本 ID
    if (!effectiveParentId) {
      effectiveParentId = skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK;
    }
    
    if (!effectiveParentId) {
      return {
        success: false,
        error: '未设置默认笔记本 ID',
        message: '请设置环境变量 SIYUAN_DEFAULT_NOTEBOOK 或在配置文件中设置 defaultNotebook，或使用 --parent-id 参数'
      };
    }
    
    // 使用权限包装器处理权限检查（提升到方法开头，确保所有操作都在权限检查后执行）
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      const { title, content = '', force = false } = args;
      
      // 重名检测（权限检查通过后执行）
      if (!force) {
        try {
          // 使用 /api/file/readDir 接口获取笔记本目录下的文件列表
          const notebookPath = `/data/${notebookId}`;
          const files = await skill.connector.request('/api/file/readDir', { path: notebookPath });
          
          if (files && Array.isArray(files)) {
            // 检查是否存在同名文档文件
            for (const file of files) {
              if (!file.isDir && file.name.endsWith('.sy')) {
                const docName = file.name.replace('.sy', '');
                
                // 尝试获取文档标题
                try {
                  // 构建文档ID（假设文件名就是文档ID）
                  const docId = docName;
                  const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id: docId });
                  if (attrs && attrs.title === title) {
                    return {
                      success: false,
                      error: '文档已存在',
                      message: `已存在标题为"${title}"的文档，请使用 --force 参数强制创建`
                    };
                  }
                } catch (error) {
                  // 忽略错误
                }
              }
            }
          }
        } catch (error) {
          // 检测失败不阻止创建，继续执行
        }
      }
      
      try {
        // 尝试获取父文档的hPath
        let parentHPath = '';
        try {
          const hPathInfo = await skill.connector.request('/api/filetree/getHPathByID', { id: effectiveParentId });
          if (hPathInfo) {
            parentHPath = hPathInfo;
            console.log('父文档的hPath:', parentHPath);
          }
        } catch (error) {
          console.warn('获取父文档hPath失败:', error.message);
        }
        
        // 构建完整的路径
        const fullPath = parentHPath ? `${parentHPath}/${title}` : `/${title}`;
        
        // 处理内容中的换行符
        const formattedContent = processContent(content);
        
        // 使用createDocWithMd API创建文档
        const createResult = await skill.connector.request('/api/filetree/createDocWithMd', {
          notebook: notebookId,
          path: fullPath,
          markdown: formattedContent
        });
        
        // 清除缓存
        skill.clearCache();
        
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
      defaultNotebook: skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK
    });
    
    return permissionHandler(skill, { ...args, parentId: effectiveParentId });
  }
};

module.exports = command;