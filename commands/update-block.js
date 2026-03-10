/**
 * 块更新命令
 * 在 Siyuan Notes 中更新块内容
 */

const Permission = require('../utils/permission');

/**
 * 辅助函数：处理内容中的换行符
 * @param {string} content - 原始内容
 * @returns {string} 处理后的内容
 */
function processContent(content) {
  return content ? content.replace(/\\n/g, '\n') : '';
}

/**
 * 命令配置
 */
const command = {
  name: 'update-block',
  description: '在 Siyuan Notes 中更新块内容',
  usage: 'update-block --id <blockId> --data <content> [--data-type <dataType>]',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.id - 块ID
   * @param {string} args.data - 新内容
   * @param {string} args.dataType - 数据类型（markdown/dom）
   * @returns {Promise<Object>} 更新结果
   */
  execute: async (skill, args = {}) => {
    const { id, data, dataType = 'markdown' } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    if (!data) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 data 参数'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        const processedData = processContent(data);
        
        const requestData = {
          id,
          dataType,
          data: processedData
        };
        
        const result = await skill.connector.request('/api/block/updateBlock', requestData);
        
        // 处理响应 - API 返回的是数组格式
        if (result && Array.isArray(result) && result.length > 0) {
          const operation = result[0]?.doOperations?.[0];
          
          if (operation) {
            skill.clearCache();
            
            return {
              success: true,
              data: {
                id,
                operation: 'update',
                timestamp: Date.now(),
                notebookId
              },
              message: '块更新成功'
            };
          }
        }
        
        return {
          success: false,
          error: '块更新失败',
          message: '块更新失败'
        };
      } catch (error) {
        console.error('更新块失败:', error);
        return {
          success: false,
          error: error.message,
          message: '更新块失败'
        };
      }
    }, {
      type: 'document',
      idParam: 'id',
      defaultNotebook: skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
