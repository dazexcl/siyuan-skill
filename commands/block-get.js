/**
 * 获取块信息指令
 * 获取 Siyuan Notes 中块的基础信息
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 指令配置
 */
const command = {
  name: 'block-get',
  aliases: ['bg'],
  description: '获取块基础信息',
  usage: 'siyuan block <id>',
  sortOrder: 190,
  
  initOptions: {},
  options: {},
  positionalCount: 1,
  
  notes: [
    '获取块的基础信息，包括类型、路径、内容等'
  ],
  examples: [
    'siyuan block <block-id>',
    'siyuan bg <block-id>'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.id = parsed.positional[0];
    }
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.id) {
      console.error('错误: 请提供块ID');
      console.log('用法: siyuan block <id>');
      process.exit(1);
    }
    
    console.log('获取块信息...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  execute: async (skill, args = {}) => {
    const { id } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    try {
      const blockInfo = await skill.connector.request('/api/block/getBlockInfo', { id });
      
      if (!blockInfo) {
        return {
          success: false,
          error: '块不存在',
          message: `未找到 ID 对应的块：${id}`
        };
      }
      
      let content = blockInfo.content || '';
      let markdown = blockInfo.markdown || '';
      
      if (!content || !markdown) {
        try {
          const kramdownInfo = await skill.connector.request('/api/block/getBlockKramdown', { id });
          if (kramdownInfo && kramdownInfo.kramdown) {
            const kramdown = kramdownInfo.kramdown;
            const contentMatch = kramdown.match(/^(.+?)(?:\n\{:.*)?$/s);
            if (contentMatch) {
              content = contentMatch[1].trim();
            }
            markdown = kramdown;
          }
        } catch (e) {
          // kramdown 获取失败时忽略
        }
      }
      
      return {
        success: true,
        data: {
          id: blockInfo.id || id,
          rootID: blockInfo.rootID,
          parentID: blockInfo.parentID,
          type: blockInfo.type,
          subtype: blockInfo.subtype || null,
          content: content,
          markdown: markdown,
          path: blockInfo.path || null,
          hPath: blockInfo.hPath || null,
          box: blockInfo.box || null
        },
        message: '获取块信息成功'
      };
    } catch (error) {
      console.error('获取块信息失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取块信息失败'
      };
    }
  }
};

module.exports = command;
