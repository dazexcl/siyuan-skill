#!/usr/bin/env node
/**
 * block-attrs.js - 管理块/文档属性
 * 
 * 功能说明：
 * - 设置、获取、删除块或文档的自定义属性
 * - 支持批量操作多个属性
 * - 自动为属性名添加 'custom-' 前缀
 * - 提供属性值的格式化输出
 */
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: block-attrs <id> [选项]

管理 Siyuan Notes 中块/文档的属性

位置参数:
  id                    块/文档ID

选项:
  --set <k=v>           设置属性（可多次使用，每个设置一个属性）
  --get <key>           获取指定属性值（不指定则获取所有）
  --remove <key>        移除属性（可多次使用，或用逗号分隔多个）
  --format <fmt>        输出格式：json/raw/pretty（默认：json）
  --raw                 等同于 --format raw，直接输出数据不包裹
  --hide                操作内部属性（不带 custom- 前缀）
  -h, --help            显示帮助信息

输出格式说明:
  json    - 标准JSON格式，包含 { success, data, message } 结构（默认）
  raw     - 裸数据格式，直接输出数据，不包裹响应对象
  pretty  - 人类友好格式，格式化文本输出

示例:
  block-attrs <id>
  block-attrs <id> --set status=done
  block-attrs <id> --set priority=high --set owner=john
  block-attrs <id> --get status
  block-attrs <id> --get --raw
  block-attrs <id> --get --format pretty
  block-attrs <id> --remove status
  block-attrs <id> --set internal=value --hide`;

const CUSTOM_PREFIX = 'custom-';

/**
 * 解析属性字符串（智能处理逗号）
 * @param {string} attrsStr - 属性字符串，格式：key1=value1,key2=value2 或 key=value
 * @param {boolean} hide - 是否隐藏属性（不带 custom- 前缀）
 * @returns {Object} 属性对象
 */
function parseAttributes(attrsStr, hide = false) {
  const attrs = {};
  if (!attrsStr) return attrs;
  
  // 智能解析：先找到第一个 = 号，然后检查逗号是否在引号内
  const pairs = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  let escapeNext = false;
  let foundFirstEq = false;
  
  for (let i = 0; i < attrsStr.length; i++) {
    const char = attrsStr[i];
    
    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      current += char;
      continue;
    }
    
    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      current += char;
    } else if (char === '=') {
      foundFirstEq = true;
      current += char;
    } else if (!inQuotes && char === ',') {
      // 只有在找到第一个 = 号之后，逗号才可能是分隔符
      if (foundFirstEq && current.trim()) {
        pairs.push(current.trim());
        current = '';
        foundFirstEq = false;
      } else {
        current += char;
      }
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    pairs.push(current.trim());
  }
  
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex > 0) {
      let key = pair.substring(0, eqIndex).trim();
      let value = pair.substring(eqIndex + 1).trim();
      
      // 移除值两端的引号（如果有）
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      if (key && !hide && !key.startsWith(CUSTOM_PREFIX)) {
        key = CUSTOM_PREFIX + key;
      }
      attrs[key] = value;
    }
  }
  return attrs;
}

/**
 * 解析要移除的属性键名
 * @param {string} removeStr - 属性键名字符串（多个用逗号分隔）
 * @param {boolean} hide - 是否隐藏属性（不带 custom- 前缀）
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
 * 格式化结果用于显示
 * @param {Object} result - API 返回的结果
 * @param {boolean} hide - 是否隐藏属性模式
 * @returns {Object} 格式化后的结果
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
 * 验证属性值
 * @param {string} value - 属性值
 * @returns {boolean} 是否有效
 */
function validateAttributeValue(value) {
  if (value === undefined || value === null) {
    return false;
  }
  const strValue = String(value).trim();
  if (strValue.length === 0) {
    return false;
  }
  if (strValue.length > 10000) {
    console.warn('警告: 属性值长度超过10000字符，可能会影响性能');
  }
  return true;
}

/**
 * 验证属性名
 * @param {string} name - 属性名
 * @returns {boolean} 是否有效
 */
function validateAttributeName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (trimmed.length > 200) {
    return false;
  }
  if (!/^[a-z][a-z0-9-]*$/.test(trimmed)) {
    return false;
  }
  return true;
}

/**
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['set', 'get', 'remove', 'format'],
    multiValueOpts: ['set', 'remove'],
    shortOpts: { S: 'set', g: 'get', r: 'remove', f: 'format', h: 'help', H: 'hide', R: 'raw' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (positionalArgs.length > 0) {
    options.id = positionalArgs[0];
  }
  const params = options;

  if (!params.id) {
    console.error('错误: 请提供块/文档ID');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  // --raw 等同于 --format raw
  const format = params.raw ? 'raw' : (params.format || 'json');
  const hide = params.hide || false;

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    // 获取路径信息以进行权限检查
    let pathInfo;
    try {
      pathInfo = await connector.request('/api/filetree/getPathByID', { id: params.id });
    } catch (pathError) {
      throw new Error(`未找到 ID 对应的块/文档：${params.id}`);
    }

    if (!pathInfo || !pathInfo.notebook) {
      throw new Error(`未找到 ID 对应的块/文档：${params.id}`);
    }

    // 权限检查
    checkPermission(config, pathInfo.notebook);

    if (params.set) {
      // 支持多次 --set 或单次逗号分隔的格式
      const setValues = Array.isArray(params.set) ? params.set : [params.set];
      const allAttrs = {};
      
      for (const setValue of setValues) {
        const attrs = parseAttributes(setValue, hide);
        Object.assign(allAttrs, attrs);
      }
      
      if (Object.keys(allAttrs).length === 0) {
        console.error('错误: --set 参数格式应为 key=value');
        process.exit(1);
      }

      const invalidAttrs = Object.keys(allAttrs).filter(key => !validateAttributeName(key.replace(CUSTOM_PREFIX, '')));
      if (invalidAttrs.length > 0) {
        console.error(`错误: 以下属性名无效: ${invalidAttrs.join(', ')}`);
        console.error('属性名只能包含小写英文字母、数字和连字符，并且以小写英文字母开头，长度不超过200字符');
        process.exit(1);
      }

      const invalidValues = Object.entries(allAttrs).filter(([_, value]) => !validateAttributeValue(value));
      if (invalidValues.length > 0) {
        console.error(`错误: 以下属性值无效或为空: ${invalidValues.map(([k]) => k).join(', ')}`);
        process.exit(1);
      }

      await connector.request('/api/attr/setBlockAttrs', { id: params.id, attrs: allAttrs });
      
      const data = {
        id: params.id, 
        attrs: formatResultForDisplay(allAttrs, hide),
        count: Object.keys(allAttrs).length
      };

      if (format === 'pretty') {
        console.log(`✓ 属性设置成功 (${Object.keys(allAttrs).length} 个属性)`);
        console.log(`  ID: ${params.id}`);
        console.log('  属性:');
        for (const [key, value] of Object.entries(formatResultForDisplay(allAttrs, hide))) {
          console.log(`    ${key} = ${value}`);
        }
      } else if (format === 'raw') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(JSON.stringify({
          success: true,
          data: data,
          message: '属性设置成功'
        }, null, 2));
      }
      process.exit(0);
    }

    if (params.remove) {
      // 支持多次 --remove 或单次逗号分隔的格式
      const removeValues = Array.isArray(params.remove) ? params.remove : [params.remove];
      const allKeys = [];
      
      for (const removeValue of removeValues) {
        const keys = parseRemoveKeys(removeValue, hide);
        allKeys.push(...keys);
      }
      
      if (allKeys.length === 0) {
        console.error('错误: --remove 参数应为属性键名');
        process.exit(1);
      }

      const invalidKeys = allKeys.filter(key => !validateAttributeName(key.replace(CUSTOM_PREFIX, '')));
      if (invalidKeys.length > 0) {
        console.error(`错误: 以下属性名无效: ${invalidKeys.join(', ')}`);
        process.exit(1);
      }

      const attrs = {};
      allKeys.forEach(key => { attrs[key] = ''; });
      await connector.request('/api/attr/setBlockAttrs', { id: params.id, attrs });
      
      const data = {
        id: params.id, 
        removed: hide ? allKeys : allKeys.map(k => k.replace(CUSTOM_PREFIX, '')),
        count: allKeys.length
      };

      if (format === 'pretty') {
        console.log(`✓ 属性移除成功 (${allKeys.length} 个属性)`);
        console.log(`  ID: ${params.id}`);
        console.log(`  已移除: ${hide ? allKeys.join(', ') : allKeys.map(k => k.replace(CUSTOM_PREFIX, '')).join(', ')}`);
      } else if (format === 'raw') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(JSON.stringify({
          success: true,
          data: data,
          message: '属性移除成功'
        }, null, 2));
      }
      process.exit(0);
    }

    const result = await connector.request('/api/attr/getBlockAttrs', { id: params.id });
    
    if (params.get) {
      if (typeof params.get === 'boolean') {
        const formattedAttrs = formatResultForDisplay(result, hide);

        const data = {
          id: params.id, 
          attrs: formattedAttrs,
          count: Object.keys(formattedAttrs).length
        };

        if (format === 'pretty') {
          console.log(`✓ 获取属性成功 (${Object.keys(formattedAttrs).length} 个属性)`);
          console.log(`  ID: ${params.id}`);
          if (Object.keys(formattedAttrs).length > 0) {
            console.log('  属性:');
            for (const [key, value] of Object.entries(formattedAttrs)) {
              console.log(`    ${key} = ${value}`);
            }
          } else {
            console.log('  (无自定义属性)');
          }
        } else if (format === 'raw') {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(JSON.stringify({
            success: true,
            data: data,
            message: '获取属性成功'
          }, null, 2));
        }
      } else {
        let key = params.get.trim();
        if (!hide && !key.startsWith(CUSTOM_PREFIX)) {
          key = CUSTOM_PREFIX + key;
        }
        const value = result[key] || null;
        
        const data = {
          id: params.id, 
          key: params.get, 
          value,
          exists: value !== null && value !== undefined && value !== ''
        };

        if (format === 'pretty') {
          if (value) {
            console.log(`✓ 获取属性成功`);
            console.log(`  ID: ${params.id}`);
            console.log(`  ${params.get} = ${value}`);
          } else {
            console.log(`✗ 属性不存在`);
            console.log(`  ID: ${params.id}`);
            console.log(`  ${params.get} = (未设置)`);
          }
        } else if (format === 'raw') {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(JSON.stringify({
            success: true,
            data: data,
            message: value ? '获取属性成功' : '属性不存在'
          }, null, 2));
        }
      }
      process.exit(0);
    } else {
      const formattedAttrs = formatResultForDisplay(result, hide);

      const data = {
        id: params.id, 
        attrs: formattedAttrs,
        count: Object.keys(formattedAttrs).length
      };

      if (format === 'pretty') {
        console.log(`✓ 获取属性成功 (${Object.keys(formattedAttrs).length} 个属性)`);
        console.log(`  ID: ${params.id}`);
        if (Object.keys(formattedAttrs).length > 0) {
          console.log('  属性:');
          for (const [key, value] of Object.entries(formattedAttrs)) {
            console.log(`    ${key} = ${value}`);
          }
        } else {
          console.log('  (无自定义属性)');
        }
      } else if (format === 'raw') {
        console.log(JSON.stringify(data, null, 2));
      } else {
        console.log(JSON.stringify({
          success: true,
          data: data,
          message: '获取属性成功'
        }, null, 2));
      }
    }
    process.exit(0);
  } catch (error) {
    if (format === 'pretty') {
      console.error(`✗ 执行失败`);
      console.error(`  错误: ${error.message}`);
      if (error.details) {
        console.error(`  详细信息: ${error.details}`);
      }
    } else if (format === 'raw') {
      console.error(error.message);
      if (error.details) {
        console.error(error.details);
      }
    } else {
      console.log(JSON.stringify({
        success: false,
        error: error.message,
        details: error.details || null,
        message: '执行失败'
      }, null, 2));
    }
    process.exit(1);
  }
}

main();
