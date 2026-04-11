/**
 * result-helper.js - 标准返回对象构造工具
 * 
 * 提供统一的返回对象构造函数，确保所有脚本的返回格式一致
 */

/**
 * 构建标准错误结果对象
 * @param {string} error - 错误类型
 * @param {string} message - 错误消息
 * @param {Object} details - 额外详情（可选）
 * @returns {Object} 错误结果对象
 * 
 * @example
 * createErrorResult('参数错误', '必须提供文档ID')
 * // { success: false, error: '参数错误', message: '必须提供文档ID' }
 * 
 * @example
 * createErrorResult('权限不足', '无权访问此笔记本', { notebookId: 'xxx' })
 * // { success: false, error: '权限不足', message: '无权访问此笔记本', notebookId: 'xxx' }
 */
function createErrorResult(error, message, details = {}) {
  return {
    success: false,
    error,
    message,
    ...details
  };
}

/**
 * 构建标准成功结果对象
 * @param {Object} data - 返回数据
 * @param {string} message - 成功消息（可选，默认 '操作成功'）
 * @returns {Object} 成功结果对象
 * 
 * @example
 * createSuccessResult({ id: 'xxx', title: '文档标题' })
 * // { success: true, data: { id: 'xxx', title: '文档标题' }, message: '操作成功' }
 * 
 * @example
 * createSuccessResult({ id: 'xxx' }, '文档创建成功')
 * // { success: true, data: { id: 'xxx' }, message: '文档创建成功' }
 */
function createSuccessResult(data, message = '操作成功') {
  return {
    success: true,
    data,
    message
  };
}

/**
 * 输出结果到控制台（根据 raw 模式选择输出格式）
 * @param {Object} data - 要输出的数据
 * @param {boolean} raw - 是否为 raw 模式
 * @param {Object} meta - 元数据（非 raw 模式下添加）
 * 
 * @example
 * outputResult({ id: 'xxx' }, false, { timestamp: Date.now() })
 * // 输出: { success: true, data: { id: 'xxx' }, timestamp: 1234567890 }
 * 
 * @example
 * outputResult({ id: 'xxx' }, true)
 * // 输出: { id: 'xxx' }
 */
function outputResult(data, raw, meta = {}) {
  if (raw) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    const result = {
      success: true,
      data,
      ...meta
    };
    console.log(JSON.stringify(result, null, 2));
  }
}

/**
 * 输出错误到控制台（根据 raw 模式选择输出格式）
 * @param {Error} error - 错误对象
 * @param {boolean} raw - 是否为 raw 模式
 * @param {Object} details - 额外详情
 * 
 * @example
 * outputError(new Error('操作失败'), false, { id: 'xxx' })
 * // 输出: { success: false, error: 'Error', message: '操作失败', id: 'xxx' }
 * 
 * @example
 * outputError(new Error('操作失败'), true)
 * // 输出到 stderr: 操作失败
 */
function outputError(error, raw, details = {}) {
  if (raw) {
    console.error(error.message);
  } else {
    const errorResult = {
      success: false,
      error: error.name || '执行失败',
      message: error.message,
      ...details
    };
    console.log(JSON.stringify(errorResult, null, 2));
  }
}

/**
 * 条件日志输出（仅在非 raw 模式下输出）
 * @param {string} message - 日志消息
 * @param {boolean} raw - 是否为 raw 模式
 * 
 * @example
 * logIfNotRaw('正在处理...', false)  // 输出: 正在处理...
 * logIfNotRaw('正在处理...', true)   // 不输出
 */
function logIfNotRaw(message, raw) {
  if (!raw) {
    console.log(message);
  }
}

module.exports = {
  createErrorResult,
  createSuccessResult,
  outputResult,
  outputError,
  logIfNotRaw
};
