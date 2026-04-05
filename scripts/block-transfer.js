#!/usr/bin/env node
/**
 * block-transfer.js - 转移块引用
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');

const HELP_TEXT = `用法: block-transfer <sourceId> <targetId>

转移 Siyuan Notes 中块的引用关系

位置参数:
  sourceId              源块ID
  targetId              目标块ID

选项:
  -h, --help            显示帮助信息

示例:
  block-transfer <source-id> <target-id>`;

function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['from-id', 'to-id', 'fromId', 'toId']);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > -1) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        options[key === 'from-id' ? 'fromId' : key === 'to-id' ? 'toId' : key] = value;
      } else {
        const key = arg.slice(2);
        if (hasValueOpts.has(key) && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          options[key === 'from-id' ? 'fromId' : key === 'to-id' ? 'toId' : key] = argv[++i];
        }
      }
    } else if (!arg.startsWith('-')) {
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
  let sourceId = params.fromId || params.positional[0];
  let targetId = params.toId || params.positional[1];

  if (!sourceId || !targetId) {
    console.error('错误: 请提供源块ID和目标块ID');
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

    await connector.request('/api/block/transferBlockRef', {
      fromID: sourceId,
      toID: targetId
    });
    console.log(JSON.stringify({
      success: true,
      data: { sourceId, targetId },
      message: '块引用转移成功'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
