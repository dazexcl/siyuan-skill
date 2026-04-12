#!/usr/bin/env node
/**
 * tags.js - 管理块/文档的标签
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');

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

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    flagOpts: ['add', 'remove', 'get']
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (positionalArgs.length === 0) {
    console.error('错误: 请提供块/文档ID');
    process.exit(1);
  }

  const id = positionalArgs[0];
  const tagsInput = positionalArgs.length > 1 ? positionalArgs[1] : null;

  try {
    const connector = SiyuanConnector.get();

    if (options.get || !tagsInput) {
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

    if (options.add) {
      currentTags = [...new Set([...currentTags, ...newTags])];
    } else if (options.remove) {
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
