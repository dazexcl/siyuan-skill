/**
 * 智能插入策略
 * 提供多种智能插入位置选择策略
 */

/**
 * SmartInsertionStrategy 类
 * 提供智能插入位置选择功能
 */
class SmartInsertionStrategy {
  /**
   * 构造函数
   * @param {Object} blockOperator - 块操作器实例
   */
  constructor(blockOperator) {
    this.blockOperator = blockOperator;
  }

  /**
   * 选择插入位置
   * @param {string} docId - 文档ID
   * @param {string} content - 要插入的内容
   * @param {string} [mode='append'] - 插入模式
   * @param {Object} [context={}] - 上下文信息
   * @returns {Promise<Object>} 插入位置
   */
  async selectInsertionPosition(docId, content, mode = 'append', context = {}) {
    try {
      switch (mode) {
        case 'append':
          return await this.getAppendPosition(docId);
        case 'prepend':
          return await this.getPrependPosition(docId);
        case 'related':
          return await this.getRelatedPosition(docId, content, context);
        case 'structured':
          return await this.getStructuredPosition(docId, content);
        case 'specified':
          return await this.getSpecifiedPosition(context.position);
        default:
          return await this.getAppendPosition(docId);
      }
    } catch (error) {
      console.error('选择插入位置失败:', error);
      return {
        success: false,
        error: error.message,
        message: '选择插入位置失败'
      };
    }
  }

  /**
   * 获取追加位置（文档末尾）
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 插入位置
   */
  async getAppendPosition(docId) {
    try {
      const childBlocks = await this.blockOperator.getChildBlocks(docId);
      
      if (!childBlocks.success) {
        return {
          success: true,
          position: {
            parentId: docId,
            previousId: '',
            nextId: ''
          },
          message: '获取追加位置成功'
        };
      }

      const blocks = childBlocks.data || [];
      
      if (blocks.length === 0) {
        return {
          success: true,
          position: {
            parentId: docId,
            previousId: '',
            nextId: ''
          },
          message: '获取追加位置成功'
        };
      }

      const lastBlock = blocks[blocks.length - 1];
      
      return {
        success: true,
        position: {
          parentId: '',
          previousId: lastBlock.id,
          nextId: ''
        },
        message: '获取追加位置成功'
      };
    } catch (error) {
      console.error('获取追加位置失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取追加位置失败'
      };
    }
  }

  /**
   * 获取前置位置（文档开头）
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 插入位置
   */
  async getPrependPosition(docId) {
    try {
      const childBlocks = await this.blockOperator.getChildBlocks(docId);
      
      if (!childBlocks.success) {
        return {
          success: true,
          position: {
            parentId: docId,
            previousId: '',
            nextId: ''
          },
          message: '获取前置位置成功'
        };
      }

      const blocks = childBlocks.data || [];
      
      if (blocks.length === 0) {
        return {
          success: true,
          position: {
            parentId: docId,
            previousId: '',
            nextId: ''
          },
          message: '获取前置位置成功'
        };
      }

      const firstBlock = blocks[0];
      
      return {
        success: true,
        position: {
          parentId: '',
          previousId: '',
          nextId: firstBlock.id
        },
        message: '获取前置位置成功'
      };
    } catch (error) {
      console.error('获取前置位置失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取前置位置失败'
      };
    }
  }

