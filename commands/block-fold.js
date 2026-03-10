/**
 * 块折叠/展开命令
 * 在 Siyuan Notes 中折叠或展开块
 */

const Permission = require('../utils/permission');

/**
 * 命令配置
 */
const command = {
  name: 'block-fold',
  description: '在 Siyuan Notes 中折叠或展开块',
  usage: 'block-fold <blockId> [--action <fold|unfold>]',
  
  /**
   * 执行命令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 命令参数
   * @param {string} args.id - 块ID
   * @param {string} [args.action] - 操作类型：fold（折叠）或 unfold（展开），默认 fold
   * @returns {Promise<Object>} 操作结果
   */
  execute: async (skill, args = {}) => {
    const { id, action = 'fold' } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    const validActions = ['fold', 'unfold'];
    const normalizedAction = action.toLowerCase();
    
    if (!validActions.includes(normalizedAction)) {
      return {
        success: false,
        error: '无效的操作类型',
        message: `action 参数必须是 fold 或 unfold，当前值: ${action}`
      };
    }
    
    const permissionHandler = Permission.createPermissionWrapper(async (skill, args, notebookId) => {
      try {
        const apiEndpoint = normalizedAction === 'fold' 
          ? '/api/block/foldBlock' 
          : '/api/block/unfoldBlock';
        
        const result = await skill.connector.request(apiEndpoint, { id });
        
        console.log('API 响应:', JSON.stringify(result, null, 2));
        
        if (result === null || result === undefined || 
            (result && (result.code === 0 || (Array.isArray(result) && result.length > 0))) || 
            (typeof result === 'object' && result !== null && Object.keys(result).length === 0)) {
          skill.clearCache();
          
          return {
            success: true,
            data: {
              id,
              operation: normalizedAction,
              timestamp: Date.now(),
              notebookId
            },
            message: normalizedAction === 'fold' ? '块折叠成功' : '块展开成功'
          };
        }
        
        return {
          success: false,
          error: `块${normalizedAction === 'fold' ? '折叠' : '展开'}失败`,
          message: `块${normalizedAction === 'fold' ? '折叠' : '展开'}失败`
        };
      } catch (error) {
        console.error(`${normalizedAction === 'fold' ? '折叠' : '展开'}块失败:`, error);
        return {
          success: false,
          error: error.message,
          message: `${normalizedAction === 'fold' ? '折叠' : '展开'}块失败`
        };
      }
    }, {
      type: 'block',
      idParam: 'id',
      defaultNotebook: skill.config.defaultNotebook || process.env.SIYUAN_DEFAULT_NOTEBOOK
    });
    
    return permissionHandler(skill, args);
  }
};

module.exports = command;
