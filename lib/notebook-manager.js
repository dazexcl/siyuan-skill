/**
 * 笔记本管理器
 * 提供笔记本相关的核心功能
 */

/**
 * NotebookManager 类
 * 管理笔记本的获取、创建、删除等操作
 */
class NotebookManager {
  /**
   * 构造函数
   * @param {Object} connector - Siyuan 连接器实例
   */
  constructor(connector) {
    this.connector = connector;
  }

  /**
   * 获取所有笔记本
   * @returns {Promise<Object>} 笔记本列表
   */
  async getNotebooks() {
    const response = await this.connector.request('/api/notebook/lsNotebooks');
    const notebooks = response?.notebooks || [];

    return {
      success: true,
      data: notebooks
    };
  }

  /**
   * 打开笔记本
   * @param {string} notebookId - 笔记本ID
   * @returns {Promise<Object>} 操作结果
   */
  async openNotebook(notebookId) {
    await this.connector.request('/api/notebook/openNotebook', { notebook: notebookId });
    return { success: true };
  }

  /**
   * 关闭笔记本
   * @param {string} notebookId - 笔记本ID
   * @returns {Promise<Object>} 操作结果
   */
  async closeNotebook(notebookId) {
    await this.connector.request('/api/notebook/closeNotebook', { notebook: notebookId });
    return { success: true };
  }

  /**
   * 获取笔记本配置
   * @param {string} notebookId - 笔记本ID
   * @returns {Promise<Object>} 笔记本配置
   */
  async getNotebookConf(notebookId) {
    const conf = await this.connector.request('/api/notebook/getNotebookConf', { notebook: notebookId });

    return {
      success: true,
      data: conf
    };
  }
}

module.exports = NotebookManager;
