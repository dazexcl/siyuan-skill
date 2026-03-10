/**
 * 块操作器
 * 封装所有块操作API
 */

const BlockHelper = require('../utils/block-helper');

/**
 * BlockOperator 类
 * 封装思源笔记块操作API
 */
class BlockOperator {
  /**
   * 构造函数
   * @param {Object} connector - Siyuan 连接器实例
   */
  constructor(connector) {
    this.connector = connector;
  }

  /**
   * 插入块
   * @param {string} data - 块内容
   * @param {string} [dataType='markdown'] - 数据类型
   * @param {string} [parentId=''] - 父块ID
   * @param {string} [previousId=''] - 前一个块ID
   * @param {string} [nextId=''] - 后一个块ID
   * @returns {Promise<Object>} 插入结果
   */
  async insertBlock(data, dataType = 'markdown', parentId = '', previousId = '', nextId = '') {
    try {
      const requestData = {
        dataType,
        data: BlockHelper.processContent(data),
        parentID: parentId,
        previousID: previousId,
        nextID: nextId
      };

      const result = await this.connector.request('/api/block/insertBlock', requestData);

      return BlockHelper.normalizeBlockResult(result, '块插入成功');
    } catch (error) {
      return BlockHelper.handleBlockError(error, '插入');
    }
  }

  /**
   * 更新块
   * @param {string} id - 块ID
   * @param {string} data - 新内容
   * @param {string} [dataType='markdown'] - 数据类型
   * @returns {Promise<Object>} 更新结果
   */
  async updateBlock(id, data, dataType = 'markdown') {
    try {
      const requestData = {
        id,
        dataType,
        data: BlockHelper.processContent(data)
      };

      const result = await this.connector.request('/api/block/updateBlock', requestData);

      return BlockHelper.normalizeBlockResult(result, '块更新成功');
    } catch (error) {
      return BlockHelper.handleBlockError(error, '更新');
    }
  }

  /**
   * 删除块
   * @param {string} id - 块ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteBlock(id) {
    try {
      const requestData = { id };

      const result = await this.connector.request('/api/block/deleteBlock', requestData);

      return BlockHelper.normalizeBlockResult(result, '块删除成功');
    } catch (error) {
      return BlockHelper.handleBlockError(error, '删除');
    }
  }

  /**
   * 移动块
   * @param {string} id - 块ID
   * @param {string} [parentId=''] - 目标父块ID
   * @param {string} [previousId=''] - 目标前一个块ID
   * @returns {Promise<Object>} 移动结果
   */
  async moveBlock(id, parentId = '', previousId = '') {
    try {
      const requestData = {
        id,
        parentID: parentId,
        previousID: previousId
      };

      const result = await this.connector.request('/api/block/moveBlock', requestData);

      return BlockHelper.normalizeBlockResult(result, '块移动成功');
    } catch (error) {
      return BlockHelper.handleBlockError(error, '移动');
    }
  }

  /**
   * 获取块 kramdown 源码
   * @param {string} id - 块ID
   * @returns {Promise<Object>} 块信息
   */
  async getBlockKramdown(id) {
    try {
      const result = await this.connector.request('/api/block/getBlockKramdown', { id });

      if (result && result.code === 0) {
        return {
          success: true,
          data: result.data,
          message: '获取块源码成功'
        };
      }

      return {
        success: false,
        error: result?.msg || '获取块源码失败',
        message: '获取块源码失败'
      };
    } catch (error) {
      return BlockHelper.handleBlockError(error, '获取源码');
    }
  }

  /**
   * 获取子块列表
   * @param {string} id - 块ID
   * @returns {Promise<Object>} 子块列表
   */
  async getChildBlocks(id) {
    try {
      const result = await this.connector.request('/api/block/getChildBlocks', { id });

      if (result && result.code === 0) {
        return {
          success: true,
          data: result.data,
          message: '获取子块列表成功'
        };
      }

      return {
        success: false,
        error: result?.msg || '获取子块列表失败',
        message: '获取子块列表失败'
      };
    } catch (error) {
      return BlockHelper.handleBlockError(error, '获取子块');
    }
  }

  /**
   * 设置块属性
   * @param {string} id - 块ID
   * @param {Object} attrs - 属性对象
   * @returns {Promise<Object>} 设置结果
   */
  async setBlockAttrs(id, attrs) {
    try {
      const requestData = { id, attrs };

      const result = await this.connector.request('/api/attr/setBlockAttrs', requestData);

      return BlockHelper.normalizeBlockResult(result, '块属性设置成功');
    } catch (error) {
      return BlockHelper.handleBlockError(error, '设置属性');
    }
  }

