/**
 * 块定位器
 * 提供多种块定位策略
 */

/**
 * BlockLocator 类
 * 提供多种块定位方法
 */
class BlockLocator {
  /**
   * 构造函数
   * @param {Object} connector - Siyuan 连接器实例
   */
  constructor(connector) {
    this.connector = connector;
  }

  /**
   * 通过块ID定位
   * @param {string} blockId - 块ID
   * @returns {Promise<Object>} 定位结果
   */
  async locateById(blockId) {
    try {
      const result = await this.connector.request('/api/block/getBlockKramdown', { id: blockId });
      
      if (result && result.code === 0) {
        return {
          success: true,
          block: {
            id: blockId,
            kramdown: result.data.kramdown,
            exists: true
          },
          message: '块定位成功'
        };
      } else {
        return {
          success: false,
          error: result?.msg || '块不存在或无法访问',
          message: '块定位失败'
        };
      }
    } catch (error) {
      console.error('通过ID定位块失败:', error);
      return {
        success: false,
        error: error.message,
        message: '块定位失败'
      };
    }
  }

  /**
   * 通过内容匹配定位
   * @param {string} content - 内容片段
   * @param {string} docId - 文档ID
   * @param {Object} [options={}] - 选项
   * @returns {Promise<Object>} 定位结果
   */
  async locateByContent(content, docId, options = {}) {
    try {
      const { caseSensitive = false, exactMatch = false } = options;
      
      // 获取文档的子块
      const childBlocksResult = await this.connector.request('/api/block/getChildBlocks', { id: docId });
      
      if (!childBlocksResult || childBlocksResult.code !== 0) {
        return {
          success: false,
          error: childBlocksResult?.msg || '获取文档子块失败',
          message: '块定位失败'
        };
      }
      
      const blocks = childBlocksResult.data || [];
      const matchedBlocks = [];
      
      for (const block of blocks) {
        try {
          // 获取块的 kramdown 内容
          const blockResult = await this.connector.request('/api/block/getBlockKramdown', { id: block.id });
          
          if (blockResult && blockResult.code === 0) {
            const blockContent = blockResult.data.kramdown;
            let isMatch = false;
            
            if (exactMatch) {
              isMatch = caseSensitive 
                ? blockContent === content 
                : blockContent.toLowerCase() === content.toLowerCase();
            } else {
              isMatch = caseSensitive 
                ? blockContent.includes(content) 
                : blockContent.toLowerCase().includes(content.toLowerCase());
            }
            
            if (isMatch) {
              matchedBlocks.push({
                id: block.id,
                type: block.type,
                content: blockContent,
                exists: true
              });
            }
          }
        } catch (error) {
          // 忽略单个块的错误
          console.warn(`获取块 ${block.id} 内容失败:`, error.message);
        }
      }
      
      return {
        success: true,
        blocks: matchedBlocks,
        count: matchedBlocks.length,
        message: matchedBlocks.length > 0 
          ? `找到 ${matchedBlocks.length} 个匹配的块` 
          : '未找到匹配的块'
      };
    } catch (error) {
      console.error('通过内容定位块失败:', error);
      return {
        success: false,
        error: error.message,
        message: '块定位失败'
      };
    }
  }

  /**
   * 通过位置索引定位
   * @param {number} index - 位置索引（从0开始）
   * @param {string} docId - 文档ID
   * @param {string} [blockType=null] - 块类型（可选）
   * @returns {Promise<Object>} 定位结果
   */
  async locateByIndex(index, docId, blockType = null) {
    try {
      if (typeof index !== 'number' || index < 0) {
        return {
          success: false,
          error: '索引必须是非负整数',
          message: '块定位失败'
        };
      }
      
      // 获取文档的子块
      const childBlocksResult = await this.connector.request('/api/block/getChildBlocks', { id: docId });
      
      if (!childBlocksResult || childBlocksResult.code !== 0) {
        return {
          success: false,
          error: childBlocksResult?.msg || '获取文档子块失败',
          message: '块定位失败'
        };
      }
      
      let blocks = childBlocksResult.data || [];
      
      // 如果指定了块类型，进行过滤
      if (blockType) {
        blocks = blocks.filter(block => block.type === blockType);
      }
      
      if (index >= blocks.length) {
        return {
          success: false,
          error: `索引超出范围，文档只有 ${blocks.length} 个块`,
          message: '块定位失败'
        };
      }
      
      const targetBlock = blocks[index];
      
      // 获取块的详细信息
      const blockResult = await this.connector.request('/api/block/getBlockKramdown', { id: targetBlock.id });
      
      if (!blockResult || blockResult.code !== 0) {
        return {
          success: false,
          error: blockResult?.msg || '获取块详细信息失败',
          message: '块定位失败'
        };
      }
      
      return {
        success: true,
        block: {
          id: targetBlock.id,
          type: targetBlock.type,
          content: blockResult.data.kramdown,
          index,
          exists: true
        },
        message: '块定位成功'
      };
    } catch (error) {
      console.error('通过索引定位块失败:', error);
      return {
        success: false,
        error: error.message,
        message: '块定位失败'
      };
    }
  }

