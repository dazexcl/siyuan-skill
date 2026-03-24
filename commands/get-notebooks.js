/**
 * 获取笔记本列表指令
 * 从 Siyuan Notes 获取所有笔记本信息
 */

/**
 * 指令配置
 */
const command = {
  name: 'get-notebooks',
  description: '获取 Siyuan Notes 中的所有笔记本列表',
  usage: 'get-notebooks',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @returns {Promise<Object>} 笔记本列表
   */
  async execute(skill, args = {}) {
    try {
      // 从 API 获取数据
      const response = await skill.connector.request('/api/notebook/lsNotebooks');
      
      // 提取笔记本列表
      const notebooks = response?.notebooks || [];
      
      return {
        success: true,
        data: notebooks,
        timestamp: Date.now(),
        count: notebooks.length
      };
    } catch (error) {
      console.error('获取笔记本列表失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取笔记本列表失败'
      };
    }
  }
};

module.exports = command;
