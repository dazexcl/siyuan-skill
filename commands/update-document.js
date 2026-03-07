/**
 * 更新文档指令
 * 更新 Siyuan Notes 中的文档内容
 */

const Permission = require('../utils/permission');

/**
 * 指令配置
 */
const command = {
  name: 'update-document',
  description: '更新 Siyuan Notes 中的文档内容',
  usage: 'update-document --doc-id <docId> --content <content>',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.docId - 文档ID
   * @param {string} args.content - 新的文档内容
   * @returns {Promise<Object>} 更新结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, content } = args;
    
    if (content === undefined) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 content 参数'
      };
    }
    
    try {
      console.log('更新文档参数:', { docId, contentLength: content.length });
      
      // 处理content中的换行符，将字面量\n转换为实际换行
      const normalizedContent = content ? content.replace(/\\n/g, '\n') : '';
      
      // 尝试使用不同的API参数格式
      let result;
      try {
        // 尝试使用标准格式，指定dataType为markdown
        result = await skill.connector.request('/api/block/updateBlock', {
          id: docId,
          data: normalizedContent,
          dataType: 'markdown'
        });
        console.log('更新API返回结果:', result);
      } catch (error) {
        console.error('更新失败:', error.message);
        
        // 尝试使用其他API
        try {
          result = await skill.connector.request('/api/filetree/updateDoc', {
            id: docId,
            content: normalizedContent
          });
          console.log('使用updateDoc API成功:', result);
        } catch (error2) {
          console.error('updateDoc API也失败:', error2.message);
          throw error2;
        }
      }
      
      // 清除缓存
      skill.clearCache();
      
      return {
        success: true,
        data: {
          id: docId,
          contentLength: content.length,
          updated: true,
          notebookId
        },
        message: '文档更新成功',
        timestamp: Date.now()
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
    idParam: 'docId'
  })
};

module.exports = command;