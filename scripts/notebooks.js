#!/usr/bin/env node
/**
 * notebooks.js - 获取所有笔记本列表
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');

const HELP_TEXT = `
用法: notebooks [选项]

获取 Siyuan Notes 中所有笔记本列表

选项:
  -h, --help    显示帮助信息

示例:
  notebooks
`;

function parseArgs(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }
  return options;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  
  parseArgs(args);
  
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
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
