/**
 * 操作协调器
 * 协调多个块操作，确保操作顺序正确，处理操作回滚
 */

/**
 * OperationCoordinator 类
 * 提供操作协调和回滚功能
 */
class OperationCoordinator {
  /**
   * 构造函数
   * @param {Object} blockOperator - 块操作器实例
   */
  constructor(blockOperator) {
    this.blockOperator = blockOperator;
    this.operations = [];
    this.operationHistory = [];
  }

  /**
   * 执行操作序列
   * @param {Array} operations - 操作序列
   * @returns {Promise<Object>} 执行结果
   */
  async executeOperations(operations) {
    const results = [];
    const rollbackOperations = [];

    try {
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        console.log(`执行操作 ${i + 1}/${operations.length}: ${operation.type}`);

        const result = await this.executeSingleOperation(operation);
        results.push(result);

        if (result.success && operation.rollback) {
          rollbackOperations.push(operation.rollback);
        }

        if (!result.success) {
          throw new Error(`操作 ${operation.type} 失败: ${result.error}`);
        }
      }

      this.recordOperationHistory(operations, results);

      return {
        success: true,
        results,
        rollbackOperations,
        message: '所有操作执行成功'
      };
    } catch (error) {
      console.error('执行操作序列失败:', error.message);
      console.log('开始回滚操作...');

      await this.rollbackOperations(rollbackOperations);

      return {
        success: false,
        error: error.message,
        partialResults: results,
        message: '操作执行失败，已回滚'
      };
    }
  }

  /**
   * 执行单个操作
   * @param {Object} operation - 操作对象
   * @returns {Promise<Object>} 操作结果
   */
  async executeSingleOperation(operation) {
    try {
      switch (operation.type) {
        case 'insert-block':
          return await this.blockOperator.insertBlock(
            operation.data,
            operation.dataType,
            operation.parentId,
            operation.previousId,
            operation.nextId
          );

        case 'update-block':
          return await this.blockOperator.updateBlock(
            operation.id,
            operation.data,
            operation.dataType
          );

        case 'delete-block':
          return await this.blockOperator.deleteBlock(operation.id);

        case 'move-block':
          return await this.blockOperator.moveBlock(
            operation.id,
            operation.parentId,
            operation.previousId
          );

        case 'set-attrs':
          return await this.blockOperator.setBlockAttrs(
            operation.id,
            operation.attrs
          );

        default:
          return {
            success: false,
            error: `未知操作类型: ${operation.type}`,
            message: '操作执行失败'
          };
      }
    } catch (error) {
      console.error(`执行操作 ${operation.type} 失败:`, error);
      return {
        success: false,
        error: error.message,
        message: '操作执行失败'
      };
    }
  }

  /**
   * 回滚操作
   * @param {Array} rollbackOperations - 回滚操作列表
   * @returns {Promise<Object>} 回滚结果
   */
  async rollbackOperations(rollbackOperations) {
    const results = [];

    for (let i = rollbackOperations.length - 1; i >= 0; i--) {
      const operation = rollbackOperations[i];
      console.log(`执行回滚操作: ${operation.type}`);

      const result = await this.executeSingleOperation(operation);
      results.push(result);

      if (!result.success) {
        console.error(`回滚操作 ${operation.type} 失败:`, result.error);
      }
    }

    return {
      success: results.every(r => r.success),
      results,
      message: results.every(r => r.success) 
        ? '所有回滚操作执行成功' 
        : '部分回滚操作执行失败'
    };
  }

  /**
   * 记录操作历史
   * @param {Array} operations - 操作序列
   * @param {Array} results - 操作结果
   */
  recordOperationHistory(operations, results) {
    const historyEntry = {
      timestamp: Date.now(),
      operations: operations.map((op, index) => ({
        ...op,
        result: results[index]
      })),
      success: results.every(r => r.success)
    };

    this.operationHistory.push(historyEntry);

    if (this.operationHistory.length > 100) {
      this.operationHistory.shift();
    }
  }

  /**
   * 获取操作历史
   * @param {number} [limit=20] - 限制数量
   * @returns {Array} 操作历史
   */
  getOperationHistory(limit = 20) {
    return this.operationHistory.slice(-limit);
  }

  /**
   * 清空操作历史
   */
  clearOperationHistory() {
    this.operationHistory = [];
  }

  /**
   * 构建插入操作
   * @param {string} data - 块内容
   * @param {Object} [options={}] - 选项
   * @returns {Object} 操作对象
   */
  buildInsertOperation(data, options = {}) {
    const { dataType = 'markdown', parentId, previousId, nextId } = options;

    return {
      type: 'insert-block',
      data,
      dataType,
      parentId,
      previousId,
      nextId,
      rollback: null
    };
  }

  /**
   * 构建更新操作
   * @param {string} id - 块ID
   * @param {string} data - 新内容
   * @param {Object} [options={}] - 选项
   * @param {string} [originalData] - 原始内容（用于回滚）
   * @returns {Object} 操作对象
   */
  buildUpdateOperation(id, data, options = {}, originalData) {
    const { dataType = 'markdown' } = options;

    const operation = {
      type: 'update-block',
      id,
      data,
      dataType,
      rollback: null
    };

    if (originalData) {
      operation.rollback = {
        type: 'update-block',
        id,
        data: originalData,
        dataType
      };
    }

    return operation;
  }

  /**
   * 构建删除操作
   * @param {string} id - 块ID
   * @param {Object} [originalBlock] - 原始块数据（用于回滚）
   * @returns {Object} 操作对象
   */
  buildDeleteOperation(id, originalBlock) {
    const operation = {
      type: 'delete-block',
      id,
      rollback: null
    };

    if (originalBlock) {
      operation.rollback = {
        type: 'insert-block',
        data: originalBlock.content,
        dataType: 'markdown',
        parentId: originalBlock.parentId,
        previousId: originalBlock.previousId,
        nextId: originalBlock.nextId
      };
    }

    return operation;
  }

  /**
   * 构建移动操作
   * @param {string} id - 块ID
   * @param {string} parentId - 目标父块ID
   * @param {string} previousId - 目标前一个块ID
   * @param {Object} [originalPosition] - 原始位置（用于回滚）
   * @returns {Object} 操作对象
   */
  buildMoveOperation(id, parentId, previousId, originalPosition) {
    const operation = {
      type: 'move-block',
      id,
      parentId,
      previousId,
      rollback: null
    };

    if (originalPosition) {
      operation.rollback = {
        type: 'move-block',
        id,
        parentId: originalPosition.parentId,
        previousId: originalPosition.previousId
      };
    }

    return operation;
  }

  /**
   * 构建设置属性操作
   * @param {string} id - 块ID
   * @param {Object} attrs - 属性对象
   * @param {Object} [originalAttrs] - 原始属性（用于回滚）
   * @returns {Object} 操作对象
   */
  buildSetAttrsOperation(id, attrs, originalAttrs) {
    const operation = {
      type: 'set-attrs',
      id,
      attrs,
      rollback: null
    };

    if (originalAttrs) {
      operation.rollback = {
        type: 'set-attrs',
        id,
        attrs: originalAttrs
      };
    }

    return operation;
  }
}

module.exports = OperationCoordinator;
