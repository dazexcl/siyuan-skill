#!/usr/bin/env node
/**
 * block-get.js - 获取块信息
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: block-get <block-id> [选项]

获取 Siyuan Notes 中的块信息

位置参数:
  block-id              块ID

选项:
  -m, --mode <mode>    获取模式: info(默认)/kramdown/markdown/children
  -h, --help           显示帮助信息

示例:
  block-get <block-id>
  block-get <block-id> --mode kramdown
  block-get <block-id> --mode markdown
  block-get <block-id> --mode children`;

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['mode'],
    shortOpts: { m: 'mode' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (positionalArgs.length === 0) {
    console.error('错误: 请提供块ID');
    process.exit(1);
  }

  const blockId = positionalArgs[0];
  const mode = options.mode || 'info';

  try {
    const connector = SiyuanConnector.get();

    if (mode === 'info') {
      const result = await connector.request('/api/block/getBlockInfo', { id: blockId });
      console.log(JSON.stringify({
        success: true,
        data: result,
        query: { blockId, mode }
      }, null, 2));
    } else if (mode === 'kramdown') {
      const result = await connector.request('/api/block/getBlockKramdown', { id: blockId });
      console.log(JSON.stringify({
        success: true,
        data: result,
        query: { blockId, mode }
      }, null, 2));
    } else if (mode === 'markdown') {
      const kramdownResult = await connector.request('/api/block/getBlockKramdown', { id: blockId });
      const raw = kramdownResult && (kramdownResult.kramdown || kramdownResult);
      const kramdown = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const markdown = kramdown
        .replace(/\{\{.*?\}\}/g, '')
        .replace(/\$\$.*?\$\$/gs, '')
        .replace(/:[a-z_]+:/g, '');
      console.log(JSON.stringify({
        success: true,
        data: { markdown },
        query: { blockId, mode }
      }, null, 2));
    } else if (mode === 'children') {
      const result = await connector.request('/api/block/getChildBlocks', { id: blockId });
      const children = Array.isArray(result) ? result : (result && result.data ? result.data : []);
      console.log(JSON.stringify({
        success: true,
        data: {
          parentId: blockId,
          children: children,
          count: children.length
        },
        query: { blockId, mode }
      }, null, 2));
    } else {
      console.error(`错误: 不支持的模式 "${mode}", 可选: info, kramdown, markdown, children`);
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
