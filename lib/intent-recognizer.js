/**
 * 意图识别模块
 * 识别用户操作意图，转换为块操作
 */

class IntentRecognizer {
  /**
   * 构造函数
   * @param {Object} blockLocator - 块定位器实例
   * @param {Object} blockOperator - 块操作器实例
   */
  constructor(blockLocator, blockOperator) {
    this.blockLocator = blockLocator;
    this.blockOperator = blockOperator;
  }

  /**
   * 意图类型定义
   */
  static INTENT_TYPES = {
    INSERT_BLOCK: 'insert-block',
    UPDATE_BLOCK: 'update-block',
    DELETE_BLOCK: 'delete-block',
    MOVE_BLOCK: 'move-block',
    GET_BLOCK: 'get-block',
    SET_ATTRS: 'set-attrs',
    GET_ATTRS: 'get-attrs'
  };

  /**
   * 关键词映射
   */
  static KEYWORDS = {
    insert: ['插入', '添加', '新增', '增加', 'insert', 'add', 'append', 'prepend'],
    update: ['更新', '修改', '编辑', '更改', 'update', 'edit', 'change', 'modify'],
    delete: ['删除', '移除', '去掉', 'delete', 'remove', 'erase'],
    move: ['移动', '移动到', '转移', 'move', 'transfer', 'relocate'],
    get: ['获取', '查询', '查看', 'get', 'query', 'view', 'find'],
    attrs: ['属性', '设置属性', '获取属性', 'attributes', 'attrs', 'properties']
  };

  /**
   * 识别用户意图
   * @param {string} text - 用户输入文本
   * @param {Object} [context={}] - 上下文信息
   * @returns {Promise<Object>} 识别结果
   */
  async recognizeIntent(text, context = {}) {
    try {
      const textLower = text.toLowerCase();

      // 识别插入意图
      if (this._matchesKeywords(textLower, IntentRecognizer.KEYWORDS.insert)) {
        return await this._parseInsertIntent(text, context);
      }

      // 识别更新意图
      if (this._matchesKeywords(textLower, IntentRecognizer.KEYWORDS.update)) {
        return await this._parseUpdateIntent(text, context);
      }

      // 识别删除意图
      if (this._matchesKeywords(textLower, IntentRecognizer.KEYWORDS.delete)) {
        return await this._parseDeleteIntent(text, context);
      }

      // 识别移动意图
      if (this._matchesKeywords(textLower, IntentRecognizer.KEYWORDS.move)) {
        return await this._parseMoveIntent(text, context);
      }

      // 识别查询意图
      if (this._matchesKeywords(textLower, IntentRecognizer.KEYWORDS.get)) {
        return await this._parseGetIntent(text, context);
      }

      // 识别属性操作意图
      if (this._matchesKeywords(textLower, IntentRecognizer.KEYWORDS.attrs)) {
        return await this._parseAttrsIntent(text, context);
      }

      // 默认返回未知意图
      return {
        success: false,
        error: '无法识别操作意图',
        message: '请使用更明确的操作指令'
      };
    } catch (error) {
      console.error('意图识别失败:', error);
      return {
        success: false,
        error: error.message,
        message: '意图识别失败'
      };
    }
  }

  /**
   * 检查文本是否匹配关键词
   * @param {string} text - 文本
   * @param {Array} keywords - 关键词列表
   * @returns {boolean} 是否匹配
   */
  _matchesKeywords(text, keywords) {
    return keywords.some(keyword => text.includes(keyword.toLowerCase()));
  }

  /**
   * 解析插入意图
   * @param {string} text - 文本
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 解析结果
   */
  async _parseInsertIntent(text, context) {
    const content = this._extractContent(text);
    const docId = context.docId || context.documentId;

    if (!content) {
      return {
        success: false,
        error: '未找到要插入的内容',
        message: '请提供要插入的内容'
      };
    }

    return {
      success: true,
      intent: {
        type: IntentRecognizer.INTENT_TYPES.INSERT_BLOCK,
        params: {
          content,
          docId,
          mode: context.mode || 'append'
        }
      },
      message: '识别到插入意图'
    };
  }

  /**
   * 解析更新意图
   * @param {string} text - 文本
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 解析结果
   */
  async _parseUpdateIntent(text, context) {
    const content = this._extractContent(text);
    const blockId = context.blockId;

    if (!content) {
      return {
        success: false,
        error: '未找到要更新的内容',
        message: '请提供要更新的内容'
      };
    }

    return {
      success: true,
      intent: {
        type: IntentRecognizer.INTENT_TYPES.UPDATE_BLOCK,
        params: {
          content,
          blockId
        }
      },
      message: '识别到更新意图'
    };
  }

  /**
   * 解析删除意图
   * @param {string} text - 文本
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 解析结果
   */
  async _parseDeleteIntent(text, context) {
    const blockId = context.blockId;

    return {
      success: true,
      intent: {
        type: IntentRecognizer.INTENT_TYPES.DELETE_BLOCK,
        params: {
          blockId
        }
      },
      message: '识别到删除意图'
    };
  }

  /**
   * 解析移动意图
   * @param {string} text - 文本
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 解析结果
   */
  async _parseMoveIntent(text, context) {
    return {
      success: true,
      intent: {
        type: IntentRecognizer.INTENT_TYPES.MOVE_BLOCK,
        params: {
          blockId: context.blockId,
          targetBlockId: context.targetBlockId
        }
      },
      message: '识别到移动意图'
    };
  }

