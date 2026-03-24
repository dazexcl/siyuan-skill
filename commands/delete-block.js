/**
 * 块删除命令
 * 在 Siyuan Notes 中删除块
 * 
 * 注意：此命令仅用于删除普通块，不能删除文档
 * 如需删除文档，请使用 delete 命令（delete-document）
 */

const Permission = require('../utils/permission');

/**
 * 检查块是否为文档块
 * @param {SiyuanNotesSkill} skill - 技能实例
 * @param {string} blockId - 块ID
 * @returns {Promise<{isDocument: boolean, blockInfo: Object|null}>}
 */
async function checkIfDocumentBlock(skill, blockId) {
  try {
    const blockInfo = await skill.connector.request('/api/block/getBlockInfo', { id: blockId });
    
    if (!blockInfo || typeof blockInfo !== 'object') {
      return { isDocument: false, blockInfo: null };
    }
    
    const rootId = blockInfo.rootID || blockInfo.root_id || blockInfo.rootChildID;
    const isDocument = rootId === blockId;
    
    return { isDocument, blockInfo };
  } catch (error) {
    console.warn('获取块信息失败:', error.message);
    return { isDocument: false, blockInfo: null };
  }
}

/**
 * 命令配置
 */
const command = {
  name: 'delete-block',
  description: '在 Siyuan Notes 中删除块（仅限普通块，文档请使用 delete 命令）',
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
        const { isDocument, blockInfo } = await checkIfDocumentBlock(skill, id);
        
        if (isDocument) {
          const docTitle = blockInfo?.rootTitle || blockInfo?.content || id;
          return {
            success: false,
            error: '无效操作',
            message: `传入的 ID "${id}" 是文档而非普通块。删除文档请使用 delete 命令：siyuan delete --doc-id ${id}`,
            hint: `文档标题: "${docTitle}"`,
            blockType: 'document'
          };
        }
        
        console.log('检测到普通块，使用 deleteBlock API');
        const result = await skill.connector.request('/api/block/deleteBlock', { id });
        console.log('deleteBlock API 响应:', JSON.stringify(result, null, 2));
        
        if (result === null || result === true || 
            (Array.isArray(result) && result.length > 0) || 
            (result && result.code === 0) ||
            (result && typeof result === 'object' && !result.code)) {
          
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
      defaultNotebook: skill.config.defaultNotebook
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
