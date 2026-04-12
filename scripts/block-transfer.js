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

/**
 * 验证块ID是否存在
 * @param {SiyuanConnector} connector - 思源连接器
 * @param {string} blockId - 块ID
 * @returns {Promise<boolean>} 是否存在
 */
async function validateBlockId(connector, blockId) {
  try {
    await connector.request('/api/block/getBlockInfo', {
      id: blockId
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['from-id', 'to-id']
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  let sourceId = options['from-id'] || positionalArgs[0];
  let targetId = options['to-id'] || positionalArgs[1];

  if (!sourceId || !targetId) {
    console.log(JSON.stringify({
      success: false,
      error: 'missing_parameters',
      message: '请提供源块ID和目标块ID'
    }, null, 2));
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();

    const sourceValid = await validateBlockId(connector, sourceId);
    if (!sourceValid) {
      console.log(JSON.stringify({
        success: false,
        error: 'invalid_source_id',
        message: '源块ID不存在或无效',
        data: { sourceId: sourceId }
      }, null, 2));
      process.exit(1);
    }

    const targetValid = await validateBlockId(connector, targetId);
    if (!targetValid) {
      console.log(JSON.stringify({
        success: false,
        error: 'invalid_target_id',
        message: '目标块ID不存在或无效',
        data: { targetId: targetId }
      }, null, 2));
      process.exit(1);
    }

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
    console.log(JSON.stringify({
      success: false,
      error: error.message,
      message: '块引用转移失败'
    }, null, 2));
    process.exit(1);
  }
}

main();
