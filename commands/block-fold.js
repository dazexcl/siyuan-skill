/**
 * 块折叠/展开命令
 * 在 Siyuan Notes 中折叠或展开块
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 命令配置
 */
const command = {
  name: 'block-fold',
  aliases: ['bf'],
  description: '折叠/展开块',
  usage: 'siyuan fold <id> [--action <fold|unfold>]',
  sortOrder: 220,
  
  initOptions: {},
  options: {
    '--action': { hasValue: true, aliases: ['-a'], description: '操作：fold 或 unfold，默认 fold' }
  },
  positionalCount: 1,
  
  examples: [
    'siyuan fold <id>',
    'siyuan fold <id> --action unfold',
    'siyuan bf <id> -a unfold'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.id = parsed.positional[0];
    }
    if (parsed.options.action) args.action = parsed.options.action;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.id) {
      console.error('错误: 请提供块ID');
      console.log('用法: siyuan fold <id> [--action <fold|unfold>]');
      process.exit(1);
    }
    
    console.log(`${executeArgs.action === 'unfold' ? '展开' : '折叠'}块...`);
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行命令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { id, action = 'fold' } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    const validActions = ['fold', 'unfold'];
    const normalizedAction = action.toLowerCase();
    
    if (!validActions.includes(normalizedAction)) {
      return {
        success: false,
        error: '无效的操作类型',
        message: `action 参数必须是 fold 或 unfold，当前值: ${action}`
      };
    }
    
    try {
      const apiEndpoint = normalizedAction === 'fold' 
        ? '/api/block/foldBlock' 
        : '/api/block/unfoldBlock';
      
      const result = await skill.connector.request(apiEndpoint, { id });
      
      console.log('API 响应:', JSON.stringify(result, null, 2));
      
      if (result === null || result === undefined || 
          (result && (result.code === 0 || (Array.isArray(result) && result.length > 0))) || 
          (typeof result === 'object' && result !== null && Object.keys(result).length === 0)) {
        
        return {
          success: true,
          data: {
            id,
            operation: normalizedAction,
            timestamp: Date.now(),
            notebookId
          },
          message: normalizedAction === 'fold' ? '块折叠成功' : '块展开成功'
        };
      }
      
      return {
        success: false,
        error: `块${normalizedAction === 'fold' ? '折叠' : '展开'}失败`,
        message: `块${normalizedAction === 'fold' ? '折叠' : '展开'}失败`
      };
    } catch (error) {
      console.error(`${normalizedAction === 'fold' ? '折叠' : '展开'}块失败:`, error);
      return {
        success: false,
        error: error.message,
        message: `${normalizedAction === 'fold' ? '折叠' : '展开'}块失败`
      };
    }
  }, {
    type: 'block',
    idParam: 'id'
  })
};

module.exports = command;
