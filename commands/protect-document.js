/**
 * 文档保护指令
 * 管理文档的保护标记，防止被误删除
 */

const Permission = require('../utils/permission');
const DeleteProtection = require('../utils/delete-protection');

/**
 * 指令配置
 */
const command = {
  name: 'protect-document',
  description: '设置或移除文档保护标记，防止文档被删除',
  usage: 'protect-document --doc-id <docId> [--remove] [--permanent]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.docId - 文档ID
   * @param {boolean} [args.remove] - 移除保护标记
   * @param {boolean} [args.permanent] - 设置为永久保护
   * @returns {Promise<Object>} 操作结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, remove, permanent } = args;
    
    try {
      let protectedStatus;
      
      if (remove) {
        const attrs = await skill.connector.request('/api/attr/getBlockAttrs', {
          id: docId
        });
        
        if (attrs && attrs['custom-protected'] === 'permanent') {
          return {
            success: false,
            error: '永久保护',
            message: '文档被标记为永久保护，无法通过命令移除保护。需要手动在思源笔记中修改属性。'
          };
        }
        
        protectedStatus = false;
      } else if (permanent) {
        protectedStatus = 'permanent';
      } else {
        protectedStatus = true;
      }
      
      const result = await DeleteProtection.setDocumentProtection(skill, docId, protectedStatus);
      
      if (result.success) {
        return {
          success: true,
          data: {
            id: docId,
            protected: protectedStatus ? true : false,
            protectionType: protectedStatus || null,
            notebookId
          },
          message: result.message,
          timestamp: Date.now()
        };
      } else {
        return {
          success: false,
          error: '操作失败',
          message: result.message
        };
      }
    } catch (error) {
      console.error('设置文档保护失败:', error);
      return {
        success: false,
        error: error.message,
        message: '设置文档保护失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

module.exports = command;
