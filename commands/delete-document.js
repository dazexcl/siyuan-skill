/**
 * 删除文档指令
 * 删除 Siyuan Notes 中的文档
 * 
 * 多层保护机制：
 * 1. 全局安全模式 - 禁止所有删除操作
 * 2. 文档保护标记 - 通过属性标记重要文档
 * 3. 删除确认机制 - 需要传入文档标题确认
 * 
 * 注意：此命令仅用于删除文档，不能删除普通块
 * 如需删除普通块，请使用 block-delete 命令
 */

const Permission = require('../utils/permission');
const DeleteProtection = require('../utils/delete-protection');

/**
 * 检查ID是否为文档块（rootID === id）
 * @param {SiyuanNotesSkill} skill - 技能实例
 * @param {string} id - 块/文档ID
 * @returns {Promise<{isDocument: boolean, blockInfo: Object|null}>}
 */
async function checkIfDocumentBlock(skill, id) {
  try {
    const blockInfo = await skill.connector.request('/api/block/getBlockInfo', { id });
    
    if (!blockInfo || typeof blockInfo !== 'object') {
      return { isDocument: false, blockInfo: null };
    }
    
    const rootId = blockInfo.rootID || blockInfo.root_id || blockInfo.rootChildID;
    const isDocument = rootId === id;
    
    return { isDocument, blockInfo };
  } catch (error) {
    console.warn('获取块信息失败:', error.message);
    return { isDocument: false, blockInfo: null };
  }
}

/**
 * 指令配置
 */
const command = {
  name: 'delete-document',
  description: '删除 Siyuan Notes 中的文档（受多层保护机制约束，仅限文档）',
  usage: 'delete-document --doc-id <docId> [--confirm-title <title>]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.docId - 文档ID
   * @param {string} [args.confirmTitle] - 确认标题（当启用删除确认时需要）
   * @returns {Promise<Object>} 删除结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, confirmTitle } = args;
    
    try {
      console.log('开始删除文档，文档ID:', docId);
      
      const { isDocument, blockInfo } = await checkIfDocumentBlock(skill, docId);
      
      if (!isDocument && blockInfo) {
        const rootTitle = blockInfo.rootTitle || blockInfo.rootID || docId;
        return {
          success: false,
          error: '无效操作',
          message: `传入的 ID "${docId}" 是普通块而非文档。删除块请使用 block-delete 命令：siyuan bd --id ${docId}`,
          hint: `所属文档: "${rootTitle}"`,
          blockType: 'block'
        };
      }
      
      const protectionResult = await DeleteProtection.checkDeletePermission(skill, docId, {
        confirmTitle
      });
      
      if (!protectionResult.allowed) {
        console.warn('删除操作被阻止:', protectionResult.reason);
        return {
          success: false,
          error: '删除保护',
          message: protectionResult.reason,
          protectionLevel: protectionResult.level
        };
      }
      
      if (protectionResult.actualTitle) {
        console.log('删除确认通过，文档标题:', protectionResult.actualTitle);
      }
      
      console.log('调用删除文档API:', '/api/filetree/removeDocByID', { id: docId });
      
      const result = await skill.connector.request('/api/filetree/removeDocByID', {
        id: docId
      });
      console.log('删除文档API返回结果:', result);
      
      skill.clearCache();
      console.log('缓存已清除');
      
      return {
        success: true,
        data: {
          id: docId,
          deleted: true,
          notebookId,
          title: protectionResult.actualTitle,
          timestamp: Date.now()
        },
        message: '文档删除成功',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('删除文档过程中出错:', error);
      return {
        success: false,
        error: error.message,
        message: '删除文档失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

module.exports = command;
