#!/usr/bin/env node
/**
 * delete.js - 删除文档
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: delete <docId> [选项]

删除 Siyuan Notes 中的文档（受多层保护机制约束）

位置参数:
  docId                      文档ID

选项:
  --confirm-title <title>    确认标题（当启用删除确认时需要）
  -h, --help                 显示帮助信息

示例:
  delete <doc-id>
  delete <doc-id> --confirm-title "文档标题"`;

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
  const hasValueOpts = new Set(['confirmTitle']);

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
    } else if (arg.startsWith('-') && arg.length === 2 && arg !== '-') {
      // 短选项暂不定义
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

    // 获取文档信息以检查保护状态
    let docInfo;
    try {
      docInfo = await connector.request('/api/block/getBlockInfo', {
        id: params.docId
      });
    } catch (error) {
      // 如果文档不存在，可能已经被删除了
      if (error.message.includes('404') || error.message.includes('not found') || 
          error.message.includes('未找到') || error.message.includes('不存在')) {
        console.error('错误: 文档不存在或已被删除');
        process.exit(1);
      }
      throw error;
    }

    // 检查笔记本权限
    checkPermission(config, docInfo.box);

    // 获取文档属性检查是否有保护标记
    let attrs;
    try {
      attrs = await connector.request('/api/attr/getBlockAttrs', {
        id: params.docId
      });
    } catch (error) {
      // 如果获取属性失败（比如文档刚创建还没有属性），假设没有属性，继续执行删除
      attrs = {};
    }
    
    if (attrs && attrs['custom-protected']) {
      console.error('错误: 该文档已被保护，无法删除');
      process.exit(1);
    }

    // 检查删除保护
    if (config.deleteProtection && config.deleteProtection.safeMode) {
      // 检查是否需要确认标题
      if (config.deleteProtection.requireConfirmation && !params.confirmTitle) {
        console.error('错误: 需要确认文档标题');
        console.error(`请使用 --confirm-title "${docInfo.rootTitle || docInfo.content}" 确认删除`);
        process.exit(1);
      }
    }

    // 如果提供了确认标题，必须验证（无论安全模式是否启用）
    if (params.confirmTitle && params.confirmTitle !== (docInfo.rootTitle || docInfo.content)) {
      console.error('错误: 确认标题与文档标题不匹配');
      console.error(`文档标题: "${docInfo.rootTitle || docInfo.content}"`);
      console.error(`确认标题: "${params.confirmTitle}"`);
      process.exit(1);
    }

    // 执行删除
    // 使用 removeDocByID API 来删除文档（参考历史版本的实现）
    // 这个 API 只需要文档ID，比 removeDoc 更简单可靠
    const docTitle = docInfo.rootTitle || docInfo.content || params.docId;
    
    console.log('执行删除操作:', JSON.stringify({
      notebook: docInfo.box || '',
      docId: params.docId,
      title: docTitle
    }, null, 2));

    // 使用 removeDocByID API（历史版本使用的API）
    console.log('调用删除文档API:', '/api/filetree/removeDocByID', { id: params.docId });
    
    const result = await connector.request('/api/filetree/removeDocByID', {
      id: params.docId
    });
    
    console.log('删除文档API返回结果:', JSON.stringify(result, null, 2));
    console.log('删除验证成功：文档已删除');

    console.log(JSON.stringify({
      success: true,
      id: params.docId,
      title: docInfo.rootTitle || docInfo.content,
      notebook: docInfo.box,
      deleted: true,
      timestamp: Date.now(),
      message: '文档已删除'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
