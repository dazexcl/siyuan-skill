/**
 * 重命名文档指令
 * 重命名 Siyuan Notes 中的文档标题
 * 
 * API 说明：
 * - /api/filetree/renameDocByID - 通过文档ID重命名
 * - /api/filetree/renameDoc - 通过笔记本ID和路径重命名
 */

const Permission = require('../utils/permission');

/**
 * 指令配置
 */
const command = {
  name: 'rename-document',
  description: '重命名 Siyuan Notes 中的文档标题',
  usage: 'rename-document --doc-id <docId> --title <title>',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.docId - 文档ID
   * @param {string} args.title - 新标题
   * @returns {Promise<Object>} 重命名结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, title, force } = args;
    
    if (!docId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 docId 参数'
      };
    }
    
    if (!title) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 title 参数'
      };
    }
    
    // 重名检测：检查同一目录下是否已存在同名文档（除非使用 --force）
    if (!force) {
      try {
        // 获取文档的 hPath（人类可读路径）
        const hPath = await skill.connector.request('/api/filetree/getHPathByID', { id: docId });
        let parentId = notebookId;
        
        if (hPath && hPath !== '/') {
          // 从 hPath 提取父文档路径
          const pathParts = hPath.split('/');
          pathParts.pop(); // 移除当前文档名
          const parentHPath = pathParts.join('/');
          
          if (parentHPath) {
            // 通过 hPath 获取父文档 ID
            const parentIds = await skill.connector.request('/api/filetree/getIDsByHPath', {
              path: parentHPath,
              notebook: notebookId
            });
            if (parentIds && parentIds.length > 0) {
              parentId = parentIds[0];
            }
          }
        }
        
        // 检查同名文档（排除自身）
        const existingDoc = await skill.documentManager.checkDocumentExists(
          notebookId,
          parentId,
          title,
          docId
        );
        
        if (existingDoc) {
          return {
            success: false,
            error: '文档名称冲突',
            message: `在目标位置已存在标题为"${title}"的文档（ID: ${existingDoc.id}），请使用 --force 参数强制重命名`
          };
        }
      } catch (error) {
        console.warn('重名检测失败:', error.message);
      }
    }
    
    try {
      console.log('重命名文档参数:', { docId, title });
      
      const result = await skill.connector.request('/api/filetree/renameDocByID', {
        id: docId,
        title: title
      });
      
      console.log('重命名文档成功:', result);
      
      return {
        success: true,
        data: {
          id: docId,
          title: title,
          renamed: true,
          notebookId
        },
        message: '文档重命名成功',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('重命名文档失败:', error);
      return {
        success: false,
        error: error.message,
        message: '重命名文档失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

module.exports = command;
