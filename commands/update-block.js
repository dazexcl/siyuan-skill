/**
 * 块更新命令
 * 在 Siyuan Notes 中更新块内容
 * 
 * 限制说明：
 * - 只接受块ID（type != 'd'）
 * - 不接受文档ID，文档更新请使用 update 命令
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
 * 验证ID是否为块ID（非文档ID）
 */
async function validateBlockId(skill, id) {
  try {
    const blockInfo = await skill.connector.request('/api/block/getBlockInfo', { id });
    
    if (!blockInfo) {
      return { isBlock: false, error: '无法获取块信息，请检查ID是否正确' };
    }
    
    if (blockInfo.rootID === id && blockInfo.path && blockInfo.path.endsWith('.sy')) {
      return { 
        isBlock: false, 
        error: `传入的ID是文档。请使用 update 命令更新文档内容` 
      };
    }
    
    return { isBlock: true };
  } catch (error) {
    return { isBlock: false, error: `验证块ID失败: ${error.message}` };
  }
}

/**
 * 命令配置
 */
const command = {
  name: 'block-update',
  aliases: ['bu'],
  description: '更新块内容（仅接受块ID，非文档ID）',
  usage: 'siyuan bu <id> <content> [--data-type <type>]',
  sortOrder: 250,
  
  initOptions: {},
  options: {
    '--data': { hasValue: true, aliases: ['--content', '-c'], description: '新内容' },
    '--file': { hasValue: true, aliases: ['-f'], description: '从文件读取内容' },
    '--data-type': { hasValue: true, description: '数据类型：markdown（默认）/dom' }
  },
  positionalCount: 2,
  
  notes: [
    '只接受块ID，不接受文档ID',
    '文档更新请使用 update 命令'
  ],
  
  examples: [
    'siyuan bu <id> "新内容"',
    'siyuan bu <id> --file ./content.md'
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
      args.data = parsed.positional[1];
    }
    if (parsed.options.id) args.id = parsed.options.id;
    if (parsed.options.data) args.data = parsed.options.data;
    if (parsed.options.file) args.file = parsed.options.file;
    if (parsed.options.dataType) args.dataType = parsed.options.dataType;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    const { content, source } = resolveContent(parsed.options, parsed.positional, 1);
    if (source !== 'none' && !executeArgs.data) {
      executeArgs.data = content;
    }
    
    if (!executeArgs.id) {
      console.error('错误: 请提供块ID');
      console.log('用法: siyuan bu <id> --data <content>');
      process.exit(1);
    }
    
    if (executeArgs.data === undefined) {
      console.error('错误: 请提供内容');
      console.log('用法: siyuan bu <id> --data <content>');
      process.exit(1);
    }
    
    console.log('更新块...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行命令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const id = args.id || args.blockId || args['block-id'];
    const data = args.data || args.content;
    const dataType = args.dataType || args['data-type'] || 'markdown';
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数（块ID）'
      };
    }
    
    if (data === undefined) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 data 参数'
      };
    }
    
    try {
      const validation = await validateBlockId(skill, id);
      
      if (!validation.isBlock) {
        return {
          success: false,
          error: '参数类型错误',
          message: validation.error
        };
      }
      
      const processedData = processContent(data);
      
      const requestData = {
        id,
        dataType,
        data: processedData
      };
      
      console.log('更新块参数:', { id, dataType, dataLength: processedData.length });
      
      const result = await skill.connector.request('/api/block/updateBlock', requestData);
      
      console.log('更新块成功:', result);
      
      if (result && Array.isArray(result) && result.length > 0) {
        const operation = result[0]?.doOperations?.[0];
        
        if (operation) {
          return {
            success: true,
            data: {
              id,
              operation: 'block-update',
              contentLength: data.length,
              timestamp: Date.now(),
              notebookId
            },
            message: '块更新成功'
          };
        }
      }
      
      if (result === null || (result && result.code === 0)) {
        return {
          success: true,
          data: {
            id,
            operation: 'block-update',
            contentLength: data.length,
            timestamp: Date.now(),
            notebookId
          },
          message: '块更新成功'
        };
      }
      
      return {
        success: false,
        error: '块更新失败',
        message: '块更新失败'
      };
    } catch (error) {
      console.error('更新块失败:', error);
      return {
        success: false,
        error: error.message,
        message: '更新块失败'
      };
    }
  }, {
    type: 'block',
    idParam: 'id'
  })
};

module.exports = command;
