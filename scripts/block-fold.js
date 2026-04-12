#!/usr/bin/env node
/**
 * block-fold.js - 折叠/展开块
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');

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

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['action']
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  const blockId = positionalArgs[0];

  if (!blockId) {
    console.error('错误: 请提供块ID');
    process.exit(1);
  }

  const params = options;
  const action = params.action || 'fold';
  if (action !== 'fold' && action !== 'unfold') {
    console.error('错误: action 必须是 fold 或 unfold');
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();

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
