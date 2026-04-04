#!/usr/bin/env node
/**
 * rename.js - 重命名文档标题
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: rename <docId> [title] [选项]

重命名 Siyuan Notes 中的文档标题

位置参数:
  docId                  文档ID
  title                  新标题

选项:
  -t, --title <title>    新标题（与位置参数2二选一）
  --force                强制重命名（跳过重名检测）
  -h, --help             显示帮助信息

示例:
  rename <id> "新标题"
  rename <id> --title "新标题"
  rename <id> -t "新标题" --force`;

/** 短选项到长选项的映射 */
const SHORT_OPTS = { t: 'title' };

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
  const hasValueOpts = new Set(['title']);

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
  if (params.positional.length > 1 && !params.title) {
    params.title = params.positional[1];
  }
  delete params.positional;

  if (!params.docId) {
    console.error('错误: 缺少必需的文档ID参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (!params.title) {
    console.error('错误: 缺少新标题参数');
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

    // 获取文档信息
    const docInfo = await connector.request('/api/block/getBlockInfo', {
      id: params.docId
    });

    // 检查笔记本权限
    checkPermission(config, docInfo.box);

    // 检查重名（如果不强制）
    if (!params.force && docInfo.parentID) {
      try {
        const parentPath = docInfo.rootPath.substring(0, docInfo.rootPath.lastIndexOf('/'));
        const newPath = parentPath + '/' + params.title;
        const existing = await connector.request('/api/filetree/getIDsByHPath', {
          path: newPath
        });
        if (existing && existing.length > 0 && !existing.includes(params.docId)) {
          console.error(`错误: 已存在同名文档 "${params.title}"，使用 --force 强制重命名`);
          process.exit(1);
        }
      } catch (checkError) {
        // 检查失败时继续
      }
    }

    // 执行重命名
    const result = await connector.request('/api/filetree/renameDocByID', {
      id: params.docId,
      title: params.title
    });

    console.log(JSON.stringify({
      success: true,
      id: params.docId,
      oldTitle: docInfo.rootTitle,
      newTitle: params.title,
      message: '文档已重命名'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
