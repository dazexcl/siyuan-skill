/**
 * 转移块引用命令
 * 在 Siyuan Notes 中转移块引用
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 解析引用ID列表
 */
function parseRefIds(refIdsStr) {
  if (!refIdsStr) return [];
  return refIdsStr.split(',').map(id => id.trim()).filter(id => id.length > 0);
}

/**
 * 命令配置
 */
const command = {
  name: 'block-transfer',
  aliases: ['bt'],
  description: '转移块引用',
  usage: 'siyuan bt --from <id> --to <id>',
  sortOrder: 260,
  
  initOptions: {},
  options: {
    '--from-id': { hasValue: true, aliases: ['--from'], description: '定义块ID' },
    '--to-id': { hasValue: true, aliases: ['--to'], description: '目标块ID' },
    '--ref-ids': { hasValue: true, description: '引用块ID（逗号分隔）' }
  },
  positionalCount: 0,
  
  examples: [
    'siyuan bt --from <id1> --to <id2>',
    'siyuan bt --from <id1> --to <id2> --ref-ids <id3>'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.options.fromId) args.fromId = parsed.options.fromId;
    if (parsed.options.toId) args.toId = parsed.options.toId;
    if (parsed.options.refIds) args.refIds = parsed.options.refIds;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.fromId || !executeArgs.toId) {
      console.error('错误: 请提供 --from-id 和 --to-id 参数');
      console.log('用法: siyuan transfer --from-id <fromId> --to-id <toId>');
      process.exit(1);
    }
    
    console.log('转移块引用...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行命令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { fromId, toId, refIds } = args;
    
    if (!fromId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 from-id 参数'
      };
    }
    
    if (!toId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 to-id 参数'
      };
    }
    
    try {
      const requestData = {
        fromID: fromId,
        toID: toId
      };
      
      const refIdsArray = parseRefIds(refIds);
      if (refIdsArray.length > 0) {
        requestData.refIDs = refIdsArray;
      }
      
      const result = await skill.connector.request('/api/block/transferBlockRef', requestData);
      
      console.log('API 响应:', JSON.stringify(result, null, 2));
      
      if (result === null || result === undefined || 
          (result && (result.code === 0 || (Array.isArray(result) && result.length > 0))) || 
          (typeof result === 'object' && result !== null && Object.keys(result).length === 0)) {
        
        return {
          success: true,
          data: {
            fromId,
            toId,
            refIds: refIdsArray,
            operation: 'transfer',
            timestamp: Date.now(),
            notebookId
          },
          message: '块引用转移成功'
        };
      }
      
      return {
        success: false,
        error: '块引用转移失败',
        message: '块引用转移失败'
      };
    } catch (error) {
      console.error('转移块引用失败:', error);
      return {
        success: false,
        error: error.message,
        message: '转移块引用失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'fromId'
  })
};

module.exports = command;
