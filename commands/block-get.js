/**
 * 块查询命令
 * 在 Siyuan Notes 中获取块信息
 */

const Permission = require('../utils/permission');

/**
 * 命令配置
 */
const command = {
  name: 'block-get',
  description: '在 Siyuan Notes 中获取块信息',
  usage: 'block-get --id <blockId> --mode <mode>',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.id - 块ID
   * @param {string} args.mode - 查询模式 (kramdown/children)
   * @returns {Promise<Object>} 查询结果
   */
  execute: async (skill, args = {}) => {
    const { id, mode = 'kramdown' } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        let result;
        
        console.log('请求参数:', { id, mode });
        
        if (mode === 'children') {
          result = await skill.connector.request('/api/block/getChildBlocks', { id });
        } else {
          result = await skill.connector.request('/api/block/getBlockKramdown', { id });
        }
        
        console.log('API 响应:', JSON.stringify(result, null, 2));
        
        // 处理响应 - 检查多种可能的响应格式
        if (result && (
            (typeof result === 'object' && (result.code === 0 || (Array.isArray(result) && result.length > 0))) || 
            (typeof result === 'object' && result !== null && Object.keys(result).length > 0) ||
            Array.isArray(result)
        )) {
          const responseData = (result && result.code === 0) ? result.data : result;
          
          return {
            success: true,
            data: {
              id,
              mode,
              result: responseData,
              timestamp: Date.now(),
              notebookId
            },
            message: '块查询成功'
          };
        }
        
        return {
          success: false,
          error: '块查询失败',
          message: '块查询失败'
        };
      } catch (error) {
        console.error('查询块失败:', error);
        return {
          success: false,
          error: error.message,
          message: '查询块失败'
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
