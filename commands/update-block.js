/**
 * 块更新命令
 * 在 Siyuan Notes 中更新块内容
 * 
 * 限制说明：
 * - 只接受块ID（type != 'd'）
 * - 不接受文档ID，文档更新请使用 update 命令
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
 * 验证ID是否为块ID（非文档ID）
 * @param {SiyuanNotesSkill} skill - 技能实例
 * @param {string} id - 要验证的ID
 * @returns {Promise<Object>} 验证结果 { isBlock: boolean, error?: string }
 */
async function validateBlockId(skill, id) {
  try {
    const blockInfo = await skill.connector.request('/api/block/getBlockInfo', { id });
    
    if (!blockInfo) {
      return { isBlock: false, error: '无法获取块信息，请检查ID是否正确' };
    }
    
    if (blockInfo.rootID === id && blockInfo.path && blockInfo.path.endsWith('.sy')) {
      return { 
        isBlock: false, 
        error: `传入的ID是文档。请使用 update 命令更新文档内容` 
      };
    }
    
    return { isBlock: true };
  } catch (error) {
    return { isBlock: false, error: `验证块ID失败: ${error.message}` };
  }
}

/**
 * 命令配置
 */
const command = {
  name: 'block-update',
  description: '在 Siyuan Notes 中更新块内容（仅接受块ID，非文档ID）',
  usage: 'block-update --id <blockId> --data <content> [--data-type <dataType>]',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.id - 块ID（必需，非文档ID）
   * @param {string} args.data - 新内容（必需）
   * @param {string} args.dataType - 数据类型（markdown/dom，默认 markdown）
   * @returns {Promise<Object>} 更新结果
   */
  execute: async (skill, args = {}) => {
    const id = args.id || args.blockId || args['block-id'];
    const data = args.data || args.content;
    const dataType = args.dataType || args['data-type'] || 'markdown';
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数（块ID）'
      };
    }
    
    if (data === undefined) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 data 参数'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        const validation = await validateBlockId(skill, id);
        
        if (!validation.isBlock) {
          return {
            success: false,
            error: '参数类型错误',
            message: validation.error
          };
        }
        
        const processedData = processContent(data);
        
        const requestData = {
          id,
          dataType,
          data: processedData
        };
        
        console.log('更新块参数:', { id, dataType, dataLength: processedData.length });
        
        const result = await skill.connector.request('/api/block/updateBlock', requestData);
        
        console.log('更新块成功:', result);
        
        if (result && Array.isArray(result) && result.length > 0) {
          const operation = result[0]?.doOperations?.[0];
          
          if (operation) {
            
            return {
              success: true,
              data: {
                id,
                operation: 'block-update',
                contentLength: data.length,
                timestamp: Date.now(),
                notebookId
              },
              message: '块更新成功'
            };
          }
        }
        
        if (result === null || (result && result.code === 0)) {
          
          return {
            success: true,
            data: {
              id,
              operation: 'block-update',
              contentLength: data.length,
              timestamp: Date.now(),
              notebookId
            },
            message: '块更新成功'
          };
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
      type: 'block',
      idParam: 'id',
      defaultNotebook: skill.config.defaultNotebook
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
