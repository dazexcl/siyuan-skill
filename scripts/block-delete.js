#!/usr/bin/env node
/**
 * block-delete.js - 删除块
 */
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const { parseSimpleArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: block-delete <blockId>

删除 Siyuan Notes 中的块

位置参数:
  blockId                块ID

选项:
  -h, --help            显示帮助信息

示例:
  block-delete <block-id>`;

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseSimpleArgs(args);

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  const blockId = positionalArgs[0];

  if (!blockId) {
    console.error('错误: 请提供块ID');
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

    await connector.request('/api/block/deleteBlock', { id: blockId });
    console.log(JSON.stringify({
      success: true,
      data: { id: blockId },
      message: '块删除成功'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