  /**
   * 通过层级路径定位
   * @param {string} path - 层级路径（如 "0.1.2"）
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 定位结果
   */
  async locateByPath(path, docId) {
    try {
      if (!path || typeof path !== 'string') {
        return {
          success: false,
          error: '路径格式无效',
          message: '块定位失败'
        };
      }
      
      const indices = path.split('.').map(index => parseInt(index, 10));
      
      if (indices.some(isNaN) || indices.some(index => index < 0)) {
        return {
          success: false,
          error: '路径格式无效，必须是数字和点的组合',
          message: '块定位失败'
        };
      }
      
      let currentParentId = docId;
      let currentBlock = null;
      
      for (let i = 0; i < indices.length; i++) {
        const index = indices[i];
        
        // 获取当前父块的子块
        const childBlocksResult = await this.connector.request('/api/block/getChildBlocks', { id: currentParentId });
        
        if (!childBlocksResult || childBlocksResult.code !== 0) {
          return {
            success: false,
            error: childBlocksResult?.msg || `获取子块失败（层级 ${i}）`,
            message: '块定位失败'
          };
        }
        
        const blocks = childBlocksResult.data || [];
        
        if (index >= blocks.length) {
          return {
            success: false,
            error: `路径索引超出范围（层级 ${i}），只有 ${blocks.length} 个子块`,
            message: '块定位失败'
          };
        }
        
        currentBlock = blocks[index];
        currentParentId = currentBlock.id;
      }
      
      // 获取最终块的详细信息
      const blockResult = await this.connector.request('/api/block/getBlockKramdown', { id: currentBlock.id });
      
      if (!blockResult || blockResult.code !== 0) {
        return {
          success: false,
          error: blockResult?.msg || '获取块详细信息失败',
          message: '块定位失败'
        };
      }
      
      return {
        success: true,
        block: {
          id: currentBlock.id,
          type: currentBlock.type,
          content: blockResult.data.kramdown,
          path,
          exists: true
        },
        message: '块定位成功'
      };
    } catch (error) {
      console.error('通过路径定位块失败:', error);
      return {
        success: false,
        error: error.message,
        message: '块定位失败'
      };
    }
  }

  /**
   * 验证块是否存在
   * @param {string} blockId - 块ID
   * @returns {Promise<boolean>} 块是否存在
   */
  async blockExists(blockId) {
    try {
      const result = await this.locateById(blockId);
      return result.success;
    } catch (error) {
      console.error('验证块存在失败:', error);
      return false;
    }
  }

  /**
   * 获取块的完整信息
   * @param {string} blockId - 块ID
   * @returns {Promise<Object>} 块的完整信息
   */
  async getBlockInfo(blockId) {
    try {
      // 获取块 kramdown
      const kramdownResult = await this.connector.request('/api/block/getBlockKramdown', { id: blockId });
      
      // 获取块属性
      const attrsResult = await this.connector.request('/api/attr/getBlockAttrs', { id: blockId });
      
      // 获取子块
      const childBlocksResult = await this.connector.request('/api/block/getChildBlocks', { id: blockId });
      
      return {
        success: true,
        block: {
          id: blockId,
          kramdown: kramdownResult?.data?.kramdown || '',
          attrs: attrsResult?.data || {},
          childBlocks: childBlocksResult?.data || [],
          exists: true
        },
        message: '获取块信息成功'
      };
    } catch (error) {
      console.error('获取块信息失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取块信息失败'
      };
    }
  }
}

module.exports = BlockLocator;
