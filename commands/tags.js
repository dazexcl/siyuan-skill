/**
 * 标签管理命令
 * 管理 Siyuan Notes 中块/文档的标签
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 分割标签字符串，同时支持中英文逗号
 */
function splitTags(tagsStr) {
  if (!tagsStr) return [];
  return tagsStr.split(/[,，]/).map(t => t.trim()).filter(t => t);
}

/**
 * 命令配置
 */
const command = {
  name: 'tags',
  aliases: ['tag', 'st'],
  description: '管理块/文档的标签',
  usage: 'siyuan tags <id> [tags] [--add <tags>] [--remove <tags>] [--get]',
  sortOrder: 280,
  
  initOptions: {},
  options: {
    '--add': { hasValue: true, aliases: ['-a'], description: '添加标签（不覆盖现有标签）' },
    '--remove': { hasValue: true, aliases: ['-r', '--rm'], description: '移除指定标签' },
    '--get': { isFlag: true, aliases: ['-g'], description: '获取当前标签' }
  },
  positionalCount: 2,
  
  notes: [
    '多个标签用逗号分隔（中英文均可）',
    '无参数等同于 --get',
    '文档本身也是一种特殊的块'
  ],
  examples: [
    'siyuan tags <id> "标签1,标签2"',
    'siyuan tags <id> --add "新标签"',
    'siyuan tags <id> --remove "旧标签"',
    'siyuan tags <id> --get'
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
      args.tags = parsed.positional[1];
    }
    if (parsed.options.id) args.id = parsed.options.id;
    if (parsed.options.tags) args.tags = parsed.options.tags;
    if (parsed.options.add) {
      if (parsed.options.add !== true) {
        args.tags = parsed.options.add;
      }
      args.add = true;
    }
    if (parsed.options.remove) {
      if (parsed.options.remove !== true) {
        args.tags = parsed.options.remove;
      }
      args.remove = true;
    }
    if (parsed.options.get) args.get = true;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.id) {
      console.error('错误: 请提供块ID/文档ID');
      console.log('用法: siyuan tags <id> [tags] [--add|--remove|--get]');
      process.exit(1);
    }
    
    if (!executeArgs.tags && !executeArgs.get && !executeArgs.add && !executeArgs.remove) {
      console.error('错误: 请提供标签或使用 --get 获取标签');
      console.log('用法: siyuan tags <id> <tags> 或 siyuan tags <id> --get');
      process.exit(1);
    }
    
    console.log('操作标签...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { id, tags, add, remove, get } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    if (!tags && !get && !add && !remove) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供标签内容或使用 --get 获取标签'
      };
    }
    
    try {
      if (get) {
        console.log('获取标签参数:', { id });
        
        const result = await skill.connector.request('/api/attr/getBlockAttrs', {
          id
        });
        
        const currentTags = result?.tags || '';
        const tagList = splitTags(currentTags);
        
        return {
          success: true,
          data: {
            id,
            operation: 'get',
            tags: tagList,
            tagsStr: currentTags,
            timestamp: Date.now(),
            notebookId
          },
          message: '标签获取成功'
        };
      }
      
      const tagList = splitTags(tags || add || remove);
      
      if (add || remove) {
        const currentResult = await skill.connector.request('/api/attr/getBlockAttrs', {
          id
        });
        
        const currentTags = currentResult?.tags || '';
        let currentTagList = splitTags(currentTags);
        
        if (add) {
          for (const tag of tagList) {
            if (!currentTagList.includes(tag)) {
              currentTagList.push(tag);
            }
          }
        } else if (remove) {
          currentTagList = currentTagList.filter(t => !tagList.includes(t));
        }
        
        const newTags = currentTagList.join(',');
        console.log('更新标签:', { id, operation: add ? 'add' : 'remove', newTags });
        
        await skill.connector.request('/api/attr/setBlockAttrs', {
          id,
          attrs: { tags: newTags }
        });
        
        return {
          success: true,
          data: {
            id,
            operation: add ? 'add' : 'remove',
            tags: currentTagList,
            tagsStr: newTags,
            timestamp: Date.now(),
            notebookId
          },
          message: add ? '标签添加成功' : '标签移除成功'
        };
      } else {
        const newTags = tagList.join(',');
        console.log('设置标签:', { id, tags: newTags });
        
        await skill.connector.request('/api/attr/setBlockAttrs', {
          id,
          attrs: { tags: newTags }
        });
        
        return {
          success: true,
          data: {
            id,
            operation: 'set',
            tags: tagList,
            tagsStr: newTags,
            timestamp: Date.now(),
            notebookId
          },
          message: '标签设置成功'
        };
      }
    } catch (error) {
      console.error('操作标签失败:', error);
      return {
        success: false,
        error: error.message,
        message: '操作标签失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'id'
  })
};

module.exports = command;
