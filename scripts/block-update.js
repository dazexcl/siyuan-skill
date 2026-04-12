#!/usr/bin/env node
/**
 * block-update.js - 更新块内容
 */
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const { parseArgs } = require('./lib/args-parser');
const fs = require('fs');

const HELP_TEXT = `用法: block-update <block-id> [content] [选项]

更新 Siyuan Notes 中的块内容

位置参数:
  block-id              块ID
  content               块内容（可选，可从stdin或文件读取）

选项:
  -c, --content <text>  块内容
  -f, --file <path>     从文件读取内容
  -h, --help            显示帮助信息

示例:
  block-update <block-id> "新内容"
  echo "内容" | block-update <block-id>
  block-update <block-id> -f content.md`;

async function readFromStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['content', 'file'],
    shortOpts: { c: 'content', f: 'file' }
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
  let content = positionalArgs[1] || options.content;

  if (options.file) {
    try {
      content = fs.readFileSync(options.file, 'utf8');
    } catch (err) {
      console.error(`错误: 无法读取文件 ${options.file}: ${err.message}`);
      process.exit(1);
    }
  }
  const params = options;

  if (!content) {
    if (!process.stdin.isTTY) {
      content = await readFromStdin();
    }
  }

  if (!content) {
    console.error('错误: 请提供块内容（位置参数、-c、-f 或 stdin）');
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    const blockInfo = await connector.request('/api/block/getBlockInfo', { id: blockId });
    checkPermission(config, blockInfo.box);

    const result = await connector.request('/api/block/updateBlock', {
      id: blockId,
      dataType: 'markdown',
      data: content
    });

    console.log(JSON.stringify({
      success: true,
      data: { id: blockId, updated: result },
      message: '块更新成功'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
