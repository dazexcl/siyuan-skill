/**
 * 属性管理指令
 * 管理 Siyuan Notes 中块/文档的属性（设置/获取/移除）
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

const CUSTOM_PREFIX = 'custom-';

/**
 * 解析属性参数
 */
function parseAttributes(attrsStr, hide = false) {
  const attrs = {};
  if (!attrsStr) return attrs;
  
  const pairs = attrsStr.split(',');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      let key = pair.substring(0, eqIndex).trim();
      let value = pair.substring(eqIndex + 1).trim();
      
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (key) {
        if (!hide && !key.startsWith(CUSTOM_PREFIX)) {
          key = CUSTOM_PREFIX + key;
        }
        attrs[key] = value;
      }
    }
  }
  
  return attrs;
}

/**
 * 从返回结果中移除 custom- 前缀
 */
function formatResultForDisplay(result, hide = false) {
  if (!result || hide) return result;
  
  const formatted = {};
  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith(CUSTOM_PREFIX)) {
      formatted[key.substring(CUSTOM_PREFIX.length)] = value;
    } else {
      formatted[key] = value;
    }
  }
  return formatted;
}

/**
 * 解析要移除的属性键名列表
 */
function parseRemoveKeys(removeStr, hide = false) {
  if (!removeStr) return [];
  
  return removeStr.split(',').map(key => {
    key = key.trim();
    if (!hide && !key.startsWith(CUSTOM_PREFIX)) {
      return CUSTOM_PREFIX + key;
    }
    return key;
  }).filter(key => key);
}

/**
 * 指令配置
 */
const command = {
  name: 'block-attrs',
  aliases: ['attrs', 'attr', 'ba'],
  description: '管理块/文档属性（设置/获取/移除）',
  usage: 'siyuan attrs <id> [--set <k=v>] [--get <key>] [--remove <key>]',
  sortOrder: 200,
  
  initOptions: {},
  positionalCount: 1,
  
  options: {
    '--set': { 
      hasValue: true, 
      aliases: ['-s', '-S'], 
      description: '设置属性（key=value 格式，多个用逗号分隔）' 
    },
    '--get': { 
      hasValue: true, 
      aliases: ['-g'], 
      description: '获取指定属性值' 
    },
    '--remove': { 
      hasValue: true, 
      aliases: ['-r', '--rm'], 
      description: '移除属性（多个用逗号分隔）' 
    },
    '--hide': { 
      isFlag: true, 
      description: '操作内部属性（不带 custom- 前缀）' 
    }
  },
  
  notes: [
    '无参数时获取所有属性',
    '默认属性会添加 custom- 前缀',
    '使用 --hide 操作内部属性'
  ],
  
  examples: [
    'siyuan attrs <id>              # 获取所有属性',
    'siyuan attrs <id> --set status=done',
    'siyuan attrs <id> --get status',
    'siyuan attrs <id> --remove status'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.id = parsed.positional[0];
    }
    if (parsed.options.set) args.set = parsed.options.set;
    if (parsed.options.get) args.get = parsed.options.get;
    if (parsed.options.remove) args.remove = parsed.options.remove;
    if (parsed.options.hide) args.hide = true;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.id) {
      console.error('错误: 请提供块/文档ID');
      console.log('用法: siyuan attrs <id> [--set|--get|--remove|--all]');
      process.exit(1);
    }
    
    console.log('管理属性...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { id, set, get, remove, hide = false } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    try {
      if (set) {
        const attrs = parseAttributes(set, hide);
        if (Object.keys(attrs).length === 0) {
          return {
            success: false,
            error: '参数格式错误',
            message: '--set 参数格式应为 key=value（多个用逗号分隔）'
          };
        }
        
        console.log('设置属性:', attrs);
        await skill.connector.request('/api/attr/setBlockAttrs', { id, attrs });
        
        return {
          success: true,
          data: { id, attrs: formatResultForDisplay(attrs, hide) },
          message: '属性设置成功'
        };
      }
      
      if (remove) {
        const keys = parseRemoveKeys(remove, hide);
        if (keys.length === 0) {
          return {
            success: false,
            error: '参数格式错误',
            message: '--remove 参数应为属性键名（多个用逗号分隔）'
          };
        }
        
        const attrs = {};
        keys.forEach(key => { attrs[key] = ''; });
        
        console.log('移除属性:', keys);
        await skill.connector.request('/api/attr/setBlockAttrs', { id, attrs });
        
        return {
          success: true,
          data: { id, removed: keys },
          message: '属性移除成功'
        };
      }
      
      console.log('获取属性:', id);
      const result = await skill.connector.request('/api/attr/getBlockAttrs', { id });
      
      if (!result) {
        return {
          success: false,
          error: '获取属性失败',
          message: '无法获取块属性'
        };
      }
      
      if (get && typeof get === 'string' && get.trim()) {
        let key = get.trim();
        if (!hide && !key.startsWith(CUSTOM_PREFIX)) {
          key = CUSTOM_PREFIX + key;
        }
        const value = result[key] || null;
        
        return {
          success: true,
          data: { id, key: get, value },
          message: value ? '获取属性成功' : '属性不存在'
        };
      }
      
      return {
        success: true,
        data: { id, attrs: formatResultForDisplay(result, hide) },
        message: '获取属性成功'
      };
    } catch (error) {
      console.error('属性操作失败:', error);
      return {
        success: false,
        error: error.message,
        message: '属性操作失败'
      };
    }
  }, {
    type: 'block',
    idParam: 'id'
  })
};

module.exports = command;