  /**
   * 获取块属性
   * @param {string} id - 块ID
   * @returns {Promise<Object>} 块属性
   */
  async getBlockAttrs(id) {
    try {
      const result = await this.connector.request('/api/attr/getBlockAttrs', { id });

      if (result && result.code === 0) {
        return {
          success: true,
          data: result.data,
          message: '获取块属性成功'
        };
      }

      return {
        success: false,
        error: result?.msg || '获取块属性失败',
        message: '获取块属性失败'
      };
    } catch (error) {
      return BlockHelper.handleBlockError(error, '获取属性');
    }
  }

  /**
   * 批量插入块
   * @param {Array} operations - 插入操作数组
   * @returns {Promise<Object>} 批量操作结果
   */
  async batchInsertBlocks(operations) {
    const results = [];
    
    for (const op of operations) {
      const result = await this.insertBlock(
        op.data,
        op.dataType,
        op.parentId,
        op.previousId,
        op.nextId
      );
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === operations.length,
      results,
      successCount,
      totalCount: operations.length,
      message: `批量插入完成：${successCount}/${operations.length} 成功`
    };
  }

  /**
   * 批量更新块
   * @param {Array} operations - 更新操作数组
   * @returns {Promise<Object>} 批量操作结果
   */
  async batchUpdateBlocks(operations) {
    const results = [];
    
    for (const op of operations) {
      const result = await this.updateBlock(op.id, op.data, op.dataType);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === operations.length,
      results,
      successCount,
      totalCount: operations.length,
      message: `批量更新完成：${successCount}/${operations.length} 成功`
    };
  }

  /**
   * 批量删除块
   * @param {Array} blockIds - 块ID数组
   * @returns {Promise<Object>} 批量操作结果
   */
  async batchDeleteBlocks(blockIds) {
    const results = [];
    
    for (const id of blockIds) {
      const result = await this.deleteBlock(id);
      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    
    return {
      success: successCount === blockIds.length,
      results,
      successCount,
      totalCount: blockIds.length,
      message: `批量删除完成：${successCount}/${blockIds.length} 成功`
    };
  }

  /**
   * 获取文档的完整块树
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 完整块树
   */
  async getDocumentBlockTree(docId) {
    try {
      const rootBlocks = await this.getChildBlocks(docId);
      
      if (!rootBlocks.success) {
        return rootBlocks;
      }

      const tree = await this.buildBlockTree(rootBlocks.data);

      return {
        success: true,
        data: tree,
        message: '获取文档块树成功'
      };
    } catch (error) {
      console.error('获取文档块树失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取文档块树失败'
      };
    }
  }

  /**
   * 构建块树
   * @param {Array} blocks - 块数组
   * @returns {Promise<Array>} 块树
   */
  async buildBlockTree(blocks) {
    const tree = [];

    for (const block of blocks) {
      const node = {
        id: block.id,
        type: block.type,
        children: []
      };

      try {
        const childBlocks = await this.getChildBlocks(block.id);
        
        if (childBlocks.success && childBlocks.data && childBlocks.data.length > 0) {
          node.children = await this.buildBlockTree(childBlocks.data);
        }
      } catch (error) {
        console.warn(`获取块 ${block.id} 子块失败:`, error.message);
      }

      tree.push(node);
    }

    return tree;
  }

  /**
   * 查找指定类型的块
   * @param {string} docId - 文档ID
   * @param {string} blockType - 块类型
   * @returns {Promise<Object>} 查找结果
   */
  async findBlocksByType(docId, blockType) {
    try {
      const tree = await this.getDocumentBlockTree(docId);
      
      if (!tree.success) {
        return tree;
      }

      const blocks = [];
      this.collectBlocksByType(tree.data, blockType, blocks);

      return {
        success: true,
        data: blocks,
        count: blocks.length,
        message: `找到 ${blocks.length} 个类型为 ${blockType} 的块`
      };
    } catch (error) {
      console.error('查找块失败:', error);
      return {
        success: false,
        error: error.message,
        message: '查找块失败'
      };
    }
  }

  /**
   * 按类型收集块
   * @param {Array} tree - 块树
   * @param {string} blockType - 块类型
   * @param {Array} result - 结果数组
   */
  collectBlocksByType(tree, blockType, result) {
    for (const node of tree) {
      if (node.type === blockType) {
        result.push(node);
      }
      
      if (node.children && node.children.length > 0) {
        this.collectBlocksByType(node.children, blockType, result);
      }
    }
  }
}

module.exports = BlockOperator;
