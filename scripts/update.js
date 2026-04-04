#!/usr/bin/env node
/**
 * update.js - 更新文档内容
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');
const { checkPermission } = require('./lib/permission');
const fs = require('fs');

const HELP_TEXT = `用法: update <docId> [content] [选项]

更新 Siyuan Notes 中的文档内容（仅接受文档ID）

位置参数:
  docId                   文档ID
  content                 新内容（可选）

选项:
  -c, --content <text>    新内容
  -f, --file <path>       从文件读取内容
  --data-type <type>      数据类型：markdown（默认）/dom
  -h, --help              显示帮助信息

示例:
  update <id> "新内容"
  update <id> --file ./content.md
  update <id> -c "内容" --data-type markdown`;

/** 短选项到长选项的映射 */
const SHORT_OPTS = { c: 'content', f: 'file' };

/**
 * 将短横线命名转为驼峰命名
 * @param {string} str - 输入字符串
 * @returns {string} 驼峰命名字符串
 */
function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 解析命令行参数
 * @param {string[]} argv - 命令行参数数组
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['content', 'file', 'dataType']);

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

/**
 * 从 stdin 读取内容
 * @returns {Promise<string>} 读取的内容
 */
function readFromStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

/**
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  
  const params = parseArgs(args);
  if (params.positional.length > 0) {
    params.docId = params.positional[0];
  }
  if (params.positional.length > 1 && !params.content) {
    params.content = params.positional[1];
  }
  delete params.positional;

  if (!params.docId) {
    console.error('错误: 缺少必需的文档ID参数');
    console.log(HELP_TEXT);
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

    let content = params.content;

    // 从文件读取内容
    if (params.file) {
      content = fs.readFileSync(params.file, 'utf8');
    }

    // 如果没有提供内容，尝试从 stdin 读取
    if (!content && !process.stdin.isTTY) {
      content = await readFromStdin();
    }

    if (!content) {
      console.error('错误: 缺少内容参数');
      console.log(HELP_TEXT);
      process.exit(1);
    }

    // 获取当前文档信息
    const docInfo = await connector.request('/api/block/getBlockInfo', {
      id: params.docId
    });

    // 检查笔记本权限
    checkPermission(config, docInfo.box);

    // 更新文档
    const dataType = params.dataType || 'markdown';
    const result = await connector.request('/api/block/updateBlock', {
      id: docInfo.id || params.docId,
      dataType: dataType,
      data: content
    });

    console.log(JSON.stringify({
      success: true,
      id: params.docId,
      message: '文档内容已更新'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
