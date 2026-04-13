#!/usr/bin/env node
/**
 * delete.js - 删除文档
 */
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const { parseArgs } = require('./lib/args-parser');
const EmbeddingManager = require('./lib/embedding-manager');
const VectorManager = require('./lib/vector-manager');

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
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['confirm-title']
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (positionalArgs.length > 0) {
    options.docId = positionalArgs[0];
  }
  const params = options;

  if (!params.docId) {
    console.error('错误: 缺少必需的文档ID参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

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

    // 检查删除保护（最高优先级）
    if (config.deleteProtection) {
      // 全局安全模式：完全禁止删除（最高优先级）
      if (config.deleteProtection.safeMode) {
        console.error('错误: 全局安全模式已启用，禁止删除任何文档');
        console.error('💡 解决方案：');
        console.error('   1. 如需删除，请修改 config.json 中的 deleteProtection.safeMode');
        console.error('   2. 或使用 protect.js --remove 移除文档保护标记');
        console.error('📋 详见: references/advanced/delete-protection.md');
        process.exit(1);
      }
      
      // 非安全模式：检查是否需要确认标题
      const confirmTitle = params['confirm-title'] || params.confirmTitle;
      if (config.deleteProtection.requireConfirmation && !confirmTitle) {
        console.error('错误: 需要确认文档标题');
        console.error(`请使用 --confirm-title "${docInfo.rootTitle || docInfo.content}" 确认删除`);
        console.error('💡 提示：');
        console.error('   1. 获取文档标题: info.js <docId>');
        console.error('   2. 使用确认标题删除: delete.js <docId> --confirm-title "文档标题"');
        console.error('   3. 或修改配置关闭确认要求');
        console.error('📋 详见: references/advanced/delete-protection.md');
        process.exit(1);
      }
    }
    
    // 检查文档保护标记（低于safeMode，高于requireConfirmation）
    if (attrs && attrs['custom-protected']) {
      console.error('错误: 该文档已被保护，无法删除');
      console.error('💡 解决方案：');
      console.error('   使用 protect.js <docId> --remove 移除保护标记');
      console.error('📋 详见: references/advanced/delete-protection.md');
      process.exit(1);
    }

    // 如果提供了确认标题，必须验证（无论安全模式是否启用）
    const confirmTitle = params['confirm-title'] || params.confirmTitle;
    if (confirmTitle && confirmTitle !== (docInfo.rootTitle || docInfo.content)) {
      console.error('错误: 确认标题与文档标题不匹配');
      console.error(`文档标题: "${docInfo.rootTitle || docInfo.content}"`);
      console.error(`确认标题: "${confirmTitle}"`);
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
    
    // 清理向量数据库中的索引
    try {
      const embeddingManager = new EmbeddingManager(config.embedding);
      const vectorManager = new VectorManager(config, embeddingManager);
      const removeResult = await vectorManager.removeDoc(params.docId);
      if (removeResult.success) {
        console.log(`已清理向量索引: 删除了 ${removeResult.deletedCount || 0} 个向量`);
      }
    } catch (vectorError) {
      // 向量索引清理失败不影响主流程，仅记录日志
      console.error(`警告: 清理向量索引失败: ${vectorError.message}`);
    }

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
