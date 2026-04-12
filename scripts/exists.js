#!/usr/bin/env node
/**
 * exists.js - 检查文档是否存在
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: exists [选项]

检查指定位置是否存在同名文档

选项:
  -t, --title <title>        文档标题
  --path <path>              文档完整路径
  -p, --parent-id <id>       父文档ID
  -n, --notebook-id <id>     笔记本ID
  -h, --help                 显示帮助信息

注意:
  --title 与 --path 二选一

示例:
  exists --title "文档标题"
  exists --title "标题" --parent-id <id>
  exists --path "/目录/文档"`;

/**
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['title', 'path', 'parent-id', 'notebook-id'],
    shortOpts: { t: 'title', p: 'parentId', n: 'notebookId' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  const params = options;
  // 第一个位置参数可作为 title
  if (positionalArgs.length > 0 && !params.title) {
    params.title = positionalArgs[0];
  }

  if (!params.title && !params.path) {
    console.error('错误: 需要提供 --title 或 --path 参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();

    let searchPath = params.path;
    let notebookId = null;

    // 如果提供了 title 和 parentId，构建完整路径
    const parentId = params['parent-id'] || params.parentId;
    const notebookIdParam = params['notebook-id'] || params.notebookId;
    if (params.title && parentId) {
      try {
        const parentInfo = await connector.request('/api/block/getBlockInfo', {
          id: parentId
        });
        if (parentInfo && parentInfo.box) {
          notebookId = parentInfo.box;
          const parentHPath = await connector.request('/api/filetree/getHPathByID', {
            id: parentId
          });
          if (parentHPath) {
            searchPath = parentHPath + '/' + params.title;
          }
        }
      } catch (err) {
        // 获取父文档信息失败，继续
      }
    } else if (params.title && notebookIdParam) {
      // 获取笔记本信息
      const notebooks = await connector.request('/api/notebook/lsNotebooks');
      const notebook = notebooks?.notebooks?.find(n => n.id === notebookIdParam);
      if (notebook) {
        notebookId = notebook.id;
        searchPath = '/' + params.title;
      }
    } else if (params.title) {
      // 只有标题，尝试搜索
      searchPath = '/' + params.title;
    }

    // 检查文档是否存在
    let exists = false;
    let docIds = [];

    // 如果还没有 notebookId，尝试从路径中解析
    if (searchPath && !notebookId && searchPath.startsWith('/')) {
      try {
        const pathParts = searchPath.split('/').filter(p => p);
        if (pathParts.length > 0) {
          const notebookName = pathParts[0];
          const notebooks = await connector.request('/api/notebook/lsNotebooks');
          const notebook = notebooks?.notebooks?.find(n => n.name === notebookName);
          if (notebook) {
            notebookId = notebook.id;
            // 重新构建 searchPath，只保留相对路径
            if (pathParts.length > 1) {
              searchPath = '/' + pathParts.slice(1).join('/');
            } else {
              searchPath = '/';
            }
          }
        }
      } catch (err) {
        // 解析失败
      }
    }

    if (notebookId && searchPath) {
      try {
        docIds = await connector.request('/api/filetree/getIDsByHPath', {
          notebook: notebookId,
          path: searchPath
        });
        exists = docIds && docIds.length > 0;
      } catch (err) {
        exists = false;
      }
    }

    console.log(JSON.stringify({
      exists: exists,
      path: searchPath,
      ids: docIds || []
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
