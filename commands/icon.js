/**
 * 图标命令
 * 设置或获取文档/块的图标
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 将 emoji 字符转换为思源笔记使用的 Unicode 编码
 */
function emojiToCode(emoji) {
  if (!emoji) return null;
  
  if (/^[a-f0-9-]+$/i.test(emoji)) {
    return emoji.toLowerCase();
  }
  
  const codePoints = [];
  for (const char of emoji) {
    codePoints.push(char.codePointAt(0).toString(16));
  }
  return codePoints.join('-');
}

/**
 * 命令配置
 */
const command = {
  name: 'icon',
  description: '设置或获取文档/块的图标',
  usage: 'siyuan icon <id> [emoji] [--remove]',
  sortOrder: 110,
  
  initOptions: {},
  options: {
    '--remove': { isFlag: true, aliases: ['-r', '--rm'], description: '移除图标' }
  },
  positionalCount: 2,
  
  notes: [
    '无参数时获取当前图标',
    '提供 emoji 参数时设置图标',
    '支持 emoji 字符或 Unicode 编码'
  ],
  
  examples: [
    'siyuan icon <id>              # 获取图标',
    'siyuan icon <id> 📄           # 设置图标',
    'siyuan icon <id> --remove     # 移除图标'
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
      args.emoji = parsed.positional[1];
    }
    if (parsed.options.remove) args.remove = true;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.id) {
      console.error('错误: 请提供文档ID或块ID');
      console.log('用法: siyuan icon <id> [emoji] [--remove]');
      process.exit(1);
    }
    
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行命令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { id, emoji, remove } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    try {
      if (remove) {
        await skill.connector.request('/api/attr/setBlockAttrs', {
          id,
          attrs: { icon: '' }
        });
        
        return {
          success: true,
          data: { id, icon: '', removed: true },
          message: '图标已移除'
        };
      }
      
      if (emoji) {
        const iconCode = emojiToCode(emoji);
        
        if (!iconCode) {
          return {
            success: false,
            error: '参数无效',
            message: '无法解析 emoji 参数'
          };
        }
        
        await skill.connector.request('/api/attr/setBlockAttrs', {
          id,
          attrs: { icon: iconCode }
        });
        
        return {
          success: true,
          data: { id, icon: iconCode },
          message: `图标设置成功: ${iconCode}`
        };
      }
      
      const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id });
      
      if (!attrs) {
        return {
          success: false,
          error: '获取失败',
          message: '无法获取图标信息，请检查ID是否正确'
        };
      }
      
      const icon = attrs.icon || '';
      
      return {
        success: true,
        data: { id, icon, hasIcon: !!icon },
        message: icon ? `当前图标: ${icon}` : '未设置图标'
      };
    } catch (error) {
      console.error('图标操作失败:', error);
      return {
        success: false,
        error: error.message,
        message: '图标操作失败'
      };
    }
  }, {
    type: 'block',
    idParam: 'id'
  })
};

module.exports = command;
