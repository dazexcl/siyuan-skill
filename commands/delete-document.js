/**
 * 删除文档指令
 * 删除 Siyuan Notes 中的文档
 */

const Permission = require('../utils/permission');

/**
 * 指令配置
 */
const command = {
  name: 'delete-document',
  description: '删除 Siyuan Notes 中的文档',
  usage: 'delete-document --doc-id <docId>',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.docId - 文档ID
   * @returns {Promise<Object>} 删除结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId } = args;
    
    try {
      console.log('开始删除文档，文档ID:', docId);
      
      console.log('调用删除文档API:', '/api/filetree/removeDocByID', { id: docId });
      
      // 使用正确的 removeDocByID API
      const result = await skill.connector.request('/api/filetree/removeDocByID', {
        id: docId
      });
      console.log('删除文档API返回结果:', result);
      
      // 清除缓存
      skill.clearCache();
      console.log('缓存已清除');
      
      return {
        success: true,
        data: {
          id: docId,
          deleted: true,
          notebookId,
          timestamp: Date.now()
        },
        message: '文档删除成功',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('删除文档过程中出错:', error);
      return {
        success: false,
        error: error.message,
        message: '删除文档失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

module.exports = command;