/**
 * 缓存管理工具
 * 提供数据缓存和过期管理功能
 */

/**
 * CacheManager 类
 * 管理缓存数据的存储、获取和过期
 */
class CacheManager {
  /**
   * 构造函数
   * @param {number} defaultExpiry - 默认缓存过期时间（毫秒）
   */
  constructor(defaultExpiry = 300000) {
    this.cache = {};
    this.defaultExpiry = defaultExpiry;
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} [expiry] - 缓存过期时间（毫秒）
   */
  set(key, value, expiry) {
    this.cache[key] = {
      data: value,
      timestamp: Date.now(),
      expiry: expiry || this.defaultExpiry
    };
  }

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {any|null} 缓存值，如果不存在或已过期则返回 null
   */
  get(key) {
    const item = this.cache[key];
    if (!item) {
      return null;
    }

    if (Date.now() - item.timestamp > item.expiry) {
      this.delete(key);
      return null;
    }

    return item.data;
  }

  /**
   * 检查缓存是否存在且未过期
   * @param {string} key - 缓存键
   * @returns {boolean} 缓存是否有效
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   */
  delete(key) {
    delete this.cache[key];
  }

  /**
   * 清除所有缓存
   */
  clear() {
    this.cache = {};
  }

  /**
   * 获取缓存摘要
   * @returns {Object} 缓存摘要信息
   */
  getSummary() {
    const keys = Object.keys(this.cache);
    const now = Date.now();
    const validKeys = keys.filter(key => {
      const item = this.cache[key];
      return now - item.timestamp <= item.expiry;
    });

    return {
      totalKeys: keys.length,
      validKeys: validKeys.length,
      expiredKeys: keys.length - validKeys.length
    };
  }
}

module.exports = CacheManager;
