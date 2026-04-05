#!/usr/bin/env node
/**
 * block-update.js - 更新块内容
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
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

const SHORT_OPTS = { c: 'content', f: 'file' };

function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['content', 'file']);

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
      const shortKey = SHORT_OPTS[arg[1]];
      if (shortKey && i + 1 < argv.length) {
        options[shortKey] = argv[++i];
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, ...options };
}

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
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const params = parseArgs(args);
  if (params.positional.length === 0) {
    console.error('错误: 请提供块ID');
    process.exit(1);
  }

  const blockId = params.positional[0];
  let content = params.positional[1] || params.content;

  if (params.file) {
    try {
      content = fs.readFileSync(params.file, 'utf8');
    } catch (err) {
      console.error(`错误: 无法读取文件 ${params.file}: ${err.message}`);
      process.exit(1);
    }
  }

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
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

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
