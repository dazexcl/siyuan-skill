#!/usr/bin/env node
/**
 * info.js - 获取文档基础信息
 * 
 * 获取文档的ID、标题、路径、属性等信息
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: info <docId> [选项]

获取文档基础信息（ID、标题、路径、属性等）

位置参数:
  docId                文档ID

选项:
  --format <fmt>       输出格式：json/summary（默认：summary）
  -h, --help           显示帮助信息

示例:
  info 20231030-doc-id
  info <id> --format json`;

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
  const hasValueOpts = new Set(['format']);

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
  
  if (params.positional.length === 0) {
    console.error('错误: 必须提供文档ID');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const docId = params.positional[0];
  const format = params.format || 'summary';

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    // 获取路径信息
    let pathInfo;
    try {
      pathInfo = await connector.request('/api/filetree/getPathByID', { id: docId });
    } catch (pathError) {
      // 检查是否是笔记本ID
      const notebooksResult = await connector.request('/api/notebook/lsNotebooks');
      if (notebooksResult && notebooksResult.notebooks) {
        const notebook = notebooksResult.notebooks.find(nb => nb.id === docId);
        if (notebook) {
          console.error(`错误: "${docId}" 是笔记本ID，不是文档ID。info 命令仅支持文档ID。`);
          console.error(`笔记本名称: ${notebook.name}`);
          process.exit(1);
        }
      }
      console.error(`错误: 未找到 ID 对应的文档：${docId}`);
      process.exit(1);
    }

    if (!pathInfo || !pathInfo.notebook) {
      console.error(`错误: 未找到 ID 对应的文档：${docId}`);
      process.exit(1);
    }

    // 权限检查
    checkPermission(config, pathInfo.notebook);

    // 获取人类可读路径
    const hPath = await connector.request('/api/filetree/getHPathByID', { id: docId });

    // 获取笔记本名称
    const notebooksResult = await connector.request('/api/notebook/lsNotebooks');
    let notebookName = null;
    if (notebooksResult && notebooksResult.notebooks) {
      for (const nb of notebooksResult.notebooks) {
        if (nb.id === pathInfo.notebook) {
          notebookName = nb.name;
          break;
        }
      }
    }

    // 获取块属性
    const attrs = await connector.request('/api/attr/getBlockAttrs', { id: docId });

    // 解析自定义属性和标签
    const customAttrs = {};
    const tags = [];
    const rawAttrs = {};
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        rawAttrs[key] = value;
        if (key.startsWith('custom-')) {
          customAttrs[key.replace('custom-', '')] = value;
        }
      }
      if (attrs.tags) {
        const tagValue = attrs.tags;
        if (typeof tagValue === 'string' && tagValue) {
          tags.push(...tagValue.split(',').map(t => t.trim()).filter(Boolean));
        }
      }
    }

    // 构建文档信息
    const docInfo = {
      id: docId,
      title: attrs?.title || null,
      type: attrs?.type || 'doc',
      notebook: {
        id: pathInfo.notebook,
        name: notebookName
      },
      path: {
        humanReadable: notebookName ? `/${notebookName}${hPath}` : hPath,
        storage: pathInfo.path,
        hpath: hPath
      },
      attributes: customAttrs,
      tags: tags,
      rawAttributes: rawAttrs,
      updated: attrs?.updated || null,
      created: docId.substring(0, docId.indexOf('-'))
    };

    if (format === 'json') {
      console.log(JSON.stringify({
        success: true,
        data: docInfo,
        message: '文档信息获取成功'
      }, null, 2));
    } else {
      // summary 格式
      console.log(JSON.stringify({
        id: docInfo.id,
        title: docInfo.title,
        type: docInfo.type,
        notebook: docInfo.notebook,
        path: docInfo.path.humanReadable,
        tags: docInfo.tags,
        updated: docInfo.updated
      }, null, 2));
    }

    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
