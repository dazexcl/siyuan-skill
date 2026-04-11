#!/usr/bin/env node
/**
 * notebooks.js - 获取笔记本列表或查询指定笔记本
 * 支持列出所有笔记本或查询指定笔记本ID的详细信息
 */
const SiyuanConnector = require('./lib/connector');
const { parseSimpleArgs } = require('./lib/args-parser');

const HELP_TEXT = `
用法: notebooks [笔记本ID] [选项]

获取 Siyuan Notes 中所有笔记本列表或查询指定笔记本

参数:
  笔记本ID        可选，指定要查询的笔记本ID

选项:
  -h, --help    显示帮助信息

示例:
  notebooks                 # 列出所有笔记本
  notebooks 20260227231831-yq1lxq2  # 查询指定笔记本
`;

/**
 * 获取笔记本列表
 * @returns {Promise<Object>} 笔记本列表结果
 */
async function getNotebooks() {
  const connector = SiyuanConnector.get();
  const result = await connector.request('/api/notebook/lsNotebooks');
  return result.notebooks || [];
}

/**
 * 查询指定笔记本
 * @param {string} notebookId - 笔记本ID
 * @returns {Promise<Object>} 笔记本信息
 */
async function getNotebook(notebookId) {
  const notebooks = await getNotebooks();
  return notebooks.filter(nb => nb.id === notebookId);
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseSimpleArgs(args);
  
  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  
  try {
    if (positionalArgs.length > 0) {
      const notebookId = positionalArgs[0];
      const result = await getNotebook(notebookId);
      console.log(JSON.stringify({ success: true, notebooks: result }, null, 2));
    } else {
      const result = await getNotebooks();
      console.log(JSON.stringify({ success: true, notebooks: result }, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
