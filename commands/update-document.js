/**
 * 更新文档指令
 * 更新 Siyuan Notes 中的文档内容
 * 
 * 设计说明：
 * 思源笔记中，文档本身也是一种特殊的块（文档块），文档块ID = 文档ID
 * 因此使用 /api/block/updateBlock 更新文档是符合思源设计理念的
 * 
 * 注意：/api/filetree/ 下没有 updateDoc API，官方只提供 createDocWithMd
 */

const Permission = require('../utils/permission');

/**
 * 指令配置
 */
const command = {
  name: 'update-document',
  description: '更新 Siyuan Notes 中的文档内容（实际更新文档块）',
  usage: 'update-document --doc-id <docId> --content <content>',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.docId - 文档ID（也是文档块ID）
   * @param {string} args.content - 新的文档内容（Markdown格式）
   * @returns {Promise<Object>} 更新结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, content } = args;
    
    if (content === undefined) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 content 参数'
      };
    }
    
    try {
      console.log('更新文档参数:', { docId, contentLength: content.length });
      
      const normalizedContent = content ? content.replace(/\\n/g, '\n') : '';
      
      const result = await skill.connector.request('/api/block/updateBlock', {
        id: docId,
        data: normalizedContent,
        dataType: 'markdown'
      });
      
      console.log('更新文档成功:', result);
      
      skill.clearCache();
      
      return {
        success: true,
        data: {
          id: docId,
          contentLength: content.length,
          updated: true,
          notebookId
        },
        message: '文档更新成功',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('更新文档失败:', error);
      return {
        success: false,
        error: error.message,
        message: '更新文档失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

module.exports = command;