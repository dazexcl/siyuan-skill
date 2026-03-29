/**
 * 获取文档内容指令
 * 获取指定文档的内容，支持多种格式
 */

const Permission = require('../utils/permission');
const { pathToId } = require('./convert-path');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 指令配置
 */
const command = {
  name: 'content',
  aliases: ['cat'],
  description: '获取文档内容',
  usage: 'siyuan content [<docId>] [--path <path>]',
  sortOrder: 30,
  
  initOptions: {},
  options: {
    '--path': { hasValue: true, aliases: ['-P'], description: '文档路径' },
    '--format': { hasValue: true, aliases: ['-F'], description: '输出格式：kramdown、markdown、text、html' },
    '--raw': { isFlag: true, aliases: ['-r'], description: '纯文本格式返回' }
  },
  positionalCount: 1,
  
  notes: [
    '位置参数为文档ID，或用 --path 指定路径'
  ],
  
  examples: [
    'siyuan content <id>',
    'siyuan content --path "/目录/文档"',
    'siyuan cat <id> --format text'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.docId = parsed.positional[0];
    }
    if (parsed.options.docId) args.docId = parsed.options.docId;
    if (parsed.options.path) args.path = parsed.options.path;
    if (parsed.options.format) args.format = parsed.options.format;
    if (parsed.options.raw) args.raw = true;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.docId && !executeArgs.path) {
      console.error('错误: 请提供 --doc-id 或 --path 参数');
      console.log('用法: siyuan content (--doc-id <docId> | --path <path>) [--format <format>] [--raw]');
      process.exit(1);
    }
    
    console.log('获取文档内容...');
    const result = await this.execute(skill, executeArgs);
    
    if (typeof result === 'string') {
      console.log(result);
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  },
  
  /**
   * 执行指令
   */
  execute: async (skill, args = {}) => {
    let { docId, path, format = 'kramdown', raw = false } = args;
    
    if (docId && path) {
      return {
        success: false,
        error: '参数冲突',
        message: '--doc-id 和 --path 参数只能二选一，不能同时使用'
      };
    }
    
    if (!docId && !path) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 --doc-id 或 --path 参数'
      };
    }
    
    const validFormats = ['kramdown', 'markdown', 'text', 'html'];
    if (!validFormats.includes(format)) {
      return {
        success: false,
        error: '无效的格式参数',
        message: `format 必须是以下之一: ${validFormats.join(', ')}`
      };
    }
    
    try {
      if (path) {
        const defaultNb = skill.config.defaultNotebook;
        const pathResult = await pathToId(skill.connector, path, true, defaultNb);
        
        if (!pathResult.success) {
          return {
            success: false,
            error: pathResult.error,
            message: pathResult.message
          };
        }
        
        if (pathResult.data.type === 'notebook') {
          return {
            success: false,
            error: '参数错误',
            message: `路径 "${path}" 指向笔记本，不是文档`
          };
        }
        
        docId = pathResult.data.id;
      }
      
      const permCheck = await Permission.checkDocumentPermission(skill, docId);
      if (!permCheck.hasPermission) {
        const isNotFound = permCheck.reason === 'not_found' || 
                           (permCheck.error && permCheck.error.includes('不存在'));
        return {
          success: false,
          error: isNotFound ? '资源不存在' : '权限不足',
          message: permCheck.error,
          reason: isNotFound ? 'not_found' : 'permission_denied'
        };
      }
      const notebookId = permCheck.notebookId;
      
      if (format === 'kramdown') {
        const kramdownResult = await skill.connector.request('/api/block/getBlockKramdown', { id: docId });
        
        if (!kramdownResult || !kramdownResult.kramdown) {
          return {
            success: false,
            error: '文档内容为空',
            message: '未找到文档 kramdown 内容'
          };
        }
        
        const content = kramdownResult.kramdown;
        
        if (raw) {
          return content;
        }
        
        return {
          success: true,
          data: {
            id: docId,
            format: 'kramdown',
            content: content,
            length: content.length,
            metadata: {
              notebookId,
              blockId: kramdownResult.id
            }
          },
          timestamp: Date.now()
        };
      }
      
      const result = await skill.connector.request('/api/export/exportMdContent', { id: docId });
      
      if (!result || !result.content) {
        return {
          success: false,
          error: '文档内容为空',
          message: '未找到文档内容'
        };
      }
      
      let content = result.content;
      let formattedContent = content;
      
      if (format === 'text') {
        formattedContent = markdownToText(content);
      } else if (format === 'html') {
        formattedContent = markdownToHtml(content);
      }
      
      if (raw) {
        return formattedContent;
      }
      
      return {
        success: true,
        data: {
          id: docId,
          hPath: result.hPath || '',
          format,
          content: formattedContent,
          originalLength: content.length,
          formattedLength: formattedContent.length,
          metadata: {
            notebookId,
            path: result.hPath
          }
        },
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('获取文档内容失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取文档内容失败'
      };
    }
  }
};

/**
 * Markdown 转纯文本
 */
function markdownToText(markdown) {
  return markdown
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^-\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Markdown 转 HTML
 */
function markdownToHtml(markdown) {
  return markdown
    .replace(/#{6}\s(.*?)$/gm, '<h6>$1</h6>')
    .replace(/#{5}\s(.*?)$/gm, '<h5>$1</h5>')
    .replace(/#{4}\s(.*?)$/gm, '<h4>$1</h4>')
    .replace(/#{3}\s(.*?)$/gm, '<h3>$1</h3>')
    .replace(/#{2}\s(.*?)$/gm, '<h2>$1</h2>')
    .replace(/#{1}\s(.*?)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^-\s(.*?)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>')
    .replace(/^\d+\.\s(.*?)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>)/s, '<ol>$1</ol>')
    .replace(/\n/g, '<br>');
}

module.exports = command;
