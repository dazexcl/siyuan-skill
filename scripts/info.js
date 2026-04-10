#!/usr/bin/env node
/**
 * info.js - 获取文档基础信息
 * 
 * 获取文档的ID、标题、路径、属性等信息
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: info <docId> [选项]

获取文档基础信息（ID、标题、类型、路径、属性、标签、图标、时间等）

位置参数:
  docId                文档/块ID

选项:
  --format <fmt>       输出格式：json/raw（默认：json）
  -f <fmt>             输出格式的短选项
  -h, --help           显示帮助信息

示例:
  info 20231030-doc-id
  info <id> --format raw
  info <id> -f raw`;

/**
 * 将短横线命名转为驼峰命名
 * @param {string} str - 输入字符串
 * @returns {string} 驼峰命名字符串
 */
function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 短选项到长选项的映射
 */
const SHORT_OPTS = { r: 'raw', h: 'help' };

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
      const eqIndex = arg.indexOf('=');
      if (eqIndex > -1) {
        options[camelCase(arg.slice(2, eqIndex))] = arg.slice(eqIndex + 1);
      } else {
        const key = camelCase(arg.slice(2));
        options[key] = true;
      }
    } else if (arg.startsWith('-') && arg.length === 2 && arg !== '-') {
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

  if (params.positional.length === 0) {
    console.error('错误: 必须提供文档ID');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const docId = params.positional[0];
  const raw = params.raw || false;

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
                throw new Error(`"${docId}" 是笔记本ID，不是文档ID`);
            }
        }
        throw new Error(`未找到 ID 对应的文档：${docId}`);
    }

    if (!pathInfo || !pathInfo.notebook) {
        throw new Error(`未找到 ID 对应的文档：${docId}`);
    }

    // 权限检查
    checkPermission(config, pathInfo.notebook);

    // 获取人类可读路径
    const hPath = await connector.request('/api/filetree/getHPathByID', { id: docId });

    // 获取笔记本列表（只调用一次）
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

    // 使用 SQL 查询获取块的基础信息（type、content、updated、created 等）
    const blocksResult = await connector.request('/api/query/sql', {
        stmt: `SELECT type, content, updated, created FROM blocks WHERE id = '${docId}'`
    });

    if (!blocksResult || blocksResult.length === 0) {
        throw new Error(`未找到块信息：${docId}`);
    }

    const block = blocksResult[0];

    // 获取块属性
    const attrs = await connector.request('/api/attr/getBlockAttrs', { id: docId });

    // 解析自定义属性和标签
    const customAttrs = {};
    const tags = [];
    const rawAttrs = {};
    const excludeKeys = new Set(['id', 'title', 'type', 'name', 'icon', 'tags', 'updated', 'created']);
    if (attrs) {
        for (const [key, value] of Object.entries(attrs)) {
            // custom- 开头的属性放入 customAttrs，不放入 rawAttrs
            if (key.startsWith('custom-')) {
                customAttrs[key.replace('custom-', '')] = value;
            } else if (!excludeKeys.has(key)) {
                rawAttrs[key] = value;
            }
        }
        // 同时支持内置的 tags 字段和自定义的 tags 属性
        const tagValue = attrs.tags || attrs['custom-tags'];
        if (tagValue && typeof tagValue === 'string') {
            tags.push(...tagValue.split(',').map(t => t.trim()).filter(Boolean));
        }
    }

    // 构建文档信息
    const docInfo = {
        id: docId,
        name: attrs?.name || null,
        title: block.type === 'd' ? (block.content || null) : (attrs?.title || null),
        type: block.type,
        notebook: {
            id: pathInfo.notebook,
            name: notebookName
        },
        path: {
            apath: notebookName ? `/${notebookName}${hPath}` : hPath,
            storage: pathInfo.path,
            hpath: hPath
        },
        attributes: customAttrs,
        rawAttributes: { ...rawAttrs },
        tags: tags,
        icon: attrs?.icon || null,
        updated: block.updated || attrs?.updated || null,
        created: block.created || docId.substring(0, docId.indexOf('-'))
    };

    if (raw) {
        console.log(JSON.stringify(docInfo, null, 2));
    } else {
        console.log(JSON.stringify({
            success: true,
            data: docInfo,
            message: '文档信息获取成功'
        }, null, 2));
    }

    process.exit(0);
  } catch (error) {
    if (raw) {
        console.error(error.message);
    } else {
        console.log(JSON.stringify({
            success: false,
            error: error.message,
            message: '文档信息获取失败'
        }, null, 2));
    }
    process.exit(1);
  }
}

main();
