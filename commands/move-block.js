/**
 * 块移动命令
 * 在 Siyuan Notes 中移动块
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 命令配置
 */
const command = {
  name: 'block-move',
  aliases: ['bm'],
  description: '移动块',
  usage: 'siyuan bm <id> [--parent-id <parentId>] [--previous-id <previousId>]',
  sortOrder: 240,
  
  initOptions: {},
  options: {
    '--parent-id': { hasValue: true, aliases: ['-p'], description: '目标父块ID（与位置参数2二选一）' },
    '--previous-id': { hasValue: true, description: '目标前一个块ID' }
  },
  positionalCount: 2,
  
  notes: [
    '必须提供至少一个位置参数：--parent-id 或 --previous-id',
    '第二个位置参数作为目标父块ID'
  ],
  examples: [
    'siyuan bm <block-id> <parent-id>',
    'siyuan bm <block-id> --parent-id <parent-id>',
    'siyuan bm <block-id> --previous-id <prev-id>',
    'siyuan block-move <id> <parentId>'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.id = parsed.positional[0];
    }
    if (parsed.positional.length > 1) {
      args.parentId = parsed.positional[1];
    }
    if (parsed.options.parentId) args.parentId = parsed.options.parentId;
    if (parsed.options.previousId) args.previousId = parsed.options.previousId;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.id) {
      console.error('错误: 请提供块ID');
      console.log('用法: siyuan bm <id> [--parent-id <parentId>]');
      process.exit(1);
    }
    
    if (!executeArgs.parentId && !executeArgs.previousId) {
      console.error('错误: 请提供至少一个位置参数');
      console.log('用法: siyuan bm <id> --parent-id <parentId>');
      process.exit(1);
    }
    
    console.log('移动块...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行命令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { id, parentId, previousId } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    if (!parentId && !previousId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供至少一个目标位置参数：parentId 或 previousId'
      };
    }
    
    try {
      const requestData = {
        id,
        parentID: parentId || '',
        previousID: previousId || ''
      };
      
      console.log('移动块请求参数:', JSON.stringify(requestData, null, 2));
      
      const result = await skill.connector.request('/api/block/moveBlock', requestData);
      
      console.log('API 响应:', JSON.stringify(result, null, 2));
      
      return {
        success: true,
        data: {
          id,
          operation: 'move',
          timestamp: Date.now(),
          notebookId
        },
        message: '块移动成功'
      };
    } catch (error) {
      console.error('移动块失败:', error);
      return {
        success: false,
        error: error.message,
        message: '移动块失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'id'
  })
};

module.exports = command;
