/**
 * 文档信息查询命令
 * 获取文档的基础信息，包括ID、标题、路径、属性等
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 命令配置
 */
const command = {
  name: 'info',
  description: '获取文档基础信息（ID、标题、路径、属性）',
  usage: 'siyuan info <docId>',
  sortOrder: 40,
  
  initOptions: {},
  options: {
    '--format': { hasValue: true, aliases: ['-F'], description: '输出格式：summary（默认）、json' }
  },
  positionalCount: 1,
  
  notes: [
    '仅支持文档ID，不支持笔记本ID'
  ],
  
  examples: [
    'siyuan info <id>',
    'siyuan info <id> --format json'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.id = parsed.positional[0];
    }
    if (parsed.options.id) args.id = parsed.options.id;
    if (parsed.options.format) args.format = parsed.options.format;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.id) {
      console.error('错误: 请提供文档ID');
      console.log('用法: siyuan info <docId> [--format <format>]');
      process.exit(1);
    }
    
    console.log('获取文档信息...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行命令
   */
  execute: async (skill, args = {}) => {
    const { id, format = 'summary' } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        console.log('获取文档信息:', { id, format });
        
        let pathInfo;
        try {
          pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id });
        } catch (pathError) {
          if (pathError.message && pathError.message.includes('tree not found')) {
            const notebooksResult = await skill.connector.request('/api/notebook/lsNotebooks', {});
            if (notebooksResult && notebooksResult.notebooks) {
              const notebook = notebooksResult.notebooks.find(nb => nb.id === id);
              if (notebook) {
                return {
                  success: false,
                  error: '参数类型错误',
                  message: `"${id}" 是笔记本ID，不是文档ID。info 命令仅支持文档ID。`,
                  hint: `笔记本名称: ${notebook.name}`,
                  reason: 'wrong_id_type'
                };
              }
            }
            return {
              success: false,
              error: '文档不存在',
              message: `未找到 ID 对应的文档：${id}`,
              reason: 'not_found'
            };
          }
          throw pathError;
        }
        
        if (!pathInfo || !pathInfo.notebook) {
          return {
            success: false,
            error: '文档不存在',
            message: `未找到 ID 对应的文档：${id}`,
            reason: 'not_found'
          };
        }
        
        const hPath = await skill.connector.request('/api/filetree/getHPathByID', { id });
        
        const notebooksResult = await skill.connector.request('/api/notebook/lsNotebooks', {});
        let notebookName = null;
        if (notebooksResult && notebooksResult.notebooks) {
          for (const nb of notebooksResult.notebooks) {
            if (nb.id === pathInfo.notebook) {
              notebookName = nb.name;
              break;
            }
          }
        }
        
        const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id });
        
        const customAttrs = {};
        const tags = [];
        const rawAttrs = {};
        if (attrs) {
          for (const [key, value] of Object.entries(attrs)) {
            rawAttrs[key] = value;
            if (key.startsWith('custom-')) {
              customAttrs[key.replace('custom-', '')] = value;
            }
          }
          if (attrs.tags) {
            const tagValue = attrs.tags;
            if (typeof tagValue === 'string' && tagValue) {
              tags.push(...tagValue.split(',').map(t => t.trim()).filter(Boolean));
            }
          }
        }
        
        const docInfo = {
          id: id,
          title: attrs?.title || null,
          type: attrs?.type || 'doc',
          notebook: {
            id: pathInfo.notebook,
            name: notebookName
          },
          path: {
            humanReadable: notebookName ? `/${notebookName}${hPath}` : hPath,
            storage: pathInfo.path,
            hpath: hPath
          },
          attributes: customAttrs,
          tags: tags,
          rawAttributes: rawAttrs,
          updated: attrs?.updated || null,
          created: id.substring(0, id.indexOf('-'))
        };
        
        console.log('文档信息获取成功');
        
        if (format === 'json') {
          return {
            success: true,
            data: docInfo,
            message: '文档信息获取成功'
          };
        }
        
        return {
          success: true,
          data: {
            id: docInfo.id,
            title: docInfo.title,
            type: docInfo.type,
            notebook: docInfo.notebook,
            path: docInfo.path.humanReadable,
            attributes: docInfo.attributes,
            tags: docInfo.tags,
            created: docInfo.created,
            updated: docInfo.updated
          },
          message: '文档信息获取成功'
        };
      } catch (error) {
        console.error('获取文档信息失败:', error);
        return {
          success: false,
          error: error.message,
          message: '获取文档信息失败'
        };
      }
    }, {
      type: 'document',
      idParam: 'id',
      defaultNotebook: skill.config.defaultNotebook
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
