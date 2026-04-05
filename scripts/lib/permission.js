/**
 * permission.js - 笔记本级别权限验证共享模块
 *
 * 权限模式:
 *   - all: 允许所有笔记本 (默认)
 *   - whitelist: 仅允许 notebookList 中的笔记本
 *   - blacklist: 禁止 notebookList 中的笔记本
 */
'use strict';

/**
 * 检查指定笔记本是否允许访问
 * @param {Object} config - ConfigManager.getConfig() 返回的配置对象
 * @param {string} notebookId - 待检查的笔记本 ID
 * @returns {{ allowed: boolean, reason: string }}
 */
function isNotebookAllowed(config, notebookId) {
  if (!notebookId) {
    return { allowed: true, reason: 'no-notebook-id' };
  }

  const mode = config.permissionMode || 'all';
  const list = Array.isArray(config.notebookList) ? config.notebookList : [];

  if (mode === 'all') {
    return { allowed: true, reason: 'mode-all' };
  }

  if (mode === 'whitelist') {
    if (list.length === 0 || list.includes(notebookId)) {
      return { allowed: true, reason: 'in-whitelist' };
    }
    return { allowed: false, reason: `笔记本 ${notebookId} 不在白名单中` };
  }

  if (mode === 'blacklist') {
    if (list.includes(notebookId)) {
      return { allowed: false, reason: `笔记本 ${notebookId} 在黑名单中` };
    }
    return { allowed: true, reason: 'not-in-blacklist' };
  }

  return { allowed: true, reason: 'unknown-mode-fallback' };
}

/**
 * 从块信息中提取所属笔记本 ID
 * @param {Object} blockInfo - getBlockInfo 返回的块信息
 * @returns {string|null} 笔记本 ID
 */
function extractNotebookId(blockInfo) {
  if (!blockInfo) return null;
  return blockInfo.box || blockInfo.notebook_id || blockInfo.notebookId || null;
}

/**
 * 权限验证快捷方法：检查并抛错
 * @param {Object} config - 配置对象
 * @param {string} notebookId - 笔记本 ID
 * @throws {Error} 权限不足时抛出错误
 */
function checkPermission(config, notebookId) {
  const result = isNotebookAllowed(config, notebookId);
  if (!result.allowed) {
    throw new Error(`权限不足: ${result.reason}`);
  }
}

/**
 * 检查权限并返回结构化结果
 * @param {Object} config - 配置对象
 * @param {string} notebookId - 笔记本 ID
 * @param {Array} notebooks - 笔记本列表（可选，用于获取笔记本名称）
 * @returns {{hasPermission: boolean, error: string|null}}
 */
function checkPermissionResult(config, notebookId, notebooks = null) {
  const result = isNotebookAllowed(config, notebookId);
  
  if (!result.allowed) {
    let errorMessage = result.reason;
    
    // 如果提供了笔记本列表，尝试获取笔记本名称
    if (notebooks && Array.isArray(notebooks)) {
      const notebook = notebooks.find(nb => nb.id === notebookId);
      if (notebook) {
        const { permissionMode, notebookList } = config;
        if (permissionMode === 'whitelist') {
          errorMessage = `笔记本 "${notebook.name}" (${notebookId}) 不在白名单中。当前白名单: [${(notebookList || []).join(', ')}]`;
        } else if (permissionMode === 'blacklist') {
          errorMessage = `笔记本 "${notebook.name}" (${notebookId}) 在黑名单中，禁止访问`;
        }
      }
    }
    
    return {
      hasPermission: false,
      error: errorMessage
    };
  }
  
  return {
    hasPermission: true,
    error: null
  };
}

module.exports = { isNotebookAllowed, extractNotebookId, checkPermission, checkPermissionResult };