  /**
   * 解析查询意图
   * @param {string} text - 文本
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 解析结果
   */
  async _parseGetIntent(text, context) {
    return {
      success: true,
      intent: {
        type: IntentRecognizer.INTENT_TYPES.GET_BLOCK,
        params: {
          blockId: context.blockId,
          docId: context.docId
        }
      },
      message: '识别到查询意图'
    };
  }

  /**
   * 解析属性操作意图
   * @param {string} text - 文本
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 解析结果
   */
  async _parseAttrsIntent(text, context) {
    const textLower = text.toLowerCase();
    const isSet = textLower.includes('设置') || textLower.includes('set');

    return {
      success: true,
      intent: {
        type: isSet ? IntentRecognizer.INTENT_TYPES.SET_ATTRS : IntentRecognizer.INTENT_TYPES.GET_ATTRS,
        params: {
          blockId: context.blockId,
          attrs: context.attrs
        }
      },
      message: isSet ? '识别到设置属性意图' : '识别到获取属性意图'
    };
  }

  /**
   * 提取内容
   * @param {string} text - 文本
   * @returns {string|null} 提取的内容
   */
  _extractContent(text) {
    const contentMatch = text.match(/[""]([^""]+)[""]/);
    if (contentMatch) {
      return contentMatch[1];
    }
    
    const colonMatch = text.match(/[:：]\s*(.+)/);
    if (colonMatch) {
      return colonMatch[1].trim();
    }
    
    const keyword = ['插入', '添加', '新增', '增加', '更新', '修改', '编辑', '更改'];
    for (const kw of keyword) {
      const idx = text.indexOf(kw);
      if (idx !== -1) {
        const content = text.substring(idx + kw.length).trim();
        if (content.length > 0) {
          return content;
        }
      }
    }
    
    return text.trim();
  }

  /**
   * 根据意图执行操作
   * @param {Object} intent - 意图对象
   * @param {Object} [context={}] - 上下文
   * @returns {Promise<Object>} 执行结果
   */
  async executeIntent(intent, context = {}) {
    try {
      switch (intent.type) {
        case IntentRecognizer.INTENT_TYPES.INSERT_BLOCK:
          return await this._executeInsert(intent.params, context);
        
        case IntentRecognizer.INTENT_TYPES.UPDATE_BLOCK:
          return await this._executeUpdate(intent.params, context);
        
        case IntentRecognizer.INTENT_TYPES.DELETE_BLOCK:
          return await this._executeDelete(intent.params, context);
        
        case IntentRecognizer.INTENT_TYPES.MOVE_BLOCK:
          return await this._executeMove(intent.params, context);
        
        case IntentRecognizer.INTENT_TYPES.GET_BLOCK:
          return await this._executeGet(intent.params, context);
        
        case IntentRecognizer.INTENT_TYPES.SET_ATTRS:
        case IntentRecognizer.INTENT_TYPES.GET_ATTRS:
          return await this._executeAttrs(intent.params, intent.type, context);
        
        default:
          return {
            success: false,
            error: `未知的意图类型: ${intent.type}`,
            message: '操作执行失败'
          };
      }
    } catch (error) {
      console.error('执行意图失败:', error);
      return {
        success: false,
        error: error.message,
        message: '操作执行失败'
      };
    }
  }

  /**
   * 执行插入操作
   * @param {Object} params - 参数
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 执行结果
   */
  async _executeInsert(params, context) {
    if (!params.docId && !context.docId) {
      return {
        success: false,
        error: '缺少文档ID',
        message: '请提供文档ID'
      };
    }

    return {
      success: true,
      data: {
        operation: 'insert',
        content: params.content,
        docId: params.docId || context.docId
      },
      message: '准备插入块'
    };
  }

  /**
   * 执行更新操作
   * @param {Object} params - 参数
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 执行结果
   */
  async _executeUpdate(params, context) {
    return {
      success: true,
      data: {
        operation: 'update',
        blockId: params.blockId || context.blockId,
        content: params.content
      },
      message: '准备更新块'
    };
  }

  /**
   * 执行删除操作
   * @param {Object} params - 参数
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 执行结果
   */
  async _executeDelete(params, context) {
    return {
      success: true,
      data: {
        operation: 'delete',
        blockId: params.blockId || context.blockId
      },
      message: '准备删除块'
    };
  }

  /**
   * 执行移动操作
   * @param {Object} params - 参数
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 执行结果
   */
  async _executeMove(params, context) {
    return {
      success: true,
      data: {
        operation: 'move',
        blockId: params.blockId || context.blockId,
        targetBlockId: params.targetBlockId || context.targetBlockId
      },
      message: '准备移动块'
    };
  }

  /**
   * 执行查询操作
   * @param {Object} params - 参数
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 执行结果
   */
  async _executeGet(params, context) {
    return {
      success: true,
      data: {
        operation: 'get',
        blockId: params.blockId || context.blockId,
        docId: params.docId || context.docId
      },
      message: '准备查询块'
    };
  }

  /**
   * 执行属性操作
   * @param {Object} params - 参数
   * @param {string} intentType - 意图类型
   * @param {Object} context - 上下文
   * @returns {Promise<Object>} 执行结果
   */
  async _executeAttrs(params, intentType, context) {
    return {
      success: true,
      data: {
        operation: intentType,
        blockId: params.blockId || context.blockId,
        attrs: params.attrs || context.attrs
      },
      message: '准备操作块属性'
    };
  }
}

module.exports = IntentRecognizer;
