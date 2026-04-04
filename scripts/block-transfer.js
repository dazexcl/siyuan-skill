#!/usr/bin/env node
/**
 * block-transfer.js - 转移块引用
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');

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
  for (const arg of argv) {
    if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }
  return { positional };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const params = parseArgs(args);
  if (params.positional.length < 2) {
    console.error('错误: 请提供源块ID和目标块ID');
    process.exit(1);
  }

  const sourceId = params.positional[0];
  const targetId = params.positional[1];

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
