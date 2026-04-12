#!/usr/bin/env node
/**
 * block-insert.js - 插入新块到 Siyuan Notes
 */
const SiyuanConnector = require('./lib/connector');
const { checkPermission, isNotebookAllowed } = require('./lib/permission');
const { parseArgs } = require('./lib/args-parser');

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

/**
 * 主函数 - 插入块
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['parent-id', 'previous-id', 'next-id'],
    shortOpts: { p: 'parentId', P: 'previousId', n: 'nextId' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (positionalArgs.length === 0) {
    console.error('错误: 请提供块内容');
    process.exit(1);
  }

  const content = positionalArgs[0];

  // 支持长选项（kebab-case）和短选项（camelCase）两种格式
  const parentId = options['parent-id'] || options.parentId;
  const previousId = options['previous-id'] || options.previousId;
  const nextId = options['next-id'] || options.nextId;

  if (!parentId && !previousId && !nextId) {
    console.error('错误: 请提供 --parent-id, --previous-id 或 --next-id');
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    // 权限检查：如果有权限限制，获取父块信息检查笔记本权限
    const checkId = parentId || previousId || nextId;
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

    if (parentId) requestData.parentID = parentId;
    if (previousId) requestData.previousID = previousId;
    if (nextId) requestData.nextID = nextId;

    const result = await connector.request('/api/block/insertBlock', requestData);
    
    // 提取块ID：result 是一个数组，第一个元素的 doOperations[0].id 就是块ID
    let blockId = null;
    if (Array.isArray(result) && result.length > 0 && result[0].doOperations && result[0].doOperations.length > 0 && result[0].doOperations[0].id) {
      blockId = result[0].doOperations[0].id;
    } else if (typeof result === 'string') {
      blockId = result;
    }
    
    if (!blockId) {
      console.error('错误: 未能获取插入块的ID');
      console.error('返回结果:', JSON.stringify(result));
      process.exit(1);
    }
    
    console.log(JSON.stringify({
      success: true,
      id: blockId,
      message: '块插入成功'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
