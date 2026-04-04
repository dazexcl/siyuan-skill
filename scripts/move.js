#!/usr/bin/env node
/**
 * move.js - 移动文档到另一个目录
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: move <docId> [targetParentId] [选项]

将文档从一个目录移动到另一个目录

位置参数:
  docId                       文档ID
  targetParentId              目标父目录ID（可选）

选项:
  -T, --target <id>           目标父目录ID
  -t, --new-title <title>     新标题（可选）
  -h, --help                  显示帮助信息

示例:
  move <id> <parentId>
  move <id> --target <parentId>
  move <id> <parentId> --new-title "新标题"`;

/** 短选项到长选项的映射 */
const SHORT_OPTS = { T: 'target', t: 'newTitle' };

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
  const hasValueOpts = new Set(['target', 'newTitle']);

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
  if (params.positional.length > 1 && !params.target) {
    params.targetParentId = params.positional[1];
  }
  if (params.target && !params.targetParentId) {
    params.targetParentId = params.target;
  }
  delete params.positional;
  delete params.target;

  if (!params.docId) {
    console.error('错误: 缺少必需的文档ID参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (!params.targetParentId) {
    console.error('错误: 缺少目标父目录ID参数');
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

    // 获取源文档信息
    const docInfo = await connector.request('/api/block/getBlockInfo', {
      id: params.docId
    });

    // 检查源笔记本权限
    checkPermission(config, docInfo.box);

    // 获取目标文档信息（如果是文档ID）
    let targetNotebook = docInfo.box;
    let targetPath = '/';

    if (params.targetParentId) {
      try {
        const targetInfo = await connector.request('/api/block/getBlockInfo', {
          id: params.targetParentId
        });
        targetNotebook = targetInfo.box || docInfo.box;
        targetPath = targetInfo.rootPath || '/';
      } catch (error) {
        // 如果获取目标信息失败，假设它是笔记本ID
        targetNotebook = params.targetParentId;
        targetPath = '/';
      }
    }

    // 如果需要重命名，先重命名
    if (params.newTitle && params.newTitle !== docInfo.rootTitle) {
      await connector.request('/api/filetree/renameDocByID', {
        id: params.docId,
        title: params.newTitle
      });
      docInfo.rootTitle = params.newTitle;
    }

    // 执行移动到目标路径
    const result = await connector.request('/api/filetree/moveDocsByID', {
      fromIDs: [params.docId],
      toNotebook: targetNotebook,
      toPath: targetPath
    });

    console.log(JSON.stringify({
      success: true,
      id: params.docId,
      targetNotebook,
      targetPath,
      title: docInfo.rootTitle,
      message: '文档已移动'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
