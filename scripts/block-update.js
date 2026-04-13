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
  -d, --data-type <type> 数据类型：markdown（默认）/dom
  -h, --help            显示帮助信息

示例:
  block-update <block-id> "新内容"
  echo "内容" | block-update <block-id>
  block-update <block-id> -f content.md
  block-update <block-id> -c "内容" --data-type markdown

⚠️ 格式规范：更新内容时请遵循内部链接格式 ((id "文本"))
   详见: references/format-standard.md`;

async function readFromStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

/**
 * 验证ID是否为块ID（不是文档ID）
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} id - 要验证的ID
 * @returns {Promise<Object>} 验证结果 { isBlock: boolean, error?: string, blockInfo?: Object }
 */
async function validateBlockId(connector, id) {
  try {
    const blockInfo = await connector.request('/api/block/getBlockInfo', { id });

    if (!blockInfo) {
      return { isBlock: false, error: '无法获取块信息，请检查ID是否正确' };
    }

    if (blockInfo.rootID === id && blockInfo.path && blockInfo.path.endsWith('.sy')) {
      return {
        isBlock: false,
        error: '传入的ID是文档，不是块。请使用 update 命令更新文档内容',
        blockInfo: blockInfo
      };
    }

    return { isBlock: true, blockInfo: blockInfo };
  } catch (error) {
    return { isBlock: false, error: `验证块ID失败: ${error.message}` };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['content', 'file', 'data-type'],
    shortOpts: { c: 'content', f: 'file', d: 'data-type' }
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

  const dataType = options['data-type'] || options.dataType || 'markdown';

  if (dataType !== 'markdown' && dataType !== 'dom') {
    console.error('错误: dataType 必须是 "markdown" 或 "dom"');
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    const validation = await validateBlockId(connector, blockId);

    if (!validation.isBlock) {
      console.log(JSON.stringify({
        success: false,
        error: '参数类型错误',
        message: validation.error
      }, null, 2));
      process.exit(1);
    }

    const blockInfo = validation.blockInfo;
    checkPermission(config, blockInfo.box);

    const result = await connector.request('/api/block/updateBlock', {
      id: blockId,
      dataType: dataType,
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
