#!/usr/bin/env node
/**
 * tags.js - 管理块/文档的标签
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');

const HELP_TEXT = `用法: tags <id> [tags] [选项]

管理 Siyuan Notes 中块/文档的标签

位置参数:
  id                    块/文档ID
  tags                  标签列表（逗号分隔）

选项:
  --add                 添加标签
  --remove              移除标签
  --get                 获取标签（默认）
  -h, --help            显示帮助信息

示例:
  tags <id>
  tags <id> "标签1,标签2"
  tags <id> "标签1" --add
  tags <id> "标签1" --remove`;

function parseArgs(argv) {
  const positional = [];
  const options = {};
  const flagOpts = new Set(['add', 'remove', 'get']);

  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (flagOpts.has(key)) {
        options[key] = true;
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
    console.error('错误: 请提供块/文档ID');
    process.exit(1);
  }

  const id = params.positional[0];
  const tagsInput = params.positional.length > 1 ? params.positional[1] : null;

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    if (params.get || !tagsInput) {
      const attrs = await connector.request('/api/attr/getBlockAttrs', { id });
      const tags = attrs.tags ? attrs.tags.split(',').filter(t => t.trim()) : [];
      console.log(JSON.stringify({
        success: true,
        data: { id, tags },
        message: '获取标签成功'
      }, null, 2));
      process.exit(0);
    }

    const existingAttrs = await connector.request('/api/attr/getBlockAttrs', { id });
    let currentTags = existingAttrs.tags ? existingAttrs.tags.split(',').filter(t => t.trim()) : [];
    const newTags = tagsInput.split(',').map(t => t.trim()).filter(t => t);

    if (params.add) {
      currentTags = [...new Set([...currentTags, ...newTags])];
    } else if (params.remove) {
      const removeSet = new Set(newTags);
      currentTags = currentTags.filter(t => !removeSet.has(t));
    } else {
      currentTags = newTags;
    }

    await connector.request('/api/attr/setBlockAttrs', {
      id,
      attrs: { tags: currentTags.join(',') }
    });
    console.log(JSON.stringify({
      success: true,
      data: { id, tags: currentTags },
      message: '标签更新成功'
    }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
