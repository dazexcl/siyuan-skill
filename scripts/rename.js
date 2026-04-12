#!/usr/bin/env node
/**
 * rename.js - 重命名文档标题
 */
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const { parseArgs } = require('./lib/args-parser');

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

/**
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['title'],
    shortOpts: { t: 'title' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (positionalArgs.length > 0) {
    options.docId = positionalArgs[0];
  }
  if (positionalArgs.length > 1 && !options.title) {
    options.title = positionalArgs[1];
  }
  const params = options;

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
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    // 获取文档信息
    const docInfo = await connector.request('/api/block/getBlockInfo', {
      id: params.docId
    });

    // 检查笔记本权限
    checkPermission(config, docInfo.box);

    // 检查重名（如果不强制）
    if (!params.force && docInfo.parentID) {
      try {
        const hPathInfo = await connector.request('/api/filetree/getHPathByID', {
          id: docInfo.parentID
        });
        
        if (hPathInfo) {
          const newPath = hPathInfo + '/' + params.title;
          const existing = await connector.request('/api/filetree/getIDsByHPath', {
            notebook: docInfo.box,
            path: newPath
          });
          if (existing && existing.length > 0 && !existing.includes(params.docId)) {
            console.error(`错误: 已存在同名文档 "${params.title}"，使用 --force 强制重命名`);
            process.exit(1);
          }
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
