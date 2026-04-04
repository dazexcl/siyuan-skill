#!/usr/bin/env node
/**
 * block-get.js - 获取块信息
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');

const HELP_TEXT = `用法: block-get <block-id> [选项]

获取 Siyuan Notes 中的块信息

位置参数:
  block-id              块ID

选项:
  -m, --mode <mode>    获取模式: info(默认)/kramdown/markdown/children
  -h, --help           显示帮助信息

示例:
  block-get <block-id>
  block-get <block-id> --mode kramdown
  block-get <block-id> --mode markdown
  block-get <block-id> --mode children`;

const SHORT_OPTS = { m: 'mode' };

function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['mode']);

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

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const params = parseArgs(args);
  if (params.positional.length === 0) {
    console.error('错误: 请提供块ID');
    process.exit(1);
  }

  const blockId = params.positional[0];
  const mode = params.mode || 'info';

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    if (mode === 'info') {
      const result = await connector.request('/api/block/getBlockInfo', { id: blockId });
      console.log(JSON.stringify({
        success: true,
        data: result,
        query: { blockId, mode }
      }, null, 2));
    } else if (mode === 'kramdown') {
      const result = await connector.request('/api/block/getBlockKramdown', { id: blockId });
      console.log(JSON.stringify({
        success: true,
        data: result,
        query: { blockId, mode }
      }, null, 2));
    } else if (mode === 'markdown') {
      const kramdownResult = await connector.request('/api/block/getBlockKramdown', { id: blockId });
      const raw = kramdownResult && (kramdownResult.kramdown || kramdownResult);
      const kramdown = typeof raw === 'string' ? raw : JSON.stringify(raw);
      const markdown = kramdown
        .replace(/\{\{.*?\}\}/g, '')
        .replace(/\$\$.*?\$\$/gs, '')
        .replace(/:[a-z_]+:/g, '');
      console.log(JSON.stringify({
        success: true,
        data: { markdown },
        query: { blockId, mode }
      }, null, 2));
    } else if (mode === 'children') {
      const result = await connector.request('/api/block/getChildBlocks', { id: blockId });
      const children = Array.isArray(result) ? result : (result && result.data ? result.data : []);
      console.log(JSON.stringify({
        success: true,
        data: {
          parentId: blockId,
          children: children,
          count: children.length
        },
        query: { blockId, mode }
      }, null, 2));
    } else {
      console.error(`错误: 不支持的模式 "${mode}", 可选: info, kramdown, markdown, children`);
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
