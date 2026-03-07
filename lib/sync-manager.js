/**
 * 同步管理器
 * 提供数据同步相关的核心功能
 */

/**
 * SyncManager 类
 * 管理同步功能
 */
class SyncManager {
  /**
   * 构造函数
   * @param {Object} cacheManager - 缓存管理器实例
   */
  constructor(cacheManager) {
    this.cacheManager = cacheManager;
    this.lastSync = null;
    this.isSyncing = false;
    this.syncError = null;
    this.syncInterval = null;
  }

  /**
   * 开始同步
   * @param {number} [interval=30000 - 同步间隔
   */
  startSync(interval = 30000) {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.sync();
    }, interval);
  }

  /**
   * 停止同步
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * 执行同步
   */
  async sync() {
    if (this.isSyncing) {
      return;
    }

    try {
      this.isSyncing = true;
      this.lastSync = Date.now();
      this.syncError = null;

      this.cacheManager.clear();
    } catch (error) {
      this.syncError = error.message;
      console.error('同步失败:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 获取同步状态
   * @returns {Object} 同步状态
   */
  getSyncStatus() {
    return {
      lastSync: this.lastSync,
      isSyncing: this.isSyncing,
      syncError: this.syncError
    };
  }
}

module.exports = SyncManager;
