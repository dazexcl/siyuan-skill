/**
 * 数据格式化工具
 * 提供数据格式化和转换功能
 */

/**
 * Formatter 类
 * 提供各种数据格式化方法
 */
class Formatter {
  /**
   * 格式化响应结果
   * @param {boolean} success - 是否成功
   * @param {any} data - 响应数据
   * @param {string} [message] - 响应消息
   * @param {string} [error] - 错误信息
   * @returns {Object} 格式化后的响应对象
   */
  static formatResponse(success, data, message, error) {
    const response = {
      success,
      timestamp: Date.now()
    };

    if (data !== undefined) {
      response.data = data;
    }

    if (message) {
      response.message = message;
    }

    if (error) {
      response.error = error;
    }

    return response;
  }

  /**
   * 格式化成功响应
   * @param {any} data - 响应数据
   * @param {string} [message] - 成功消息
   * @returns {Object} 成功响应对象
   */
  static success(data, message) {
    return this.formatResponse(true, data, message);
  }

  /**
   * 格式化错误响应
   * @param {string} error - 错误信息
   * @param {string} [message] - 错误描述
   * @returns {Object} 错误响应对象
   */
  static error(error, message) {
    return this.formatResponse(false, undefined, message, error);
  }

  /**
   * 格式化笔记本列表
   * @param {Array} notebooks - 原始笔记本列表
   * @returns {Array} 格式化后的笔记本列表
   */
  static formatNotebooks(notebooks) {
    if (!Array.isArray(notebooks)) {
      return [];
    }

    return notebooks.map(notebook => ({
      id: notebook.id,
      name: notebook.name,
      icon: notebook.icon,
      sort: notebook.sort,
      closed: notebook.closed || false,
      refCreateTime: notebook.refCreateTime,
      refUpdateTime: notebook.refUpdateTime
    }));
  }

  /**
   * 格式化文档结构
   * @param {Array} docs - 原始文档列表
   * @returns {Array} 格式化后的文档列表
   */
  static formatDocStructure(docs) {
    if (!Array.isArray(docs)) {
      return [];
    }

    return docs.map(doc => ({
      id: doc.id,
      parentId: doc.parent_id || doc.parentId,
      title: doc.content || doc.title || '',
      type: doc.type,
      subtype: doc.subtype,
      icon: doc.icon,
      sort: doc.sort,
      children: this.formatDocStructure(doc.children || [])
    }));
  }

  /**
   * 格式化搜索结果
   * @param {Array} results - 原始搜索结果
   * @returns {Array} 格式化后的搜索结果
   */
  static formatSearchResults(results) {
    if (!Array.isArray(results)) {
      return [];
    }

    return results.map(result => ({
      id: result.id,
      blockId: result.block_id || result.blockId,
      rootId: result.root_id || result.rootId,
      box: result.box,
      path: result.path,
      content: result.content,
      excerpt: result.marked || result.content,
      type: result.type,
      subtype: result.subtype,
      created: result.created,
      updated: result.updated
    }));
  }

  /**
   * 截断文本
   * @param {string} text - 原始文本
   * @param {number} maxLength - 最大长度
   * @param {string} [ellipsis] - 省略号
   * @returns {string} 截断后的文本
   */
  static truncate(text, maxLength, ellipsis = '...') {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + ellipsis;
  }

  /**
   * 移除 HTML 标签
   * @param {string} html - HTML 字符串
   * @returns {string} 纯文本
   */
  static stripHtml(html) {
    if (!html) {
      return '';
    }
    return html.replace(/<[^>]*>/g, '');
  }
}

module.exports = Formatter;
