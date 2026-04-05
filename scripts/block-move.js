#!/usr/bin/env node
/**
 * block-move.js - 移动块
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: block-move <blockId> [选项]

移动 Siyuan Notes 中的块

位置参数:
  blockId                块ID

选项:
  --parent-id <id>       目标父块ID
  --previous-id <id>     移动到该块之后
  -h, --help             显示帮助信息

示例:
  block-move <block-id> --parent-id <parent-id>
  block-move <block-id> --previous-id <previous-id>`;

function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['parentId', 'previousId']);

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
    } else if (arg.startsWith('-') && arg.length === 2) {
      const shortKey = arg[1] === 'p' ? 'parentId' : arg[1] === 'P' ? 'previousId' : null;
      if (shortKey && i + 1 < argv.length) {
        options[shortKey] = argv[++i];
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
  const blockId = params.positional[0];
  let parentId = params.parentId;

  // 支持位置参数：第二个位置参数作为 parentId
  if (!parentId && params.positional[1]) {
    parentId = params.positional[1];
  }

  if (!blockId) {
    console.error('错误: 请提供块ID');
    process.exit(1);
  }

  if (!parentId) {
    console.error('错误: 请提供目标父块ID（--parent-id 或第二个位置参数）');
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

    // 获取块信息以检查笔记本权限
    const blockInfo = await connector.request('/api/block/getBlockInfo', { id: blockId });
    if (blockInfo) {
      checkPermission(config, blockInfo.box);
    }

    const requestData = {
      id: blockId,
      parentID: parentId
    };
    if (params.previousId) {
      requestData.previousID = params.previousId;
    }

    await connector.request('/api/block/moveBlock', requestData);
    console.log(JSON.stringify({
      success: true,
      data: { id: blockId, parentId: parentId },
      message: '块移动成功'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
