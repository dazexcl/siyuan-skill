/**
 * 文档更新命令
 * 在 Siyuan Notes 中更新文档内容
 * 
 * 限制说明：
 * - 只接受文档ID（type='d'）
 * - 不接受块ID，块更新请使用 block-update 命令
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
 * 验证ID是否为文档ID
 */
async function validateDocId(skill, id) {
  try {
    const blockInfo = await skill.connector.request('/api/block/getBlockInfo', { id });
    
    if (!blockInfo) {
      return { isDoc: false, error: '无法获取文档信息，请检查ID是否正确' };
    }
    
    if (blockInfo.rootID === id && blockInfo.path && blockInfo.path.endsWith('.sy')) {
      return { isDoc: true };
    }
    
    if (blockInfo.rootID !== id) {
      return { 
        isDoc: false, 
        error: `传入的ID是子块，不是文档。请使用 block-update 命令更新块内容` 
      };
    }
    
    return { isDoc: true };
  } catch (error) {
    return { isDoc: false, error: `验证文档ID失败: ${error.message}` };
  }
}

/**
 * 命令配置
 */
const command = {
  name: 'update',
  aliases: ['edit'],
  description: '更新文档内容（仅接受文档ID）',
  usage: 'siyuan update <docId> <content> [--data-type <type>]',
  sortOrder: 70,
  
  initOptions: {},
  options: {
    '--content': { hasValue: true, aliases: ['-c'], description: '新内容' },
    '--file': { hasValue: true, aliases: ['-f'], description: '从文件读取内容' },
    '--data-type': { hasValue: true, description: '数据类型：markdown（默认）/dom' }
  },
  positionalCount: 2,
  
  notes: [
    '仅支持文档ID，块更新请用 block-update'
  ],
  
  examples: [
    'siyuan update <id> "新内容"',
    'siyuan update <id> --file ./content.md'
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
      args.content = parsed.positional[1];
    }
    if (parsed.options.docId) args.docId = parsed.options.docId;
    if (parsed.options.content) args.content = parsed.options.content;
    if (parsed.options.file) args.file = parsed.options.file;
    if (parsed.options.dataType) args.dataType = parsed.options.dataType;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.docId) {
      console.error('错误: 请提供文档ID');
      console.log('用法: siyuan update <docId> --content <content>');
      process.exit(1);
    }
    
    const { content, source } = resolveContent(parsed.options, parsed.positional, 1);
    if (source !== 'none' && !executeArgs.content) {
      executeArgs.content = content;
      if (source !== 'argument') {
        console.log(`内容来源: ${source}${content ? ` (${content.length} 字符)` : ''}`);
      }
    }
    
    if (executeArgs.content === undefined) {
      console.error('错误: 请提供内容');
      console.log('用法: siyuan update <docId> --content <content> 或 --file <file>');
      process.exit(1);
    }
    
    console.log('更新文档...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行命令
   */
  execute: async (skill, args = {}) => {
    const docId = args.docId || args['doc-id'] || args.id;
    const content = args.content || args.data;
    const dataType = args.dataType || args['data-type'] || 'markdown';
    
    if (!docId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 docId 参数'
      };
    }
    
    if (content === undefined) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 content 参数'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        const validation = await validateDocId(skill, docId);
        
        if (!validation.isDoc) {
          return {
            success: false,
            error: '参数类型错误',
            message: validation.error
          };
        }
        
        const processedContent = processContent(content);
        
        const requestData = {
          id: docId,
          dataType,
          data: processedContent
        };
        
        console.log('更新文档参数:', { docId, dataType, contentLength: processedContent.length });
        
        const result = await skill.connector.request('/api/block/updateBlock', requestData);
        
        console.log('更新文档成功:', result);
        
        if (result && Array.isArray(result) && result.length > 0) {
          const operation = result[0]?.doOperations?.[0];
          
          if (operation) {
            return {
              success: true,
              data: {
                docId,
                operation: 'update-document',
                contentLength: content.length,
                timestamp: Date.now(),
                notebookId
              },
              message: '文档更新成功'
            };
          }
        }
        
        if (result === null || (result && result.code === 0)) {
          return {
            success: true,
            data: {
              docId,
              operation: 'update-document',
              contentLength: content.length,
              timestamp: Date.now(),
              notebookId
            },
            message: '文档更新成功'
          };
        }
        
        return {
          success: false,
          error: '文档更新失败',
          message: '文档更新失败'
        };
      } catch (error) {
        console.error('更新文档失败:', error);
        return {
          success: false,
          error: error.message,
          message: '更新文档失败'
        };
      }
    }, {
      type: 'document',
      idParam: 'docId',
      defaultNotebook: skill.config.defaultNotebook
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
