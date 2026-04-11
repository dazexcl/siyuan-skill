#!/usr/bin/env node
/**
 * info.js - 获取文档/块基础信息
 *
 * 获取文档或块的ID、name、标题、类型、路径、属性、标签、图标、时间等信息
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');
const { outputResult, outputError } = require('./lib/result-helper');
const { checkPermission } = require('./lib/permission');

const HELP_TEXT = `用法: info <docId> [选项]

获取文档/块基础信息（ID、name、标题、类型、笔记本、路径、属性、标签、图标、时间等）

位置参数:
  docId                文档/块ID

选项:
  -r, --raw            直接输出数据，不包裹响应对象
  -h, --help           显示帮助信息

返回字段:
  id                   文档/块ID
  name                 块名称
  title                标题
  type                 类型（d=文档, l=列表, i=列表项等）
  notebook             笔记本信息（id, name）
  path                 路径信息（apath, storage, hpath）
  attributes           自定义属性（custom-前缀，已去掉前缀）
  rawAttributes        其他属性（不含id、title、type、name、icon、tags、updated、created）
  tags                 标签数组
  icon                 图标
  updated              更新时间
  created              创建时间

示例:
  info 20231030-doc-id
  info <id> --raw`;

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    shortOpts: { 'r': 'raw', 'h': 'help' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (positionalArgs.length === 0) {
    console.error('错误: 必须提供文档ID');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const docId = positionalArgs[0];
  const raw = options.raw || false;

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    const pathInfo = await connector.request('/api/filetree/getPathByID', { id: docId });

    if (!pathInfo || !pathInfo.notebook) {
      throw new Error(`未找到 ID 对应的文档：${docId}`);
    }

    checkPermission(config, pathInfo.notebook);

    const hPath = await connector.request('/api/filetree/getHPathByID', { id: docId });

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

    const blocksResult = await connector.request('/api/query/sql', {
      stmt: `SELECT type, content, updated, created FROM blocks WHERE id = '${docId}'`
    });

    if (!blocksResult || blocksResult.length === 0) {
      throw new Error(`未找到块信息：${docId}`);
    }

    const block = blocksResult[0];

    const attrs = await connector.request('/api/attr/getBlockAttrs', { id: docId });

    const customAttrs = {};
    const tags = [];
    const rawAttrs = {};
    const excludeKeys = new Set(['id', 'title', 'type', 'name', 'icon', 'tags', 'updated', 'created']);
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith('custom-')) {
          customAttrs[key.replace('custom-', '')] = value;
        } else if (!excludeKeys.has(key)) {
          rawAttrs[key] = value;
        }
      }
      const tagValue = attrs.tags || attrs['custom-tags'];
      if (tagValue && typeof tagValue === 'string') {
        tags.push(...tagValue.split(',').map(t => t.trim()).filter(Boolean));
      }
    }

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

    outputResult(docInfo, raw, { message: '文档信息获取成功' });
    process.exit(0);
  } catch (error) {
    outputError(error, raw, { message: '文档信息获取失败' });
    process.exit(1);
  }
}

main();
