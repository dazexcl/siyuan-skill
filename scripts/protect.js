#!/usr/bin/env node
/**
 * protect.js - 设置或移除文档保护标记
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');

const HELP_TEXT = `用法: protect <docId> [选项]

设置或移除文档保护标记，防止文档被删除

位置参数:
  docId             文档ID

选项:
  -r, --remove      移除保护标记
  -p, --permanent   设置为永久保护
  -h, --help        显示帮助信息

示例:
  protect <doc-id>
  protect <doc-id> --permanent
  protect <doc-id> --remove`;

/** 短选项映射 */
const SHORT_OPTS = { r: 'remove', p: 'permanent' };

/**
 * 解析命令行参数
 * @param {string[]} argv - 命令行参数数组
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(argv) {
  const positional = [];
  const options = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      options[key] = true;
    } else if (arg.startsWith('-') && arg.length === 2) {
      const shortKey = SHORT_OPTS[arg[1]];
      if (shortKey) {
        options[shortKey] = true;
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

    // 获取当前属性
    const currentAttrs = await connector.request('/api/attr/getBlockAttrs', {
      id: params.docId
    });

    let newAttrs;
    if (params.remove) {
      // 移除保护标记
      newAttrs = { ...currentAttrs };
      delete newAttrs['custom-protected'];
      const result = await connector.request('/api/attr/setBlockAttrs', {
        id: params.docId,
        attrs: newAttrs
      });
      console.log(JSON.stringify({
        success: true,
        id: params.docId,
        protected: false,
        message: '保护标记已移除'
      }, null, 2));
    } else {
      // 设置保护标记
      const protectionLevel = params.permanent ? 'permanent' : 'protected';
      newAttrs = {
        ...currentAttrs,
        'custom-protected': protectionLevel
      };
      await connector.request('/api/attr/setBlockAttrs', {
        id: params.docId,
        attrs: newAttrs
      });
      console.log(JSON.stringify({
        success: true,
        id: params.docId,
        protected: true,
        level: protectionLevel,
        message: '文档已受保护'
      }, null, 2));
    }
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
