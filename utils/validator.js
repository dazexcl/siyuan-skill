/**
 * 数据验证工具
 * 提供数据验证和清理功能
 */

/**
 * Validator 类
 * 提供各种数据验证方法
 */
class Validator {
  /**
   * 验证是否为非空字符串
   * @param {any} value - 要验证的值
   * @returns {boolean} 是否为非空字符串
   */
  static isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  /**
   * 验证是否为有效ID
   * @param {any} id - 要验证的ID
   * @returns {boolean} 是否为有效ID
   */
  static isValidId(id) {
    return this.isNonEmptyString(id);
  }

  /**
   * 验证是否为有效URL
   * @param {any} url - 要验证的URL
   * @returns {boolean} 是否为有效URL
   */
  static isValidUrl(url) {
    if (!this.isNonEmptyString(url)) {
      return false;
    }
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证是否为有效数字
   * @param {any} value - 要验证的值
   * @param {number} [min] - 最小值
   * @param {number} [max] - 最大值
   * @returns {boolean} 是否为有效数字
   */
  static isValidNumber(value, min, max) {
    if (typeof value !== 'number' || isNaN(value)) {
      return false;
    }
    if (min !== undefined && value < min) {
      return false;
    }
    if (max !== undefined && value > max) {
      return false;
    }
    return true;
  }

  /**
   * 验证是否为有效超时时间
   * @param {any} timeout - 要验证的超时时间
   * @returns {boolean} 是否为有效超时时间
   */
  static isValidTimeout(timeout) {
    return this.isValidNumber(timeout, 1000, 300000);
  }

  /**
   * 验证权限模式
   * @param {any} mode - 要验证的权限模式
   * @returns {boolean} 是否为有效权限模式
   */
  static isValidPermissionMode(mode) {
    return ['none', 'blacklist', 'whitelist'].includes(mode);
  }

  /**
   * 验证内容格式
   * @param {any} format - 要验证的格式
   * @returns {boolean} 是否为有效格式
   */
  static isValidContentFormat(format) {
    return ['markdown', 'text', 'html'].includes(format);
  }

  /**
   * 清理字符串
   * @param {any} value - 要清理的值
   * @param {string} [defaultValue] - 默认值
   * @returns {string} 清理后的字符串
   */
  static sanitizeString(value, defaultValue = '') {
    if (typeof value !== 'string') {
      return defaultValue;
    }
    return value.trim();
  }

  /**
   * 清理ID
   * @param {any} id - 要清理的ID
   * @returns {string|null} 清理后的ID或null
   */
  static sanitizeId(id) {
    const sanitized = this.sanitizeString(id);
    return sanitized.length > 0 ? sanitized : null;
  }

  /**
   * 验证并获取笔记本ID
   * @param {any} notebookId - 笔记本ID
   * @param {string} [defaultNotebook] - 默认笔记本ID
   * @returns {string} 验证后的笔记本ID
   * @throws {Error} 如果笔记本ID无效
   */
  static validateNotebookId(notebookId, defaultNotebook) {
    const id = this.sanitizeId(notebookId) || this.sanitizeId(defaultNotebook);
    if (!id) {
      throw new Error('笔记本ID不能为空');
    }
    return id;
  }

  /**
   * 验证并获取文档ID
   * @param {any} docId - 文档ID
   * @returns {string} 验证后的文档ID
   * @throws {Error} 如果文档ID无效
   */
  static validateDocId(docId) {
    const id = this.sanitizeId(docId);
    if (!id) {
      throw new Error('文档ID不能为空');
    }
    return id;
  }

  /**
   * 验证搜索查询
   * @param {any} query - 搜索查询
   * @returns {string} 验证后的查询
   * @throws {Error} 如果查询无效
   */
  static validateSearchQuery(query) {
    const sanitized = this.sanitizeString(query);
    if (sanitized.length === 0) {
      throw new Error('搜索关键词不能为空');
    }
    return sanitized;
  }
}

module.exports = Validator;
