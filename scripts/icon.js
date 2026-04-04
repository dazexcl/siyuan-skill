#!/usr/bin/env node
/**
 * icon.js - 设置或获取文档/块的图标
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');

const HELP_TEXT = `用法: icon <id> [emoji] [选项]

设置或获取文档/块的图标

位置参数:
  id              文档/块ID
  emoji           emoji 字符或 Unicode 编码（可选）

选项:
  -r, --remove    移除图标
  -h, --help      显示帮助信息

示例:
  icon <id>                # 获取图标
  icon <id> "1f4c4"        # 设置图标（Unicode编码）
  icon <id> --remove       # 移除图标`;

/** 短选项映射 */
const SHORT_OPTS = { r: 'remove' };

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
 * 将 Unicode 编码转换为 emoji 字符
 * @param {string} code - Unicode 编码（如 "1f4c4" 或 "U+1f4c4"）
 * @returns {string} emoji 字符
 */
function codeToEmoji(code) {
  // 移除 U+ 前缀
  const cleanCode = code.replace(/^U\+/i, '');
  // 解析为数字
  const codePoint = parseInt(cleanCode, 16);
  if (isNaN(codePoint)) {
    return code; // 返回原始值
  }
  return String.fromCodePoint(codePoint);
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
    params.id = params.positional[0];
  }
  if (params.positional.length > 1) {
    params.emoji = params.positional[1];
  }
  delete params.positional;

  if (!params.id) {
    console.error('错误: 缺少必需的ID参数');
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
      id: params.id
    });

    if (params.remove) {
      // 移除图标
      const newAttrs = { ...currentAttrs };
      delete newAttrs.icon;
      const result = await connector.request('/api/attr/setBlockAttrs', {
        id: params.id,
        attrs: newAttrs
      });
      console.log(JSON.stringify({
        success: true,
        id: params.id,
        icon: null,
        message: '图标已移除'
      }, null, 2));
    } else if (params.emoji) {
      // 设置图标
      const emoji = codeToEmoji(params.emoji);
      const newAttrs = {
        ...currentAttrs,
        icon: emoji
      };
      const result = await connector.request('/api/attr/setBlockAttrs', {
        id: params.id,
        attrs: newAttrs
      });
      console.log(JSON.stringify({
        success: true,
        id: params.id,
        icon: emoji,
        message: '图标已设置'
      }, null, 2));
    } else {
      // 获取图标
      const icon = currentAttrs.icon || null;
      console.log(JSON.stringify({
        id: params.id,
        icon: icon
      }, null, 2));
    }
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
