/**
 * 块移动命令
 * 在 Siyuan Notes 中移动块
 */

const Permission = require('../utils/permission');

/**
 * 命令配置
 */
const command = {
  name: 'move-block',
  description: '在 Siyuan Notes 中移动块',
  usage: 'move-block --id <blockId> [--parent-id <parentId>] [--previous-id <previousId>]',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.id - 要移动的块ID
   * @param {string} args.parentId - 目标父块ID
   * @param {string} args.previousId - 目标前一个块ID
   * @returns {Promise<Object>} 移动结果
   */
  execute: async (skill, args = {}) => {
    const { id, parentId, previousId } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    if (!parentId && !previousId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供至少一个目标位置参数：parentId 或 previousId'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        const requestData = {
          id,
          parentID: parentId || '',
          previousID: previousId || ''
        };
        
        console.log('移动块请求参数:', JSON.stringify(requestData, null, 2));
        
        const result = await skill.connector.request('/api/block/moveBlock', requestData);
        
        console.log('API 响应:', JSON.stringify(result, null, 2));
        
        return {
          success: true,
          data: {
            id,
            operation: 'move',
            timestamp: Date.now(),
            notebookId
          },
          message: '块移动成功'
        };
      } catch (error) {
        console.error('移动块失败:', error);
        return {
          success: false,
          error: error.message,
          message: '移动块失败'
        };
      }
    }, {
      type: 'document',
      idParam: 'id',
      defaultNotebook: skill.config.defaultNotebook
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
