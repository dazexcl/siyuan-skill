#!/usr/bin/env node
/**
 * notebooks.js - 获取笔记本列表或查询指定笔记本
 * 支持列出所有笔记本或查询指定笔记本ID的详细信息
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');

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
 * 解析命令行参数
 * @param {string[]} args - 命令行参数数组
 * @returns {Object} 解析后的选项和参数
 */
function parseArgs(args) {
  const options = {};
  const positionalArgs = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }
  
  return { options, positionalArgs };
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args);
  
  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
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
    
    const result = await connector.request('/api/notebook/lsNotebooks');
    const notebooks = result.notebooks || [];
    
    if (positionalArgs.length > 0) {
      const notebookId = positionalArgs[0];
      const filtered = notebooks.filter(nb => nb.id === notebookId);
      
      console.log(JSON.stringify({ success: true, notebooks: filtered }, null, 2));
    } else {
      console.log(JSON.stringify({ success: true, notebooks: notebooks }, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
