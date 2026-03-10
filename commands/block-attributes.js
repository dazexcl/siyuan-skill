/**
 * 块属性命令
 * 在 Siyuan Notes 中管理块属性
 */

const Permission = require('../utils/permission');

/**
 * 解析属性参数
 * @param {string} attrsStr - 属性字符串（key=value 格式）
 * @returns {Object} 解析后的属性对象
 */
function parseAttributes(attrsStr) {
  const attrs = {};
  if (!attrsStr) return attrs;
  
  const pairs = attrsStr.split(',');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key && value !== undefined) {
      attrs[key.trim()] = value.trim();
    }
  }
  
  return attrs;
}

/**
 * 命令配置
 */
const command = {
  name: 'block-attributes',
  description: '在 Siyuan Notes 中管理块属性',
  usage: 'block-attributes --id <blockId> [--set <attrs>] [--get <key>]',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.id - 块ID
   * @param {string} args.set - 要设置的属性（key=value格式，多个用逗号分隔）
   * @param {string} args.get - 要获取的属性键
   * @returns {Promise<Object>} 属性操作结果
   */
  execute: async (skill, args = {}) => {
    const { id, set, get } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    if (!set && !get) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 --set 或 --get 参数'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        let result;
        
        if (set) {
          const attrs = parseAttributes(set);
          result = await skill.connector.request('/api/attr/setBlockAttrs', {
            id,
            attrs
          });
        } else if (get) {
          result = await skill.connector.request('/api/attr/getBlockAttrs', {
            id
          });
        }
        
        console.log('API 响应:', JSON.stringify(result, null, 2));
        
        if (result === null || result === true || (result && (result.code === 0 || (typeof result === 'object' && Object.keys(result).length > 0)))) {
          skill.clearCache();
          
          return {
            success: true,
            data: {
              id,
              operation: set ? 'set' : 'get',
              result: result?.data || result,
              timestamp: Date.now(),
              notebookId
            },
            message: set ? '块属性设置成功' : '块属性获取成功'
          };
        } else {
          return {
            success: false,
            error: result?.msg || '块属性操作失败',
            message: '块属性操作失败'
          };
        }
      } catch (error) {
        console.error('操作块属性失败:', error);
        return {
          success: false,
          error: error.message,
          message: '操作块属性失败'
        };
      }
    }, {
      type: 'document',
      idParam: 'id',
      defaultNotebook: skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
