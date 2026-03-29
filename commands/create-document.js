/**
 * 创建文档指令
 * 在 Siyuan Notes 中创建新文档
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp, resolveContent } = require('../lib/cli-base');

/**
 * 处理内容中的换行符
 */
function processContent(content) {
  return content ? content.replace(/\\n/g, '\n') : '';
}

/**
 * 指令配置
 */
const command = {
  name: 'create',
  aliases: ['new'],
  description: '创建新文档',
  usage: 'siyuan create <title> [--parent-id <id> | --path <path>]',
  sortOrder: 60,
  
  initOptions: {},
  options: {
    '--title': { hasValue: true, aliases: ['-t'], description: '文档标题' },
    '--content': { hasValue: true, aliases: ['-c'], description: '文档内容' },
    '--file': { hasValue: true, aliases: ['-f'], description: '从文件读取内容' },
    '--parent-id': { hasValue: true, aliases: ['-p'], description: '父文档/笔记本ID' },
    '--path': { hasValue: true, aliases: ['-P'], description: '文档路径' },
    '--force': { isFlag: true, description: '强制创建（忽略重名检测）' }
  },
  positionalCount: 2,
  
  notes: [
    '第一个位置参数为标题，第二个为内容（可选）',
    'parent-id 和 path 二选一',
    'path 末尾带 / 表示在目录下创建标题文档'
  ],
  
  examples: [
    'siyuan create "标题" --parent-id <id>',
    'siyuan create "标题" --path "/笔记本/目录/"',
    'siyuan create "标题" "内容" -p <id>'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.title = parsed.positional[0];
    }
    if (parsed.positional.length > 1) {
      args.content = parsed.positional[1];
    }
    if (parsed.options.title) args.title = parsed.options.title;
    if (parsed.options.content) args.content = parsed.options.content;
    if (parsed.options.file) args.file = parsed.options.file;
    if (parsed.options.parentId) args.parentId = parsed.options.parentId;
    if (parsed.options.path) args.path = parsed.options.path;
    if (parsed.options.force) args.force = true;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    const { content, source } = resolveContent(parsed.options, parsed.positional, 1);
    if (source !== 'none' && !executeArgs.content) {
      executeArgs.content = content;
    }
    
    if (!executeArgs.title) {
      console.error('错误: 请提供文档标题');
      console.log('用法: siyuan create <title> [options]');
      process.exit(1);
    }
    
    if (executeArgs.parentId && executeArgs.path) {
      console.error('错误: --parent-id 和 --path 不能同时使用');
      process.exit(1);
    }
    
    console.log('创建文档...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
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
    
    let effectiveParentId = parentId;
    
    if (path) {
      const pathEndsWithSlash = path.endsWith('/');
      const pathComponents = path.split('/').filter(component => component.trim() !== '');
      
      let currentParentId = skill.config.defaultNotebook;
      let createdDocId = null;
      let createdDocPath = null;
      let actualParentId = null;
      
      const componentsToProcess = pathEndsWithSlash ? pathComponents.length : pathComponents.length - 1;
      const finalTitle = title || (pathEndsWithSlash ? null : pathComponents[pathComponents.length - 1]);
      
      if (!finalTitle) {
        return {
          success: false,
          error: '缺少标题',
          message: '使用 --path "路径/" 在目录下创建时，需要提供标题参数'
        };
      }
      
      for (let i = 0; i < componentsToProcess; i++) {
        const component = pathComponents[i];
        
        try {
          const findResult = await skill.executeCommand('convert', {
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
              try {
                await skill.documentManager.setBlockAttrs(createResult.id, { icon: '1f5c2' });
              } catch (iconError) {
                console.warn(`为中间目录 "${component}" 设置图标失败:`, iconError.message);
              }
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
      
      if (!force) {
        const fullPath = pathEndsWithSlash ? `${path}${finalTitle}` : path;
        const existCheck = await skill.executeCommand('convert', {
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
    
    const savedParentId = effectiveParentId;
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      const { title, content = '', force = false, targetParentId } = args;
      
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
        
        const formattedContent = processContent(content);
        
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
        
        console.warn('API返回null，检查文档是否真的创建成功');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
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
        
        const docStructure = await skill.connector.request('/api/filetree/getDocStructure', {
          notebook: notebookId
        });
        
        if (docStructure && docStructure.documents && docStructure.documents.length > 0) {
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
