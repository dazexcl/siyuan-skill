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
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: block-attrs <id> [选项]

管理 Siyuan Notes 中块/文档的属性

位置参数:
  id                    块/文档ID

选项:
  --set <k=v>           设置属性（多个用逗号分隔）
  --get <key>           获取指定属性值（不指定则获取所有）
  --remove <key>        移除属性（多个用逗号分隔）
  --format <fmt>        输出格式：json/pretty（默认：json）
  --hide                操作内部属性（不带 custom- 前缀）
  -h, --help            显示帮助信息

示例:
  block-attrs <id>
  block-attrs <id> --set status=done
  block-attrs <id> --set "priority=high,owner=john"
  block-attrs <id> --get status
  block-attrs <id> --remove status
  block-attrs <id> --remove "tag1,tag2"
  block-attrs <id> --format pretty
  block-attrs <id> --set internal=value --hide`;

const CUSTOM_PREFIX = 'custom-';

function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 解析属性字符串
 * @param {string} attrsStr - 属性字符串，格式：key1=value1,key2=value2
 * @param {boolean} hide - 是否隐藏属性（不带 custom- 前缀）
 * @returns {Object} 属性对象
 */
function parseAttributes(attrsStr, hide = false) {
  const attrs = {};
  if (!attrsStr) return attrs;
  
  const pairs = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';
  
  for (let i = 0; i < attrsStr.length; i++) {
    const char = attrsStr[i];
    
    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (inQuotes && char === quoteChar) {
      inQuotes = false;
      current += char;
    } else if (!inQuotes && char === ',') {
      if (current.trim()) {
        pairs.push(current.trim());
      }
      current = '';
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
 * 解析命令行参数
 * @param {string[]} argv - 命令行参数数组
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['set', 'get', 'remove', 'format']);
  const shortOpts = { 'S': 'set', 'g': 'get', 'r': 'remove', 'f': 'format', 'h': 'help', 'H': 'hide' };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > -1) {
        options[camelCase(arg.slice(2, eqIndex))] = arg.slice(eqIndex + 1);
      } else {
        const key = camelCase(arg.slice(2));
        if (hasValueOpts.has(key) && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          options[key] = argv[++i];
        } else {
          options[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2 && arg !== '-') {
      const shortKey = arg[1];
      const longKey = shortOpts[shortKey];
      if (longKey && hasValueOpts.has(longKey) && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        options[longKey] = argv[++i];
      } else if (longKey) {
        options[longKey] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, ...options };
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
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const params = parseArgs(args);
  if (params.positional.length > 0) {
    params.id = params.positional[0];
  }
  delete params.positional;

  if (!params.id) {
    console.error('错误: 请提供块/文档ID');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const format = params.format || 'json';
  const hide = params.hide || false;

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    if (params.set) {
      const attrs = parseAttributes(params.set, hide);
      if (Object.keys(attrs).length === 0) {
        console.error('错误: --set 参数格式应为 key=value');
        process.exit(1);
      }

      const invalidAttrs = Object.keys(attrs).filter(key => !validateAttributeName(key.replace(CUSTOM_PREFIX, '')));
      if (invalidAttrs.length > 0) {
        console.error(`错误: 以下属性名无效: ${invalidAttrs.join(', ')}`);
        console.error('属性名只能包含小写英文字母、数字和连字符，并且以小写英文字母开头，长度不超过200字符');
        process.exit(1);
      }

      const invalidValues = Object.entries(attrs).filter(([_, value]) => !validateAttributeValue(value));
      if (invalidValues.length > 0) {
        console.error(`错误: 以下属性值无效或为空: ${invalidValues.map(([k]) => k).join(', ')}`);
        process.exit(1);
      }

      await connector.request('/api/attr/setBlockAttrs', { id: params.id, attrs });
      
      const responseData = {
        success: true,
        data: { 
          id: params.id, 
          attrs: formatResultForDisplay(attrs, hide),
          count: Object.keys(attrs).length
        },
        message: '属性设置成功'
      };

      if (format === 'pretty') {
        console.log(`✓ 属性设置成功 (${Object.keys(attrs).length} 个属性)`);
        console.log(`  ID: ${params.id}`);
        console.log('  属性:');
        for (const [key, value] of Object.entries(formatResultForDisplay(attrs, hide))) {
          console.log(`    ${key} = ${value}`);
        }
      } else {
        console.log(JSON.stringify(responseData, null, 2));
      }
      process.exit(0);
    }

    if (params.remove) {
      const keys = parseRemoveKeys(params.remove, hide);
      if (keys.length === 0) {
        console.error('错误: --remove 参数应为属性键名');
        process.exit(1);
      }

      const invalidKeys = keys.filter(key => !validateAttributeName(key.replace(CUSTOM_PREFIX, '')));
      if (invalidKeys.length > 0) {
        console.error(`错误: 以下属性名无效: ${invalidKeys.join(', ')}`);
        process.exit(1);
      }

      const attrs = {};
      keys.forEach(key => { attrs[key] = ''; });
      await connector.request('/api/attr/setBlockAttrs', { id: params.id, attrs });
      
      const responseData = {
        success: true,
        data: { 
          id: params.id, 
          removed: hide ? keys : keys.map(k => k.replace(CUSTOM_PREFIX, '')),
          count: keys.length
        },
        message: '属性移除成功'
      };

      if (format === 'pretty') {
        console.log(`✓ 属性移除成功 (${keys.length} 个属性)`);
        console.log(`  ID: ${params.id}`);
        console.log(`  已移除: ${hide ? keys.join(', ') : keys.map(k => k.replace(CUSTOM_PREFIX, '')).join(', ')}`);
      } else {
        console.log(JSON.stringify(responseData, null, 2));
      }
      process.exit(0);
    }

    const result = await connector.request('/api/attr/getBlockAttrs', { id: params.id });
    
    if (params.get) {
      if (typeof params.get === 'boolean') {
        const formattedAttrs = formatResultForDisplay(result, hide);

        const responseData = {
          success: true,
          data: { 
            id: params.id, 
            attrs: formattedAttrs,
            count: Object.keys(formattedAttrs).length
          },
          message: '获取属性成功'
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
        } else {
          console.log(JSON.stringify(responseData, null, 2));
        }
      } else {
        let key = params.get.trim();
        if (!hide && !key.startsWith(CUSTOM_PREFIX)) {
          key = CUSTOM_PREFIX + key;
        }
        const value = result[key] || null;
        
        const responseData = {
          success: true,
          data: { 
            id: params.id, 
            key: params.get, 
            value,
            exists: value !== null && value !== undefined && value !== ''
          },
          message: value ? '获取属性成功' : '属性不存在'
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
        } else {
          console.log(JSON.stringify(responseData, null, 2));
        }
      }
    } else {
      const formattedAttrs = formatResultForDisplay(result, hide);

      const responseData = {
        success: true,
        data: { 
          id: params.id, 
          attrs: formattedAttrs,
          count: Object.keys(formattedAttrs).length
        },
        message: '获取属性成功'
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
      } else {
        console.log(JSON.stringify(responseData, null, 2));
      }
    }
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    if (error.details) {
      console.error('详细信息:', error.details);
    }
    process.exit(1);
  }
}

main();
