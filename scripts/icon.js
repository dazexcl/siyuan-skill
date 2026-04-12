#!/usr/bin/env node
/**
 * icon.js - 设置或获取文档/块的图标
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');

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
  const { options, positionalArgs } = parseArgs(args, {
    shortOpts: { r: 'remove' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (positionalArgs.length > 0) {
    options.id = positionalArgs[0];
  }
  if (positionalArgs.length > 1) {
    options.emoji = positionalArgs[1];
  }

  if (!options.id) {
    console.error('错误: 缺少必需的ID参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();

    // 获取当前属性
    const currentAttrs = await connector.request('/api/attr/getBlockAttrs', {
      id: options.id
    });

    if (options.remove) {
      // 移除图标：显式设置为空字符串
      const result = await connector.request('/api/attr/setBlockAttrs', {
        id: options.id,
        attrs: { icon: '' }
      });
      console.log(JSON.stringify({
        success: true,
        id: options.id,
        icon: null,
        message: '图标已移除'
      }, null, 2));
    } else if (options.emoji) {
      // 设置图标
      const emoji = codeToEmoji(options.emoji);
      const newAttrs = {
        ...currentAttrs,
        icon: emoji
      };
      const result = await connector.request('/api/attr/setBlockAttrs', {
        id: options.id,
        attrs: newAttrs
      });
      console.log(JSON.stringify({
        success: true,
        id: options.id,
        icon: emoji,
        message: '图标已设置'
      }, null, 2));
    } else {
      // 获取图标
      const icon = currentAttrs.icon || null;
      console.log(JSON.stringify({
        success: true,
        data: {
          id: options.id,
          hasIcon: icon !== null,
          icon: icon
        },
        message: icon ? '图标获取成功' : '未设置图标'
      }, null, 2));
    }
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
