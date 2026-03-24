/**
 * 属性管理指令
 * 管理 Siyuan Notes 中块/文档的属性（设置/获取/移除）
 * 
 * API 说明：
 * - /api/attr/setBlockAttrs - 设置块属性
 * - /api/attr/getBlockAttrs - 获取块属性
 * 
 * 注意：
 * - 文档本身也是一种特殊的块，因此设置文档属性也使用相同的 API
 * - 默认情况下，属性会自动添加 custom- 前缀（在思源笔记界面可见）
 * - 使用 --hide 标记可以操作内部属性（不带 custom- 前缀，在界面不可见）
 */

const Permission = require('../utils/permission');

const CUSTOM_PREFIX = 'custom-';

/**
 * 解析属性参数
 * @param {string} attrsStr - 属性字符串（key=value 格式，多个用逗号分隔）
 * @param {boolean} hide - 是否隐藏属性（不带 custom- 前缀）
 * @returns {Object} 解析后的属性对象
 */
function parseAttributes(attrsStr, hide = false) {
  const attrs = {};
  if (!attrsStr) return attrs;
  
  const pairs = attrsStr.split(',');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      let key = pair.substring(0, eqIndex).trim();
      const value = pair.substring(eqIndex + 1).trim();
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
 * 获取属性键名（根据 hide 参数决定是否添加前缀）
 * @param {string} key - 原始属性键名
 * @param {boolean} hide - 是否隐藏属性
 * @returns {string} 处理后的属性键名
 */
function getAttrKey(key, hide = false) {
  if (!hide && !key.startsWith(CUSTOM_PREFIX)) {
    return CUSTOM_PREFIX + key;
  }
  return key;
}

/**
 * 从返回结果中移除 custom- 前缀（用于显示）
 * @param {Object} result - API 返回的属性对象
 * @param {boolean} hide - 是否隐藏属性模式
 * @returns {Object} 处理后的属性对象
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
 * @param {string} removeStr - 属性键名字符串（多个用逗号分隔）
 * @param {boolean} hide - 是否隐藏属性模式
 * @returns {string[]} 属性键名数组
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
  description: '管理 Siyuan Notes 中块/文档的属性（设置/获取/移除）',
  usage: 'block-attrs <docId|blockId> (--set <attrs> | --get [key] | --remove <keys>) [--hide]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.id - 块ID/文档ID（必传，位置参数）
   * @param {string} args.attrs - 要设置的属性（key=value格式，多个用逗号分隔）
   * @param {boolean} args.get - 是否获取属性
   * @param {string} args.key - 获取指定属性键（可选）
   * @param {string} args.remove - 要移除的属性键名（多个用逗号分隔）
   * @param {boolean} args.hide - 是否设置隐藏属性（不带 custom- 前缀）
   * @returns {Promise<Object>} 属性操作结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { id, attrs, get, key, remove, hide } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 docId/blockId 作为第一个参数'
      };
    }
    
    if (!attrs && !get && !remove) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 --set 设置属性、--get 获取属性 或 --remove 移除属性'
      };
    }
    
    try {
      let result;
      let operation = 'set';
      
      if (remove) {
        const removeKeys = parseRemoveKeys(remove, hide);
        if (removeKeys.length === 0) {
          return {
            success: false,
            error: '参数格式错误',
            message: '必须提供要移除的属性键名'
          };
        }
        
        const attrObj = {};
        for (const k of removeKeys) {
          attrObj[k] = '';
        }
        
        console.log('移除属性参数:', { id, keys: removeKeys, hide });
        
        result = await skill.connector.request('/api/attr/setBlockAttrs', {
          id,
          attrs: attrObj
        });
        operation = 'remove';
        
        console.log('API 响应:', JSON.stringify(result, null, 2));
        
        return {
          success: true,
          data: {
            id,
            operation,
            removedKeys: removeKeys,
            timestamp: Date.now(),
            notebookId
          },
          message: `成功移除属性: ${removeKeys.join(', ')}`
        };
      } else if (attrs) {
        const attrObj = parseAttributes(attrs, hide);
        console.log('设置属性参数:', { id, attrs: attrObj, hide });
        
        result = await skill.connector.request('/api/attr/setBlockAttrs', {
          id,
          attrs: attrObj
        });
        operation = 'set';
      } else {
        const actualKey = key ? getAttrKey(key, hide) : undefined;
        console.log('获取属性参数:', { id, key: actualKey, hide });
        
        result = await skill.connector.request('/api/attr/getBlockAttrs', {
          id
        });
        operation = 'get';
        
        if (actualKey && result) {
          if (result[actualKey] !== undefined) {
            result = { [key]: result[actualKey] };
          } else {
            result = {};
          }
        } else if (result && !hide) {
          result = formatResultForDisplay(result, hide);
        }
      }
      
      console.log('API 响应:', JSON.stringify(result, null, 2));
      
      return {
        success: true,
        data: {
          id,
          operation,
          result: result,
          timestamp: Date.now(),
          notebookId
        },
        message: operation === 'set' ? '属性设置成功' : '属性获取成功'
      };
    } catch (error) {
      console.error('操作属性失败:', error);
      return {
        success: false,
        error: error.message,
        message: '操作属性失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'id'
  })
};

module.exports = command;
