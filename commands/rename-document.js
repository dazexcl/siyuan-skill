/**
 * 重命名文档指令
 * 重命名 Siyuan Notes 中的文档标题
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 指令配置
 */
const command = {
  name: 'rename',
  aliases: ['rn'],
  description: '重命名文档标题',
  usage: 'siyuan rename <docId> <title> [--force]',
  sortOrder: 90,
  
  initOptions: {},
  options: {
    '--title': { hasValue: true, aliases: ['-t'], description: '新标题（与位置参数2二选一）' },
    '--force': { isFlag: true, description: '强制重命名（跳过重名检测）' }
  },
  positionalCount: 2,
  
  notes: [
    '重名检测默认开启，使用 --force 跳过',
    '第二个位置参数作为新标题'
  ],
  examples: [
    'siyuan rename <doc-id> "新标题"',
    'siyuan rename <doc-id> --title "新标题"',
    'siyuan rename <doc-id> -t "新标题" --force',
    'siyuan rn <doc-id> "新标题"'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.docId = parsed.positional[0];
    }
    if (parsed.positional.length > 1) {
      args.title = parsed.positional[1];
    }
    if (parsed.options.title) args.title = parsed.options.title;
    if (parsed.options.force) args.force = true;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.docId) {
      console.error('错误: 请提供文档ID');
      console.log('用法: siyuan rename <docId> --title <title>');
      process.exit(1);
    }
    
    if (!executeArgs.title) {
      console.error('错误: 请提供新标题');
      console.log('用法: siyuan rename <docId> --title <title>');
      process.exit(1);
    }
    
    console.log('重命名文档...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, title, force } = args;
    
    if (!docId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 docId 参数'
      };
    }
    
    if (!title) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 title 参数'
      };
    }
    
    if (!force) {
      try {
        const hPath = await skill.connector.request('/api/filetree/getHPathByID', { id: docId });
        let parentId = notebookId;
        
        if (hPath && hPath !== '/') {
          const pathParts = hPath.split('/');
          pathParts.pop();
          const parentHPath = pathParts.join('/');
          
          if (parentHPath) {
            const parentIds = await skill.connector.request('/api/filetree/getIDsByHPath', {
              path: parentHPath,
              notebook: notebookId
            });
            if (parentIds && parentIds.length > 0) {
              parentId = parentIds[0];
            }
          }
        }
        
        const existingDoc = await skill.documentManager.checkDocumentExists(
          notebookId,
          parentId,
          title,
          docId
        );
        
        if (existingDoc) {
          return {
            success: false,
            error: '文档名称冲突',
            message: `在目标位置已存在标题为"${title}"的文档（ID: ${existingDoc.id}），请使用 --force 参数强制重命名`
          };
        }
      } catch (error) {
        console.warn('重名检测失败:', error.message);
      }
    }
    
    try {
      console.log('重命名文档参数:', { docId, title });
      
      const result = await skill.connector.request('/api/filetree/renameDocByID', {
        id: docId,
        title: title
      });
      
      console.log('重命名文档成功:', result);
      
      return {
        success: true,
        data: {
          id: docId,
          title: title,
          renamed: true,
          notebookId
        },
        message: '文档重命名成功',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('重命名文档失败:', error);
      return {
        success: false,
        error: error.message,
        message: '重命名文档失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

module.exports = command;
