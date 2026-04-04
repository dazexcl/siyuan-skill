#!/usr/bin/env node
/**
 * block-insert.js - 插入新块到 Siyuan Notes
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');
const { checkPermission, isNotebookAllowed } = require('./lib/permission');

const HELP_TEXT = `用法: block-insert <content> [选项]

插入新块到 Siyuan Notes

位置参数:
  content               块内容

选项:
  --parent-id <id>     父块ID
  --previous-id <id>   插入到该块之后
  --next-id <id>       插入到该块之前
  -h, --help           显示帮助信息

示例:
  block-insert "新段落内容" --parent-id <parent-id>
  block-insert "内容" --previous-id <after-this-block>`;

const SHORT_OPTS = { p: 'parentId', P: 'previousId', n: 'nextId' };

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
  const hasValueOpts = new Set(['parentId', 'previousId', 'nextId']);

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
 * 主函数 - 插入块
 */
async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const params = parseArgs(args);
  if (params.positional.length === 0) {
    console.error('错误: 请提供块内容');
    process.exit(1);
  }

  const content = params.positional[0];

  if (!params.parentId && !params.previousId && !params.nextId) {
    console.error('错误: 请提供 --parent-id, --previous-id 或 --next-id');
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

    // 权限检查：如果有权限限制，获取父块信息检查笔记本权限
    const checkId = params.parentId || params.previousId || params.nextId;
    if (checkId && config.permissionMode && config.permissionMode !== 'all') {
      const parentBlockInfo = await connector.request('/api/block/getBlockInfo', { id: checkId });
      if (parentBlockInfo) {
        checkPermission(config, parentBlockInfo.box);
      }
    }

    const requestData = {
      dataType: 'markdown',
      data: content
    };

    if (params.parentId) requestData.parentID = params.parentId;
    if (params.previousId) requestData.previousID = params.previousId;
    if (params.nextId) requestData.nextID = params.nextId;

    const result = await connector.request('/api/block/insertBlock', requestData);
    console.log(JSON.stringify({
      success: true,
      data: result,
      message: '块插入成功'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
