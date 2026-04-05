#!/usr/bin/env node
/**
 * update.js - 更新文档内容
 * 
 * 功能说明：
 * - 更新 Siyuan Notes 中的文档内容（仅接受文档ID）
 * - 提供文档ID验证，确保只更新文档而非子块
 * - 支持多种内容输入方式（命令行、文件、stdin）
 * - 自动处理内容中的转义字符
 * 
 * 限制说明：
 * - 只接受文档ID（type='d'）
 * - 不接受块ID，块更新请使用 block-update 命令
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');

const fs = require('fs');

const HELP_TEXT = `用法: update <docId> [content] [选项]

更新 Siyuan Notes 中的文档内容（仅接受文档ID）

位置参数:
  docId                   文档ID
  content                 新内容（可选）

选项:
  -c, --content <text>    新内容
  -f, --file <path>       从文件读取内容
  --data-type <type>      数据类型：markdown（默认）/dom
  -h, --help              显示帮助信息

示例:
  update <id> "新内容"
  update <id> --file ./content.md
  update <id> -c "内容" --data-type markdown

限制:
  - 仅接受文档ID，不接受块ID
  - 如果传入块ID，将返回错误提示使用 block-update 命令`;

/** 短选项到长选项的映射 */
const SHORT_OPTS = { c: 'content', f: 'file' };

/**
 * 辅助函数：处理内容中的换行符
 * @param {string} content - 原始内容
 * @returns {string} 处理后的内容
 */
function processContent(content) {
  return content ? content.replace(/\\n/g, '\n') : '';
}

/**
 * 验证ID是否为文档ID
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} id - 要验证的ID
 * @returns {Promise<Object>} 验证结果 { isDoc: boolean, error?: string, docInfo?: Object }
 */
async function validateDocId(connector, id) {
  try {
    const blockInfo = await connector.request('/api/block/getBlockInfo', { id });
    
    if (!blockInfo) {
      return { isDoc: false, error: '无法获取文档信息，请检查ID是否正确' };
    }
    
    if (blockInfo.rootID === id && blockInfo.path && blockInfo.path.endsWith('.sy')) {
      return { isDoc: true, docInfo: blockInfo };
    }
    
    if (blockInfo.rootID !== id) {
      return { 
        isDoc: false, 
        error: `传入的ID是子块，不是文档。请使用 block-update 命令更新块内容`,
        docInfo: blockInfo
      };
    }
    
    return { isDoc: true, docInfo: blockInfo };
  } catch (error) {
    return { isDoc: false, error: `验证文档ID失败: ${error.message}` };
  }
}

/**
 * 从文档信息中提取笔记本ID
 * @param {Object} docInfo - 文档信息对象
 * @returns {string|null} 笔记本ID，如果无法提取则返回null
 */
function extractNotebookId(docInfo) {
  if (!docInfo) return null;
  if (docInfo.box) return docInfo.box;
  if (docInfo.boxId) return docInfo.boxId;
  if (docInfo.notebookId) return docInfo.notebookId;
  if (docInfo.rootBoxId) return docInfo.rootBoxId;
  return null;
}

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
  const hasValueOpts = new Set(['content', 'file', 'dataType']);

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
    } else if (arg.startsWith('-') && arg.length === 2) {
      const shortKey = SHORT_OPTS[arg[1]];
      if (shortKey && i + 1 < argv.length) {
        options[shortKey] = argv[++i];
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, ...options };
}

/**
 * 从 stdin 读取内容
 * @returns {Promise<string>} 读取的内容
 */
function readFromStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
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
  if (params.positional.length > 1 && params.content === undefined) {
    params.content = params.positional[1];
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

    let content = params.content;

    // 从文件读取内容
    if (params.file) {
      try {
        content = fs.readFileSync(params.file, 'utf8');
      } catch (fileError) {
        console.error('错误: 无法读取文件', params.file);
        console.error(fileError.message);
        process.exit(1);
      }
    }

    // 如果没有提供内容，尝试从 stdin 读取
    if (content === undefined && !process.stdin.isTTY) {
      content = await readFromStdin();
    }

    if (content === undefined) {
      console.error('错误: 缺少内容参数');
      console.log(HELP_TEXT);
      process.exit(1);
    }

    // 验证文档ID
    const validation = await validateDocId(connector, params.docId);
    
    if (!validation.isDoc) {
      console.error(JSON.stringify({
        success: false,
        error: '参数类型错误',
        message: validation.error
      }, null, 2));
      process.exit(1);
    }

    // 检查笔记本权限
    const notebookId = extractNotebookId(validation.docInfo);
    if (!notebookId) {
      console.error(JSON.stringify({
        success: false,
        error: '权限验证失败',
        message: '无法获取文档所在的笔记本信息'
      }, null, 2));
      process.exit(1);
    }
    
    // 执行权限检查
    try {
      checkPermission(config, notebookId);
    } catch (error) {
      console.error(JSON.stringify({
        success: false,
        error: '权限不足',
        message: error.message
      }, null, 2));
      process.exit(1);
    }

    // 处理内容中的换行符
    const processedContent = processContent(content);
    
    // 更新文档
    const dataType = params.dataType || 'markdown';
    const result = await connector.request('/api/block/updateBlock', {
      id: params.docId,
      dataType: dataType,
      data: processedContent
    });

    console.log(JSON.stringify({
      success: true,
      id: params.docId,
      operation: 'update-document',
      contentLength: content.length,
      notebookId: notebookId,
      timestamp: Date.now(),
      message: '文档内容已更新'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message,
      message: '文档更新失败'
    }, null, 2));
    process.exit(1);
  }
}

main();
