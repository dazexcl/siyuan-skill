#!/usr/bin/env node
/**
 * protect.js - 设置或移除文档保护标记
 * 
 * 功能说明:
 * - 设置文档保护标记，防止文档被误删除
 * - 支持临时保护（可移除）和永久保护（不可通过命令移除）
 * - 集成权限检查，确保操作在授权笔记本内执行
 */
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: protect <docId> [选项]

设置或移除文档保护标记，防止文档被删除

位置参数:
  docId             文档ID

选项:
  -r, --remove      移除保护标记
  -p, --permanent   设置为永久保护（不可通过命令移除）
  -h, --help        显示帮助信息

保护级别:
  protected         临时保护，可通过 --remove 移除
  permanent         永久保护，必须手动在思源笔记中修改属性才能移除

示例:
  protect <doc-id>                    # 设置临时保护
  protect <doc-id> --permanent        # 设置永久保护
  protect <doc-id> --remove           # 移除临时保护
  protect <doc-id> --permanent --remove # 尝试移除永久保护（会失败）`;

/**
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    shortOpts: { r: 'remove', p: 'permanent' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (positionalArgs.length > 0) {
    options.docId = positionalArgs[0];
  }

  if (!options.docId) {
    console.error('错误: 缺少必需的文档ID参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    // 获取文档所属笔记本ID以检查权限（使用 getPathByID 避免 getBlockInfo 的索引问题）
    let notebookId;
    try {
      const pathInfo = await connector.request('/api/filetree/getPathByID', {
        id: options.docId
      });
      notebookId = pathInfo?.box || pathInfo?.notebook;
    } catch (error) {
      if (error.message?.includes('tree not found') || 
          error.message?.includes('404') || 
          error.message?.includes('not found') || 
          error.message?.includes('未找到') || 
          error.message?.includes('不存在')) {
        console.error('错误: 文档不存在');
        process.exit(1);
      }
      throw error;
    }

    if (!notebookId) {
      console.error('错误: 无法获取文档所属笔记本信息');
      process.exit(1);
    }

    // 检查笔记本权限
    checkPermission(config, notebookId);

    // 获取当前属性
    let currentAttrs;
    try {
      currentAttrs = await connector.request('/api/attr/getBlockAttrs', {
        id: options.docId
      });
    } catch (error) {
      // 如果获取属性失败，假设没有属性
      currentAttrs = {};
    }

    if (options.remove) {
      // 移除保护标记前，检查是否为永久保护
      if (currentAttrs && currentAttrs['custom-protected'] === 'permanent') {
        console.error('错误: 文档被标记为永久保护，无法通过命令移除保护');
        console.error('请手动在思源笔记中修改文档属性 custom-protected 来解除保护');
        process.exit(1);
      }

      // 移除保护标记（将属性值设置为空字符串来删除属性）
      const newAttrs = { ...currentAttrs };
      newAttrs['custom-protected'] = '';
      await connector.request('/api/attr/setBlockAttrs', {
        id: options.docId,
        attrs: newAttrs
      });
      console.log(JSON.stringify({
        success: true,
        id: options.docId,
        protected: false,
        level: null,
        message: '保护标记已移除',
        timestamp: Date.now()
      }, null, 2));
    } else {
      // 设置保护标记（与历史版本保持一致：true 表示临时保护，permanent 表示永久保护）
      const protectionValue = options.permanent ? 'permanent' : 'true';
      const newAttrs = {
        ...currentAttrs,
        'custom-protected': protectionValue
      };
      await connector.request('/api/attr/setBlockAttrs', {
        id: options.docId,
        attrs: newAttrs
      });
      console.log(JSON.stringify({
        success: true,
        id: options.docId,
        protected: true,
        level: options.permanent ? 'permanent' : 'protected',
        message: options.permanent ? '文档已设置为永久保护' : '文档已受保护',
        timestamp: Date.now()
      }, null, 2));
    }
    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
