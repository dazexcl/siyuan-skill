#!/usr/bin/env node
/**
 * block-fold.js - 折叠/展开块
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');

const HELP_TEXT = `用法: block-fold <blockId> [选项]

折叠或展开 Siyuan Notes 中的块

位置参数:
  blockId                块ID

选项:
  --action <action>      操作类型: fold 或 unfold (默认: fold)
  -h, --help             显示帮助信息

示例:
  block-fold <block-id> --action fold
  block-fold <block-id> --action unfold`;

function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['action']);

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
    } else if (arg.startsWith('-') && arg.length === 2 && arg[1] === 'a' && i + 1 < argv.length) {
      options.action = argv[++i];
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
  const blockId = params.positional[0];

  if (!blockId) {
    console.error('错误: 请提供块ID');
    process.exit(1);
  }

  const action = params.action || 'fold';
  if (action !== 'fold' && action !== 'unfold') {
    console.error('错误: action 必须是 fold 或 unfold');
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

    const endpoint = action === 'fold' ? '/api/block/foldBlock' : '/api/block/unfoldBlock';
    await connector.request(endpoint, { id: blockId });
    console.log(JSON.stringify({
      success: true,
      data: { id: blockId, action },
      message: action === 'fold' ? '块折叠成功' : '块展开成功'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
