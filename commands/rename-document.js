/**
 * 重命名文档指令
 * 重命名 Siyuan Notes 中的文档标题
 * 
 * API 说明：
 * - /api/filetree/renameDocByID - 通过文档ID重命名
 * - /api/filetree/renameDoc - 通过笔记本ID和路径重命名
 */

const Permission = require('../utils/permission');

/**
 * 指令配置
 */
const command = {
  name: 'rename-document',
  description: '重命名 Siyuan Notes 中的文档标题',
  usage: 'rename-document --doc-id <docId> --title <title>',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.docId - 文档ID
   * @param {string} args.title - 新标题
   * @returns {Promise<Object>} 重命名结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, title } = args;
    
    if (!docId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 docId 参数'
      };
    }
    
    if (!title) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 title 参数'
      };
    }
    
    try {
      console.log('重命名文档参数:', { docId, title });
      
      const result = await skill.connector.request('/api/filetree/renameDocByID', {
        id: docId,
        title: title
      });
      
      console.log('重命名文档成功:', result);
      
      skill.clearCache();
      
      return {
        success: true,
        data: {
          id: docId,
          title: title,
          renamed: true,
          notebookId
        },
        message: '文档重命名成功',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('重命名文档失败:', error);
      return {
        success: false,
        error: error.message,
        message: '重命名文档失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

module.exports = command;
