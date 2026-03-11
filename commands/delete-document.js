/**
 * 删除文档指令
 * 删除 Siyuan Notes 中的文档
 * 
 * 多层保护机制：
 * 1. 全局安全模式 - 禁止所有删除操作
 * 2. 文档保护标记 - 通过属性标记重要文档
 * 3. 删除确认机制 - 需要传入文档标题确认
 */

const Permission = require('../utils/permission');
const DeleteProtection = require('../utils/delete-protection');

/**
 * 指令配置
 */
const command = {
  name: 'delete-document',
  description: '删除 Siyuan Notes 中的文档（受多层保护机制约束）',
  usage: 'delete-document --doc-id <docId> [--confirm-title <title>]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.docId - 文档ID
   * @param {string} [args.confirmTitle] - 确认标题（当启用删除确认时需要）
   * @returns {Promise<Object>} 删除结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, confirmTitle } = args;
    
    try {
      console.log('开始删除文档，文档ID:', docId);
      
      const protectionResult = await DeleteProtection.checkDeletePermission(skill, docId, {
        confirmTitle
      });
      
      if (!protectionResult.allowed) {
        console.warn('删除操作被阻止:', protectionResult.reason);
        return {
          success: false,
          error: '删除保护',
          message: protectionResult.reason,
          protectionLevel: protectionResult.level
        };
      }
      
      if (protectionResult.actualTitle) {
        console.log('删除确认通过，文档标题:', protectionResult.actualTitle);
      }
      
      console.log('调用删除文档API:', '/api/filetree/removeDocByID', { id: docId });
      
      const result = await skill.connector.request('/api/filetree/removeDocByID', {
        id: docId
      });
      console.log('删除文档API返回结果:', result);
      
      skill.clearCache();
      console.log('缓存已清除');
      
      return {
        success: true,
        data: {
          id: docId,
          deleted: true,
          notebookId,
          title: protectionResult.actualTitle,
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
