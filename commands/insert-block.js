/**
 * 块插入命令
 * 在 Siyuan Notes 中插入新块
 */

const Permission = require('../utils/permission');

/**
 * 辅助函数：处理内容中的换行符
 * @param {string} content - 原始内容
 * @returns {string} 处理后的内容
 */
function processContent(content) {
  // 处理content中的换行符，将字面量\n转换为实际换行
  return content ? content.replace(/\\n/g, '\n') : '';
}

/**
 * 命令配置
 */
const command = {
  name: 'insert-block',
  description: '在 Siyuan Notes 中插入新块',
  usage: 'insert-block --data <content> [--parent-id <parentId>] [--previous-id <previousId>] [--next-id <nextId>] [--data-type <dataType>]',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.data - 块内容
   * @param {string} args.dataType - 数据类型（markdown/dom）
   * @param {string} args.parentId - 父块ID
   * @param {string} args.previousId - 前一个块ID
   * @param {string} args.nextId - 后一个块ID
   * @returns {Promise<Object>} 插入结果
   */
  execute: async (skill, args = {}) => {
    const { data, dataType = 'markdown', parentId, previousId, nextId } = args;
    
    // 参数验证
    if (!data) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 data 参数'
      };
    }
    
    // 位置参数验证（至少提供一个）
    if (!parentId && !previousId && !nextId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供至少一个位置参数：parentId、previousId 或 nextId'
      };
    }
    
    // 使用权限包装器
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        // 处理内容中的换行符
        const processedData = processContent(data);
        
        // 构建请求参数
        const requestData = {
          dataType,
          data: processedData,
          parentID: parentId || '',
          previousID: previousId || '',
          nextID: nextId || ''
        };
        
        // 调用 API
        console.log('请求参数:', JSON.stringify(requestData, null, 2));
        const result = await skill.connector.request('/api/block/insertBlock', requestData);
        console.log('API 响应:', JSON.stringify(result, null, 2));
        
        // 处理响应 - API 返回的是数组格式
        if (result && Array.isArray(result) && result.length > 0) {
          const operation = result[0]?.doOperations?.[0];
          const blockId = operation?.id;
          
          if (blockId) {
            // 清除缓存
            skill.clearCache();
            
            return {
              success: true,
              data: {
                id: blockId,
                operation: 'insert',
                timestamp: Date.now(),
                notebookId
              },
              message: '块插入成功'
            };
          }
        }
        
        return {
          success: false,
          error: '块插入失败',
          message: '块插入失败'
        };
      } catch (error) {
        console.error('插入块失败:', error);
        return {
          success: false,
          error: error.message,
          message: '插入块失败'
        };
      }
    }, {
      type: 'parent',
      idParam: 'parentId',
      defaultNotebook: skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
