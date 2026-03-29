/**
 * 获取笔记本列表指令
 * 从 Siyuan Notes 获取所有笔记本信息
 */

const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 指令配置
 */
const command = {
  name: 'notebooks',
  aliases: ['nb'],
  description: '获取所有笔记本列表',
  usage: 'siyuan notebooks',
  sortOrder: 10,
  
  initOptions: {},
  options: {},
  positionalCount: 0,
  
  examples: [
    'siyuan notebooks',
    'siyuan nb'
  ],
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    console.log('获取笔记本列表...');
    const result = await this.execute(skill, {});
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  async execute(skill, args = {}) {
    try {
      const response = await skill.connector.request('/api/notebook/lsNotebooks');
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
