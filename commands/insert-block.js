/**
 * 插入块指令
 * 在 Siyuan Notes 中插入新块
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
  name: 'block-insert',
  aliases: ['bi'],
  description: '插入新块',
  usage: 'siyuan insert <content> --parent-id <parentId>',
  sortOrder: 210,
  
  initOptions: {},
  options: {
    '--data': { hasValue: true, aliases: ['--content', '-c'], description: '块内容' },
    '--file': { hasValue: true, aliases: ['-f'], description: '从文件读取内容' },
    '--parent-id': { hasValue: true, aliases: ['-p'], description: '父块ID' },
    '--previous-id': { hasValue: true, description: '插入到此块之后' },
    '--next-id': { hasValue: true, description: '插入到此块之前' },
    '--data-type': { hasValue: true, description: '数据类型：markdown（默认）/dom' }
  },
  positionalCount: 1,
  
  notes: [
    '必须提供 parent-id、previous-id 或 next-id 之一'
  ],
  
  examples: [
    'siyuan insert "内容" --parent-id <id>',
    'siyuan insert --file ./content.md -p <id>'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.data = parsed.positional[0];
    }
    if (parsed.options.data) args.data = parsed.options.data;
    if (parsed.options.file) args.file = parsed.options.file;
    if (parsed.options.parentId) args.parentId = parsed.options.parentId;
    if (parsed.options.previousId) args.previousId = parsed.options.previousId;
    if (parsed.options.nextId) args.nextId = parsed.options.nextId;
    if (parsed.options.dataType) args.dataType = parsed.options.dataType;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    const { content, source } = resolveContent(parsed.options, parsed.positional, 0);
    if (source !== 'none' && !executeArgs.data) {
      executeArgs.data = content;
    }
    
    if (!executeArgs.data) {
      console.error('错误: 请提供块内容');
      console.log('用法: siyuan insert <content> --parent-id <parentId>');
      process.exit(1);
    }
    
    if (!executeArgs.parentId && !executeArgs.previousId && !executeArgs.nextId) {
      console.error('错误: 请提供至少一个位置参数');
      console.log('用法: siyuan insert <content> --parent-id <parentId>');
      process.exit(1);
    }
    
    console.log('插入块...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行命令
   */
  execute: async (skill, args = {}) => {
    const { data, dataType = 'markdown', parentId, previousId, nextId } = args;
    
    if (!data) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 content 参数'
      };
    }
    
    if (!parentId && !previousId && !nextId) {
      return {
        success: false,
        error: '缺少位置参数',
        message: '必须提供至少一个位置参数: --parent-id, --previous-id, --next-id'
      };
    }
    
    const idForPermission = parentId || previousId || nextId;
    const permissionType = parentId ? 'parent' : 'block';
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        const processedData = processContent(data);
        
        const requestData = {
          dataType,
          data: processedData,
          parentID: parentId || '',
          previousID: previousId || '',
          nextID: nextId || ''
        };
        
        console.log('请求参数:', JSON.stringify(requestData, null, 2));
        const result = await skill.connector.request('/api/block/insertBlock', requestData);
        console.log('API 响应:', JSON.stringify(result, null, 2));
        
        let blockId = null;
        if (result && Array.isArray(result) && result.length > 0) {
          const operation = result[0]?.doOperations?.[0];
          blockId = operation?.id;
        }
        
        return {
          success: true,
          data: {
            id: blockId,
            operation: 'insert',
            timestamp: Date.now(),
            notebookId
          },
          message: blockId ? '块插入成功' : '块插入成功（未返回块ID）'
        };
      } catch (error) {
        console.error('插入块失败:', error);
        return {
          success: false,
          error: error.message,
          message: '插入块失败'
        };
      }
    }, {
      type: permissionType,
      idParam: parentId ? 'parentId' : (previousId ? 'previousId' : 'nextId'),
      defaultNotebook: skill.config.defaultNotebook
    });
    
    return permissionHandler(skill, { ...args, idForPermission: idForPermission });
  }
};

module.exports = command;
