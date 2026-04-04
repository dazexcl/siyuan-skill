#!/usr/bin/env node
/**
 * block-attrs.js - 管理块/文档属性
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');

const HELP_TEXT = `用法: block-attrs <id> [选项]

管理 Siyuan Notes 中块/文档的属性

位置参数:
  id                    块/文档ID

选项:
  --set <k=v>           设置属性（多个用逗号分隔）
  --get <key>           获取指定属性值
  --remove <key>        移除属性（多个用逗号分隔）
  -h, --help            显示帮助信息

示例:
  block-attrs <id>
  block-attrs <id> --set status=done
  block-attrs <id> --get status
  block-attrs <id> --remove status`;

const CUSTOM_PREFIX = 'custom-';

function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseAttributes(attrsStr) {
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
      if (key && !key.startsWith(CUSTOM_PREFIX)) {
        key = CUSTOM_PREFIX + key;
      }
      attrs[key] = value;
    }
  }
  return attrs;
}

function parseRemoveKeys(removeStr) {
  if (!removeStr) return [];
  return removeStr.split(',').map(key => {
    key = key.trim();
    if (!key.startsWith(CUSTOM_PREFIX)) {
      return CUSTOM_PREFIX + key;
    }
    return key;
  }).filter(key => key);
}

function formatResultForDisplay(result) {
  if (!result) return result;
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

function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['set', 'get', 'remove']);
  const shortOpts = { 'S': 'set', 'g': 'get' };

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
    process.exit(1);
  }

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
      const attrs = parseAttributes(params.set);
      if (Object.keys(attrs).length === 0) {
        console.error('错误: --set 参数格式应为 key=value');
        process.exit(1);
      }
      await connector.request('/api/attr/setBlockAttrs', { id: params.id, attrs });
      console.log(JSON.stringify({
        success: true,
        data: { id: params.id, attrs: formatResultForDisplay(attrs) },
        message: '属性设置成功'
      }, null, 2));
      process.exit(0);
    }

    if (params.remove) {
      const keys = parseRemoveKeys(params.remove);
      if (keys.length === 0) {
        console.error('错误: --remove 参数应为属性键名');
        process.exit(1);
      }
      const attrs = {};
      keys.forEach(key => { attrs[key] = ''; });
      await connector.request('/api/attr/setBlockAttrs', { id: params.id, attrs });
      console.log(JSON.stringify({
        success: true,
        data: { id: params.id, removed: keys },
        message: '属性移除成功'
      }, null, 2));
      process.exit(0);
    }

    const result = await connector.request('/api/attr/getBlockAttrs', { id: params.id });
    
    if (params.get) {
      if (typeof params.get === 'boolean') {
        console.log(JSON.stringify({
          success: true,
          data: { id: params.id, attrs: formatResultForDisplay(result) },
          message: '获取属性成功'
        }, null, 2));
      } else {
        let key = params.get.trim();
        if (!key.startsWith(CUSTOM_PREFIX)) {
          key = CUSTOM_PREFIX + key;
        }
        const value = result[key] || null;
        console.log(JSON.stringify({
          success: true,
          data: { id: params.id, key: params.get, value },
          message: value ? '获取属性成功' : '属性不存在'
        }, null, 2));
      }
    } else {
      console.log(JSON.stringify({
        success: true,
        data: { id: params.id, attrs: formatResultForDisplay(result) },
        message: '获取属性成功'
      }, null, 2));
    }
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
