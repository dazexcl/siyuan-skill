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
        message: '必须提供 content 参数\n用法: siyuan block-insert <content> --parent-id <parentId>\n示例: siyuan bi "新块内容" --parent-id 20260313203048-cjem96v'
      };
    }
    
    // 位置参数验证（至少提供一个）
    if (!parentId && !previousId && !nextId) {
      return {
        success: false,
        error: '缺少位置参数',
        message: '必须提供至少一个位置参数:\n  --parent-id <父块ID>    作为子块插入\n  --previous-id <块ID>    插入到此块之后\n  --next-id <块ID>        插入到此块之前\n示例: siyuan bi "内容" --parent-id 20260313203048-cjem96v'
      };
    }
    
    // 确定用于权限检查的 ID（优先 parentId，其次 previousId，最后 nextId）
    const idForPermission = parentId || previousId || nextId;
    const permissionType = parentId ? 'parent' : 'block';
    
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
        
        // 清除缓存
        skill.clearCache();
        
        // 尝试从响应中提取块 ID
        let blockId = null;
        if (result && Array.isArray(result) && result.length > 0) {
          const operation = result[0]?.doOperations?.[0];
          blockId = operation?.id;
        }
        
        // 思源 API 返回 null 或空响应也可能表示成功
        // 如果没有错误抛出，认为操作成功
        return {
          success: true,
          data: {
            id: blockId,
            operation: 'insert',
            timestamp: Date.now(),
            notebookId
          },
          message: blockId ? '块插入成功' : '块插入成功（未返回块ID）'
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
      type: permissionType,
      idParam: parentId ? 'parentId' : (previousId ? 'previousId' : 'nextId'),
      defaultNotebook: skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK
    });
    
    return permissionHandler(skill, { ...args, idForPermission: idForPermission });
  }
};

module.exports = command;
