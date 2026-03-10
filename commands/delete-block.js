/**
 * 块删除命令
 * 在 Siyuan Notes 中删除块
 */

const Permission = require('../utils/permission');

/**
 * 命令配置
 */
const command = {
  name: 'delete-block',
  description: '在 Siyuan Notes 中删除块',
  usage: 'delete-block --id <blockId>',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.id - 块ID
   * @returns {Promise<Object>} 删除结果
   */
  execute: async (skill, args = {}) => {
    const { id } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        const requestData = { id };
        
        const result = await skill.connector.request('/api/block/deleteBlock', requestData);
        
        console.log('API 响应:', JSON.stringify(result, null, 2));
        
        if (result === null || result === true || (Array.isArray(result) && result.length > 0) || (result && result.code === 0)) {
          skill.clearCache();
          
          return {
            success: true,
            data: {
              id,
              operation: 'delete',
              timestamp: Date.now(),
              notebookId
            },
            message: '块删除成功'
          };
        } else {
          return {
            success: false,
            error: result?.msg || '块删除失败',
            message: '块删除失败'
          };
        }
      } catch (error) {
        console.error('删除块失败:', error);
        return {
          success: false,
          error: error.message,
          message: '删除块失败'
        };
      }
    }, {
      type: 'block',
      idParam: 'id',
      defaultNotebook: skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
