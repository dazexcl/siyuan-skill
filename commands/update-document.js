/**
 * 文档更新命令
 * 在 Siyuan Notes 中更新文档内容
 * 
 * 限制说明：
 * - 只接受文档ID（type='d'）
 * - 不接受块ID，块更新请使用 block-update 命令
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
 * 验证ID是否为文档ID
 * @param {SiyuanNotesSkill} skill - 技能实例
 * @param {string} id - 要验证的ID
 * @returns {Promise<Object>} 验证结果 { isDoc: boolean, error?: string }
 */
async function validateDocId(skill, id) {
  try {
    const blockInfo = await skill.connector.request('/api/block/getBlockInfo', { id });
    
    if (!blockInfo) {
      return { isDoc: false, error: '无法获取文档信息，请检查ID是否正确' };
    }
    
    if (blockInfo.rootID === id && blockInfo.path && blockInfo.path.endsWith('.sy')) {
      return { isDoc: true };
    }
    
    if (blockInfo.rootID !== id) {
      return { 
        isDoc: false, 
        error: `传入的ID是子块，不是文档。请使用 block-update 命令更新块内容` 
      };
    }
    
    return { isDoc: true };
  } catch (error) {
    return { isDoc: false, error: `验证文档ID失败: ${error.message}` };
  }
}

/**
 * 命令配置
 */
const command = {
  name: 'update-document',
  description: '在 Siyuan Notes 中更新文档内容（仅接受文档ID）',
  usage: 'update --doc-id <docId> --content <content> [--data-type <dataType>]',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.docId - 文档ID（必需）
   * @param {string} args.content - 新内容（必需）
   * @param {string} args.dataType - 数据类型（markdown/dom，默认 markdown）
   * @returns {Promise<Object>} 更新结果
   */
  execute: async (skill, args = {}) => {
    const docId = args.docId || args['doc-id'] || args.id;
    const content = args.content || args.data;
    const dataType = args.dataType || args['data-type'] || 'markdown';
    
    if (!docId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 docId 参数'
      };
    }
    
    if (content === undefined) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 content 参数'
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        const validation = await validateDocId(skill, docId);
        
        if (!validation.isDoc) {
          return {
            success: false,
            error: '参数类型错误',
            message: validation.error
          };
        }
        
        const processedContent = processContent(content);
        
        const requestData = {
          id: docId,
          dataType,
          data: processedContent
        };
        
        console.log('更新文档参数:', { docId, dataType, contentLength: processedContent.length });
        
        const result = await skill.connector.request('/api/block/updateBlock', requestData);
        
        console.log('更新文档成功:', result);
        
        if (result && Array.isArray(result) && result.length > 0) {
          const operation = result[0]?.doOperations?.[0];
          
          if (operation) {
            skill.clearCache();
            
            return {
              success: true,
              data: {
                docId,
                operation: 'update-document',
                contentLength: content.length,
                timestamp: Date.now(),
                notebookId
              },
              message: '文档更新成功'
            };
          }
        }
        
        if (result === null || (result && result.code === 0)) {
          skill.clearCache();
          
          return {
            success: true,
            data: {
              docId,
              operation: 'update-document',
              contentLength: content.length,
              timestamp: Date.now(),
              notebookId
            },
            message: '文档更新成功'
          };
        }
        
        return {
          success: false,
          error: '文档更新失败',
          message: '文档更新失败'
        };
      } catch (error) {
        console.error('更新文档失败:', error);
        return {
          success: false,
          error: error.message,
          message: '更新文档失败'
        };
      }
    }, {
      type: 'document',
      idParam: 'docId',
      defaultNotebook: skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
