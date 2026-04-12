#!/usr/bin/env node
/**
 * block-move.js - 移动块
 */
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const { parseArgs } = require('./lib/args-parser');

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

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['parent-id', 'previous-id'],
    shortOpts: { p: 'parentId', P: 'previousId' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  const blockId = positionalArgs[0];
  let parentId = options['parent-id'] || options.parentId;

  // 支持位置参数：第二个位置参数作为 parentId
  if (!parentId && positionalArgs[1]) {
    parentId = positionalArgs[1];
  }
  const params = options;

  if (!blockId) {
    console.error('错误: 请提供块ID');
    process.exit(1);
  }

  if (!parentId) {
    console.error('错误: 请提供目标父块ID（--parent-id 或第二个位置参数）');
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

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
