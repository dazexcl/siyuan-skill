/**
 * 检查文档是否存在命令
 * 检查指定位置是否存在同名文档
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 命令配置
 */
const command = {
  name: 'exists',
  aliases: ['check'],
  description: '检查文档是否存在',
  usage: 'siyuan exists (--title <title> | --path <path>)',
  sortOrder: 100,
  
  initOptions: {},
  options: {
    '--title': { hasValue: true, aliases: ['-t'], description: '文档标题' },
    '--parent-id': { hasValue: true, aliases: ['-p'], description: '父文档ID' },
    '--notebook-id': { hasValue: true, aliases: ['-n'], description: '笔记本ID' },
    '--path': { hasValue: true, description: '文档完整路径' }
  },
  positionalCount: 1,
  
  notes: [
    'title 与 path 二选一'
  ],
  
  examples: [
    'siyuan exists --title "文档标题"',
    'siyuan exists --path "/目录/文档"'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.title = parsed.positional[0];
    }
    if (parsed.options.title) args.title = parsed.options.title;
    if (parsed.options.parentId) args.parentId = parsed.options.parentId;
    if (parsed.options.notebookId) args.notebookId = parsed.options.notebookId;
    if (parsed.options.path) args.path = parsed.options.path;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    console.log('检查文档是否存在...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  async execute(skill, args) {
    const { title, parentId, notebookId, path } = args;
    
    console.log('检查文档是否存在...');
    
    if (title && path) {
      return {
        success: false,
        error: '参数冲突',
        message: '--title 和 --path 参数只能二选一，不能同时使用'
      };
    }
    
    if (!title && !path) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 --title 或 --path 参数'
      };
    }
    
    let targetNotebookId = notebookId;
    if (!targetNotebookId) {
      if (parentId) {
        try {
          const pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: parentId });
          if (pathInfo && pathInfo.notebook) {
            targetNotebookId = pathInfo.notebook;
          }
        } catch (e) {
          console.warn(`无法从父文档 ${parentId} 获取笔记本信息: ${e.message}`);
        }
      }

      if (!targetNotebookId) {
        targetNotebookId = skill.config?.defaultNotebook || null;
      }
    }

    if (!targetNotebookId || typeof targetNotebookId !== 'string' || targetNotebookId.trim() === '') {
      return {
        success: false,
        error: '缺少笔记本ID',
        message: '请提供 --notebook-id 参数，或设置 SIYUAN_DEFAULT_NOTEBOOK 环境变量，或确保父文档ID有效'
      };
    }
    
    if (path) {
      try {
        const existingDocs = await skill.connector.request('/api/filetree/getIDsByHPath', {
          path: path,
          notebook: targetNotebookId
        });
        
        if (existingDocs && existingDocs.length > 0) {
          return {
            success: true,
            exists: true,
            data: {
              id: existingDocs[0],
              path: path,
              notebookId: targetNotebookId
            },
            message: `文档存在，ID: ${existingDocs[0]}`
          };
        }
        
        return {
          success: true,
          exists: false,
          data: {
            path: path,
            notebookId: targetNotebookId
          },
          message: '文档不存在'
        };
      } catch (error) {
        return {
          success: false,
          error: '检查失败',
          message: error.message
        };
      }
    }
    
    const result = await skill.documentManager.checkDocumentExists(
      targetNotebookId,
      parentId || targetNotebookId,
      title
    );
    
    if (result) {
      return {
        success: true,
        exists: true,
        data: result,
        message: `文档存在，ID: ${result.id}，路径: ${result.path}`
      };
    }
    
    return {
      success: true,
      exists: false,
      data: {
        title: title,
        parentId: parentId || null,
        notebookId: targetNotebookId
      },
      message: '文档不存在'
    };
  }
};

module.exports = command;