  /**
   * 获取相关位置（在相关内容附近）
   * @param {string} docId - 文档ID
   * @param {string} content - 要插入的内容
   * @param {Object} [context={}] - 上下文信息
   * @returns {Promise<Object>} 插入位置
   */
  async getRelatedPosition(docId, content, context = {}) {
    try {
      const { keywords = [], before = false } = context;
      
      const childBlocks = await this.blockOperator.getChildBlocks(docId);
      
      if (!childBlocks.success || !childBlocks.data || childBlocks.data.length === 0) {
        return await this.getAppendPosition(docId);
      }

      const blocks = childBlocks.data;
      
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        try {
          const blockResult = await this.blockOperator.getBlockKramdown(block.id);
          
          if (blockResult.success && blockResult.data) {
            const blockContent = blockResult.data.kramdown || '';
            const isMatch = this.isContentRelated(blockContent, content, keywords);
            
            if (isMatch) {
              if (before) {
                return {
                  success: true,
                  position: {
                    parentId: '',
                    previousId: '',
                    nextId: block.id
                  },
                  message: '获取相关位置成功'
                };
              } else {
                return {
                  success: true,
                  position: {
                    parentId: '',
                    previousId: block.id,
                    nextId: ''
                  },
                  message: '获取相关位置成功'
                };
              }
            }
          }
        } catch (error) {
          console.warn(`检查块 ${block.id} 相关性失败:`, error.message);
        }
      }

      return await this.getAppendPosition(docId);
    } catch (error) {
      console.error('获取相关位置失败:', error);
      return await this.getAppendPosition(docId);
    }
  }

  /**
   * 判断内容是否相关
   * @param {string} blockContent - 块内容
   * @param {string} newContent - 新内容
   * @param {Array} keywords - 关键词
   * @returns {boolean} 是否相关
   */
  isContentRelated(blockContent, newContent, keywords) {
    const blockContentLower = blockContent.toLowerCase();
    const newContentLower = newContent.toLowerCase();
    
    if (keywords && keywords.length > 0) {
      for (const keyword of keywords) {
        if (blockContentLower.includes(keyword.toLowerCase())) {
          return true;
        }
      }
    }
    
    const commonKeywords = ['代码', '注意', '重要', 'TODO', 'FIXME'];
    for (const keyword of commonKeywords) {
      if (newContentLower.includes(keyword.toLowerCase()) && 
          blockContentLower.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * 获取结构化位置（根据文档结构）
   * @param {string} docId - 文档ID
   * @param {string} content - 要插入的内容
   * @returns {Promise<Object>} 插入位置
   */
  async getStructuredPosition(docId, content) {
    try {
      const contentType = this.analyzeContentType(content);
      
      const childBlocks = await this.blockOperator.getChildBlocks(docId);
      
      if (!childBlocks.success || !childBlocks.data || childBlocks.data.length === 0) {
        return await this.getAppendPosition(docId);
      }

      const blocks = childBlocks.data;
      
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        try {
          const blockResult = await this.blockOperator.getBlockKramdown(block.id);
          
          if (blockResult.success && blockResult.data) {
            const blockContent = blockResult.data.kramdown || '';
            const blockType = this.analyzeContentType(blockContent);
            
            if (blockType === contentType) {
              const nextBlock = blocks[i + 1];
              
              if (nextBlock) {
                return {
                  success: true,
                  position: {
                    parentId: '',
                    previousId: block.id,
                    nextId: ''
                  },
                  message: '获取结构化位置成功'
                };
              } else {
                return {
                  success: true,
                  position: {
                    parentId: '',
                    previousId: block.id,
                    nextId: ''
                  },
                  message: '获取结构化位置成功'
                };
              }
            }
          }
        } catch (error) {
          console.warn(`分析块 ${block.id} 类型失败:`, error.message);
        }
      }

      return await this.getAppendPosition(docId);
    } catch (error) {
      console.error('获取结构化位置失败:', error);
      return await this.getAppendPosition(docId);
    }
  }

  /**
   * 分析内容类型
   * @param {string} content - 内容
   * @returns {string} 内容类型
   */
  analyzeContentType(content) {
    const contentLower = content.toLowerCase();
    
    if (content.startsWith('```')) {
      return 'code';
    }
    
    if (contentLower.includes('注意:') || contentLower.includes('重要:')) {
      return 'note';
    }
    
    if (content.startsWith('# ')) {
      return 'heading1';
    }
    
    if (content.startsWith('## ')) {
      return 'heading2';
    }
    
    if (content.startsWith('### ')) {
      return 'heading3';
    }
    
    if (content.startsWith('- ') || content.startsWith('* ')) {
      return 'list';
    }
    
    if (content.startsWith('1. ') || content.startsWith('2. ')) {
      return 'numbered-list';
    }
    
    return 'paragraph';
  }

  /**
   * 获取指定位置
   * @param {Object} position - 位置对象
   * @returns {Promise<Object>} 插入位置
   */
  async getSpecifiedPosition(position) {
    try {
      if (!position) {
        return {
          success: false,
          error: '位置参数不能为空',
          message: '获取指定位置失败'
        };
      }

      return {
        success: true,
        position: {
          parentId: position.parentId || '',
          previousId: position.previousId || '',
          nextId: position.nextId || ''
        },
        message: '获取指定位置成功'
      };
    } catch (error) {
      console.error('获取指定位置失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取指定位置失败'
      };
    }
  }
}

module.exports = SmartInsertionStrategy;
