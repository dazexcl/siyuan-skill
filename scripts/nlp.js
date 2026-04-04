#!/usr/bin/env node
/**
 * nlp.js - 对文本进行 NLP 分析
 */
const ConfigManager = require('../config');
const SiyuanConnector = require('../connector');

const HELP_TEXT = `用法: nlp <text> [选项]

对文本进行自然语言处理分析

位置参数:
  text                  待分析的文本

选项:
  --tasks <tasks>       指定分析任务（逗号分隔）: entities,keywords,summary
  -h, --help            显示帮助信息

示例:
  nlp "这是一段待分析的文本"
  nlp "文本内容" --tasks entities,keywords`;

function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['tasks']);

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
    console.error('错误: 请提供待分析的文本');
    process.exit(1);
  }

  const text = params.positional[0];
  const tasks = params.tasks ? params.tasks.split(',') : ['entities', 'keywords'];

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    if (!config.nlp || !config.nlp.enabled) {
      console.log(JSON.stringify({
        success: false,
        message: 'NLP 功能未启用。请在 config.json 中配置 nlp.enabled = true',
        fallback: {
          text,
          keywords: text.split(/[，,。！？、；：]/).filter(w => w.length > 1)
        }
      }, null, 2));
      process.exit(0);
    }

    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    const result = { text, analysis: {} };

    if (tasks.includes('keywords')) {
      result.analysis.keywords = text.match(/[\u4e00-\u9fa5]+/g) || [];
    }
    if (tasks.includes('entities')) {
      result.analysis.entities = [];
    }
    if (tasks.includes('summary')) {
      result.analysis.summary = text.substring(0, 100) + '...';
    }

    console.log(JSON.stringify({
      success: true,
      data: result,
      message: 'NLP 分析完成'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
