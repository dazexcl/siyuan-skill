/**
 * 设置标签指令
 * 设置 Siyuan Notes 中块/文档的标签
 * 
 * API 说明：
 * - /api/attr/setBlockAttrs - 设置块属性（标签存储在 tags 属性中）
 * - /api/attr/getBlockAttrs - 获取块属性
 * 
 * 注意：
 * - 标签在思源笔记中是特殊的属性，存储在 'tags' 属性中
 * - 多个标签使用英文逗号分隔
 * - 文档本身也是一种特殊的块，因此设置文档标签也使用相同的 API
 */

const Permission = require('../utils/permission');

/**
 * 指令配置
 */
const command = {
  name: 'tags',
  description: '设置 Siyuan Notes 中块/文档的标签',
  usage: 'tags --id <blockId> --tags <tags> [--add] [--remove] [--get]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.id - 块ID/文档ID
   * @param {string} args.tags - 标签（多个用逗号分隔）
   * @param {boolean} args.add - 添加标签（不覆盖现有标签）
   * @param {boolean} args.remove - 移除标签
   * @param {boolean} args.get - 获取当前标签
   * @returns {Promise<Object>} 标签操作结果
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { id, tags, add, remove, get } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    if (!tags && !get) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 --tags 参数或使用 --get 获取标签'
      };
    }
    
    try {
      if (get) {
        console.log('获取标签参数:', { id });
        
        const result = await skill.connector.request('/api/attr/getBlockAttrs', {
          id
        });
        
        const currentTags = result?.tags || '';
        const tagList = currentTags ? currentTags.split(',').map(t => t.trim()).filter(t => t) : [];
        
        return {
          success: true,
          data: {
            id,
            operation: 'get',
            tags: tagList,
            tagsStr: currentTags,
            timestamp: Date.now(),
            notebookId
          },
          message: '标签获取成功'
        };
      }
      
      const tagList = tags.split(',').map(t => t.trim()).filter(t => t);
      
      if (add || remove) {
        const currentResult = await skill.connector.request('/api/attr/getBlockAttrs', {
          id
        });
        
        const currentTags = currentResult?.tags || '';
        let currentTagList = currentTags ? currentTags.split(',').map(t => t.trim()).filter(t => t) : [];
        
        if (add) {
          for (const tag of tagList) {
            if (!currentTagList.includes(tag)) {
              currentTagList.push(tag);
            }
          }
        } else if (remove) {
          currentTagList = currentTagList.filter(t => !tagList.includes(t));
        }
        
        const newTags = currentTagList.join(',');
        console.log('更新标签:', { id, operation: add ? 'add' : 'remove', newTags });
        
        const result = await skill.connector.request('/api/attr/setBlockAttrs', {
          id,
          attrs: { tags: newTags }
        });
        
        skill.clearCache();
        
        return {
          success: true,
          data: {
            id,
            operation: add ? 'add' : 'remove',
            tags: currentTagList,
            tagsStr: newTags,
            timestamp: Date.now(),
            notebookId
          },
          message: add ? '标签添加成功' : '标签移除成功'
        };
      } else {
        const newTags = tagList.join(',');
        console.log('设置标签:', { id, tags: newTags });
        
        const result = await skill.connector.request('/api/attr/setBlockAttrs', {
          id,
          attrs: { tags: newTags }
        });
        
        skill.clearCache();
        
        return {
          success: true,
          data: {
            id,
            operation: 'set',
            tags: tagList,
            tagsStr: newTags,
            timestamp: Date.now(),
            notebookId
          },
          message: '标签设置成功'
        };
      }
    } catch (error) {
      console.error('操作标签失败:', error);
      return {
        success: false,
        error: error.message,
        message: '操作标签失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'id'
  })
};

module.exports = command;
