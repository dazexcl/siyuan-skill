/**
 * 块操作辅助函数
 * 提供块操作相关的辅助功能
 */

/**
 * BlockHelper 类
 * 提供块操作的辅助方法
 */
class BlockHelper {
  /**
   * 处理内容中的换行符
   * @param {string} content - 原始内容
   * @returns {string} 处理后的内容
   */
  static processContent(content) {
    return content ? content.replace(/\\n/g, '\n') : '';
  }

  /**
   * 解析块位置参数
   * @param {Object} args - 参数对象
   * @param {string} args.parentId - 父块ID
   * @param {string} args.previousId - 前一个块ID
   * @param {string} args.nextId - 后一个块ID
   * @returns {Object} 解析后的位置参数
   */
  static parseBlockPosition(args) {
    const { parentId, previousId, nextId } = args;
    
    const position = {};
    
    // API 优先级：nextId > previousId > parentId
    if (nextId) {
      position.nextID = nextId;
    } else if (previousId) {
      position.previousID = previousId;
    } else if (parentId) {
      position.parentID = parentId;
    }
    
    return position;
  }

  /**
   * 验证块数据
   * @param {string} data - 块内容
   * @param {string} dataType - 数据类型
   * @returns {Object} 验证结果
   */
  static validateBlockData(data, dataType = 'markdown') {
    const errors = [];
    
    if (!data || data.trim().length === 0) {
      errors.push('块内容不能为空');
    }
    
    if (dataType && !['markdown', 'dom'].includes(dataType)) {
      errors.push('数据类型必须是 markdown 或 dom');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 格式化块响应
   * @param {Object} result - API 响应结果
   * @param {string} operation - 操作类型
   * @param {string} notebookId - 笔记本ID
   * @returns {Object} 格式化的响应
   */
  static formatBlockResponse(result, operation, notebookId) {
    if (!result || result.code !== 0) {
      return {
        success: false,
        error: result?.msg || '操作失败',
        message: '操作失败'
      };
    }
    
    const operationData = result.data && result.data[0]?.doOperations?.[0];
    
    return {
      success: true,
      data: {
        id: operationData?.id,
        operation,
        timestamp: Date.now(),
        notebookId,
        raw: result.data
      },
      message: '操作成功'
    };
  }

  /**
   * 构建块请求
   * @param {Object} params - 请求参数
   * @returns {Object} 构建后的请求参数
   */
  static buildBlockRequest(params) {
    const { data, dataType = 'markdown', ...positionParams } = params;
    const request = {
      dataType,
      data: this.processContent(data)
    };
    
    // 添加位置参数
    const position = this.parseBlockPosition(positionParams);
    Object.assign(request, position);
    
    return request;
  }

  /**
   * 处理块错误
   * @param {Error} error - 错误对象
   * @param {string} operation - 操作类型
   * @returns {Object} 格式化的错误响应
   */
  static handleBlockError(error, operation) {
    console.error(`${operation}块失败:`, error);
    return {
      success: false,
      error: error.message,
      message: `${operation}块失败`
    };
  }

  /**
   * 解析属性字符串
   * @param {string} attrsStr - 属性字符串（key=value格式，多个用逗号分隔）
   * @returns {Object} 解析后的属性对象
   */
  static parseAttributes(attrsStr) {
    const attrs = {};
    if (!attrsStr) return attrs;
    
    const pairs = attrsStr.split(',');
    for (const pair of pairs) {
      const [key, value] = pair.split('=');
      if (key && value !== undefined) {
        attrs[key.trim()] = value.trim();
      }
    }
    
    return attrs;
  }

  /**
   * 验证块ID
   * @param {string} id - 块ID
   * @returns {boolean} 是否为有效块ID
   */
  static isValidBlockId(id) {
    if (!id || typeof id !== 'string') {
      return false;
    }
    return id.trim().length > 0;
  }

  /**
   * 验证位置参数
   * @param {Object} position - 位置参数
   * @returns {Object} 验证结果
   */
  static validatePosition(position) {
    const { parentId, previousId, nextId } = position;
    const hasAnyPosition = !!parentId || !!previousId || !!nextId;
    
    return {
      valid: hasAnyPosition,
      message: hasAnyPosition ? '' : '必须提供至少一个位置参数：parentId、previousId 或 nextId'
    };
  }

  /**
   * 规范化块操作结果
   * @param {any} result - 原始结果
   * @param {string} defaultMessage - 默认消息
   * @returns {Object} 规范化的结果
   */
  static normalizeBlockResult(result, defaultMessage = '操作完成') {
    if (typeof result === 'object' && result !== null) {
      if (result.success !== undefined) {
        return result;
      }
      if (result.code === 0) {
        return {
          success: true,
          data: result.data,
          message: defaultMessage
        };
      }
      return {
        success: false,
        error: result.msg || defaultMessage,
        message: defaultMessage
      };
    }
    return {
      success: false,
      error: '无效的响应格式',
      message: defaultMessage
    };
  }
}

module.exports = BlockHelper;
