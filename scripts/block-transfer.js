#!/usr/bin/env node
/**
 * block-transfer.js - 转移块引用
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: block-transfer <sourceId> <targetId>

转移 Siyuan Notes 中块的引用关系

位置参数:
  sourceId              源块ID
  targetId              目标块ID

选项:
  -h, --help            显示帮助信息

示例:
  block-transfer <source-id> <target-id>`;

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['from-id', 'to-id'],
    defaults: { fromId: null, toId: null }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  let sourceId = options['from-id'] || options.fromId || positionalArgs[0];
  let targetId = options['to-id'] || options.toId || positionalArgs[1];

  if (!sourceId || !targetId) {
    console.error('错误: 请提供源块ID和目标块ID');
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();

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
