/**
 * 转移块引用命令
 * 在 Siyuan Notes 中转移块引用
 */

const Permission = require('../utils/permission');

/**
 * 解析引用ID列表
 * @param {string} refIdsStr - 引用ID字符串（逗号分隔）
 * @returns {Array<string>} 引用ID数组
 */
function parseRefIds(refIdsStr) {
  if (!refIdsStr) return [];
  
  return refIdsStr.split(',').map(id => id.trim()).filter(id => id.length > 0);
}

/**
 * 命令配置
 */
const command = {
  name: 'transfer-block-ref',
  description: '在 Siyuan Notes 中转移块引用',
  usage: 'transfer-block-ref --from-id <fromId> --to-id <toId> [--ref-ids <refIds>]',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.fromId - 定义块 ID
   * @param {string} args.toId - 目标块 ID
   * @param {string} args.refIds - 引用块 ID（逗号分隔，可选）
   * @returns {Promise<Object>} 转移结果
   */
  execute: async (skill, args = {}) => {
    const { fromId, toId, refIds } = args;
    
    if (!fromId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 from-id 参数'
      };
    }
    
    if (!toId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 to-id 参数'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        const requestData = {
          fromID: fromId,
          toID: toId
        };
        
        const refIdsArray = parseRefIds(refIds);
        if (refIdsArray.length > 0) {
          requestData.refIDs = refIdsArray;
        }
        
        const result = await skill.connector.request('/api/block/transferBlockRef', requestData);
        
        console.log('API 响应:', JSON.stringify(result, null, 2));
        
        // 处理响应 - API 返回 null 或 code 0 或空对象或数组
        if (result === null || result === undefined || 
            (result && (result.code === 0 || (Array.isArray(result) && result.length > 0))) || 
            (typeof result === 'object' && result !== null && Object.keys(result).length === 0)) {
          
          return {
            success: true,
            data: {
              fromId,
              toId,
              refIds: refIdsArray,
              operation: 'transfer',
              timestamp: Date.now(),
              notebookId
            },
            message: '块引用转移成功'
          };
        }
        
        return {
          success: false,
          error: '块引用转移失败',
          message: '块引用转移失败'
        };
      } catch (error) {
        console.error('转移块引用失败:', error);
        return {
          success: false,
          error: error.message,
          message: '转移块引用失败'
        };
      }
    }, {
      type: 'document',
      idParam: 'fromId',
      defaultNotebook: skill.config.defaultNotebook
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
