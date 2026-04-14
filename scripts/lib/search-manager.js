/**
 * 搜索管理器
 * 提供内容搜索相关的核心功能
 * 支持 SQL 搜索、语义搜索、关键词搜索和混合搜索
 */

const Reranker = require('./reranker');
const ScoreCalculator = require('./score-calculator');

/**
 * SearchManager 类
 * 管理搜索功能
 */
class SearchManager {
  /**
   * 构造函数
   * @param {Object} connector - Siyuan 连接器实例
   * @param {Object} vectorManager - Vector 管理器实例（可选）
   * @param {Object} nlpManager - NLP 管理器实例（可选）
   * @param {Object} config - 配置对象（可选）
   */
  constructor(connector, vectorManager = null, nlpManager = null, config = null) {
    this.connector = connector;
    this.vectorManager = vectorManager;
    this.nlpManager = nlpManager;
    this.config = config;
    this.concurrencyLimit = 5;
    this.batchSize = 10;
    this.scoreCalculator = new ScoreCalculator(config?.scoreWeights || {});
  }

  /**
   * 标准化搜索结果对象，统一字段格式
   * @param {Object} result - 原始搜索结果
   * @returns {Object} 标准化后的搜索结果
   */
  normalizeResult(result) {
    if (!result || typeof result !== 'object') {
      return result;
    }

    const normalized = {
      ...result,
      notebookId: result.notebookId || result.box || '',
      _legacy_box: result.box || null,
      source: result.source || this.determineSource(result),
      vectorSearch: result.vectorSearch ?? this.isVectorResult(result),
      isChunk: result.isChunk ?? false,
      chunkIndex: result.chunkIndex ?? null,
      totalChunks: result.totalChunks ?? null
    };

    if (!normalized.scores && (result.relevanceScore !== undefined || result.denseScore !== undefined || result.sparseScore !== undefined)) {
      normalized.scores = this.createScoreObject(result);
    } else if (!normalized.scores) {
      normalized.scores = {
        relevance: result.relevanceScore || 0,
        vector: { dense: null, sparse: null, combined: 0 },
        sql: null,
        rerank: null,
        final: result.relevanceScore || result.finalScore || 0
      };
    }

    return normalized;
  }

  /**
   * 判断结果是否来自向量搜索
   * @param {Object} result - 搜索结果
   * @returns {boolean} 是否为向量搜索结果
   */
  isVectorResult(result) {
    return result.vectorSearch === true || 
           result.denseScore !== undefined || 
           result.sparseScore !== undefined ||
           result.source === 'vector' ||
           result.source === 'hybrid';
  }

  /**
   * 确定搜索结果的来源
   * @param {Object} result - 搜索结果
   * @returns {string} 来源标识：sql/vector/hybrid/unknown
   */
  determineSource(result) {
    if (result.source) {
      return result.source;
    }
    
    if (this.isVectorResult(result)) {
      if (result.sqlScore !== undefined || result.sourceScore !== undefined) {
        return 'hybrid';
      }
      return 'vector';
    }
    
    if (result.sqlSearch !== false || result.box !== undefined) {
      return 'sql';
    }
    
    return 'unknown';
  }

  /**
   * 创建分数对象
   * @param {Object} result - 包含分数信息的结果对象
   * @returns {Object} 标准化的分数对象
   */
  createScoreObject(result) {
    return this.scoreCalculator.createScoreObject({
      relevanceScore: result.relevanceScore || 0,
      denseScore: result.denseScore || null,
      sparseScore: result.sparseScore || null,
      sqlScore: result.sqlScore || result.sourceScore || null,
      rerankScore: result.rerankScore || null,
      weights: this.config?.scoreWeights
    });
  }

  /**
   * 批量标准化搜索结果
   * @param {Array} results - 搜索结果数组
   * @returns {Array} 标准化后的结果数组
   */
  batchNormalizeResults(results) {
    if (!Array.isArray(results)) {
      return [];
    }
    return results.map(result => this.normalizeResult(result));
  }

  /**
   * 转义 SQL 字符串，防止 SQL 注入
   * @param {string} value - 需要转义的值
   * @returns {string} 转义后的值
   */
  escapeSql(value) {
    if (value === null || value === undefined) {
      return '';
    }
    const strValue = String(value);
    return strValue
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\0/g, '\\0')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\x1a/g, '\\Z');
  }

  /**
   * 清理 WHERE 子句，防止 SQL 注入
   * @param {string} where - WHERE 子句
   * @returns {string} 清理后的 WHERE 子句
   */
  sanitizeWhereClause(where) {
    if (!where || typeof where !== 'string') {
      return '';
    }

    const dangerousKeywords = [
      'DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'CREATE',
      'TRUNCATE', 'EXEC', 'EXECUTE', 'UNION', 'SELECT', 'GRANT',
      'REVOKE', 'SHUTDOWN', 'ATTACH', 'DETACH', 'PRAGMA'
    ];

    let sanitized = where
      .replace(/--/g, '')
      .replace(/;/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .trim();

    const upperSanitized = sanitized.toUpperCase();
    for (const keyword of dangerousKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(upperSanitized)) {
        return '';
      }
    }

    return sanitized;
  }

  /**
   * 验证并清理 ID 格式（思源笔记 ID 格式为 YYYYMMDDHHmmss-xxxxxx）
   * @param {string} id - 需要验证的 ID
   * @returns {string|null} 清理后的 ID 或 null
   */
  validateId(id) {
    if (!id || typeof id !== 'string') {
      return null;
    }
    const cleaned = id.trim();
    if (!/^\d{14}-[a-z0-9]{4,14}$/.test(cleaned)) {
      return null;
    }
    return cleaned;
  }

  /**
   * 验证类型参数
   * @param {string} type - 需要验证的类型
   * @returns {string|null} 验证后的类型或 null
   */
  validateType(type) {
    if (!type || typeof type !== 'string') {
      return null;
    }
    const allowedTypes = ['d', 's', 'h', 'p', 'm', 't', 'html', 'video', 'audio', 'widget', 'iframe'];
    const cleaned = type.trim().toLowerCase();
    return allowedTypes.includes(cleaned) ? cleaned : null;
  }

  /**
   * 验证搜索模式
   * @param {string} mode - 搜索模式
   * @returns {string} 有效的搜索模式
   */
  validateMode(mode) {
    const allowedModes = ['legacy', 'semantic', 'keyword', 'hybrid'];
    if (!mode || typeof mode !== 'string') {
      return 'legacy';
    }
    const cleaned = mode.trim().toLowerCase();
    return allowedModes.includes(cleaned) ? cleaned : 'legacy';
  }

  /**
   * 验证权重参数
   * @param {number} weight - 权重值
   * @param {number} defaultValue - 默认值
   * @returns {number} 有效的权重值
   */
  validateWeight(weight, defaultValue = 0) {
    if (typeof weight !== 'number' || isNaN(weight)) {
      return defaultValue;
    }
    return Math.max(0, Math.min(weight, 1));
  }

  /**
   * 验证 limit 参数
   * @param {number} limit - 限制值
   * @param {number} defaultLimit - 默认值
   * @returns {number} 有效的限制值
   */
  validateLimit(limit, defaultLimit = 20) {
    if (typeof limit !== 'number' || isNaN(limit) || limit <= 0) {
      return defaultLimit;
    }
    return Math.min(Math.floor(limit), 100);
  }

  /**
   * 验证搜索查询
   * @param {string} query - 搜索查询
   * @returns {string} 清理后的查询
   */
  validateQuery(query) {
    if (!query || typeof query !== 'string') {
      return '';
    }
    return query.trim().substring(0, 1000);
  }

  /**
   * 设置 Vector 管理器
   * @param {Object} manager - Vector 管理器实例
   */
  setVectorManager(manager) {
    this.vectorManager = manager;
  }

  /**
   * 设置 NLP 管理器
   * @param {Object} manager - NLP 管理器实例
   */
  setNLPManager(manager) {
    this.nlpManager = manager;
  }

  /**
   * 统一搜索入口
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async search(query, options = {}) {
    const validatedQuery = this.validateQuery(query);
    if (!validatedQuery) {
      return {
        query: '',
        mode: 'legacy',
        results: [],
        total: 0,
        error: '搜索查询不能为空'
      };
    }

    const mode = this.validateMode(options.mode);

    const isConfigComplete = await this.isVectorSearchConfigComplete();

    if (mode === 'semantic' || mode === 'keyword') {
      if (!isConfigComplete) {
        throw new Error(`配置不完整，${mode} 搜索需要设置 QDRANT_URL 和 Ollama 相关配置`);
      }
    }

    if (mode === 'hybrid' && !isConfigComplete) {
      throw new Error(`配置不完整，${mode} 搜索需要设置 QDRANT_URL 和 Ollama 相关配置`);
    }

    let searchResult;

    if (mode === 'legacy') {
      searchResult = await this.searchContent(validatedQuery, options);
    } else {
      switch (mode) {
        case 'semantic':
          searchResult = await this.semanticSearch(validatedQuery, options);
          break;
        case 'keyword':
          searchResult = await this.keywordSearch(validatedQuery, options);
          break;
        case 'hybrid':
        default:
          searchResult = await this.hybridSearch(validatedQuery, options);
          break;
      }
    }

    if (searchResult.rerank?.enabled) {
      return searchResult;
    }

    const { enableRerank, rerankTopK, rerankWeight, checkPermissionFn } = options;
    if (enableRerank && this.vectorManager && this.vectorManager.embeddingManager) {
      try {
        const Reranker = require('./reranker');
        const rerankConfig = this.config?.rerank || {};
        const reranker = new Reranker(
          this.vectorManager.embeddingManager,
          {
            rerankTopK: rerankTopK || rerankConfig.rerankTopK || 50,
            rerankWeight: rerankWeight !== undefined ? rerankWeight : (rerankConfig.rerankWeight || 0.5),
            preserveOriginalScore: rerankConfig.preserveOriginalScore !== false,
            batchSize: rerankConfig.batchSize || 10,
            enableSegmentRerank: rerankConfig.enableSegmentRerank !== false,
            segmentMaxLength: this.config?.embedding?.maxChunkLength || 4000,
            segmentOverlap: Math.floor((this.config?.embedding?.minChunkLength || 200) / 2) || 100,
            maxContentLength: this.config?.embedding?.maxContentLength || 4000
          }
        );

        let resultsToRerank = searchResult.results || [];
        if (checkPermissionFn && typeof checkPermissionFn === 'function') {
          resultsToRerank = resultsToRerank.filter(result => {
            const notebookId = result.box || result.notebookId;
            return !notebookId || checkPermissionFn(notebookId);
          });
        }

        const enrichedResults = await this.enrichResultsWithContent(resultsToRerank);
        const finalResults = await reranker.rerank(validatedQuery, enrichedResults);

        searchResult = {
          ...searchResult,
          results: finalResults,
          total: finalResults.length,
          rerank: {
            enabled: true,
            rerankCount: finalResults.length
          }
        };
      } catch (error) {
        console.warn('Legacy 模式重排失败，使用原始结果:', error.message);
      }
    }

    return searchResult;
  }

  /**
   * 检查向量搜索配置是否完整
   * @returns {Promise<boolean>}
   */
  async isVectorSearchConfigComplete() {
    if (!this.vectorManager) {
      return false;
    }

    const config = this.vectorManager.getConfig ? this.vectorManager.getConfig() : {};
    const qdrantAvailable = config.qdrant && config.qdrant.url && config.qdrant.url.trim() !== '';

    const embeddingConfig = this.vectorManager.embeddingManager && 
      this.vectorManager.embeddingManager.getConfig ? 
      this.vectorManager.embeddingManager.getConfig() : {};
    const embeddingAvailable = this.vectorManager.embeddingManager && 
      embeddingConfig.baseUrl && embeddingConfig.baseUrl.trim() !== '';

    return qdrantAvailable && embeddingAvailable;
  }

  /**
   * 检查向量搜索是否可用
   * @returns {Promise<boolean>}
   */
  async isVectorSearchAvailable() {
    if (!this.vectorManager) {
      return false;
    }

    try {
      return this.vectorManager.isReady();
    } catch (error) {
      return false;
    }
  }

  /**
   * 混合搜索（Dense + Sparse + SQL 并行执行）
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async hybridSearch(query, options = {}) {
    if (!this.vectorManager || !await this.isVectorSearchAvailable()) {
      return this.searchContent(query, options);
    }

    const {
      notebookId,
      limit = 20,
      denseWeight = 0.7,
      sparseWeight = 0.3,
      sqlWeight = 0,
      threshold = 0.0,
      checkPermissionFn,
      enableSQLFallback = true,
      enableRerank = false,
      rerankTopK = 50,
      rerankWeight = 0.5
    } = options;

    try {
      const filter = this.buildVectorFilter(options);
      
      const totalWeight = denseWeight + sparseWeight + sqlWeight;
      const vectorLimit = Math.floor(limit * (denseWeight + sparseWeight) / totalWeight);
      const sqlLimit = Math.floor(limit * sqlWeight / totalWeight);
      
      const [vectorResults, sqlResults] = await Promise.all([
        this.vectorManager.hybridSearch(query, {
          limit: limit,
          denseWeight,
          sparseWeight,
          threshold,
          filter
        }).catch(error => {
          return { results: [] };
        }),
        
        enableSQLFallback && sqlWeight > 0 ? 
          this.searchContent(query, {
            ...options,
            limit: limit
          }).catch(error => {
            return { results: [] };
          }) :
          Promise.resolve({ results: [] })
      ]);

      let vectorProcessed = [];
      if (vectorResults && vectorResults.results) {
        let results = vectorResults.results;

        if (checkPermissionFn && typeof checkPermissionFn === 'function') {
          results = results.filter(result => 
            !result.notebookId || checkPermissionFn(result.notebookId)
          );
        }

        const deduplicatedResults = this.deduplicateByDocId(results);
        vectorProcessed = await this.enrichResultsWithContent(deduplicatedResults);
      }

      let sqlProcessed = [];
      if (sqlResults && sqlResults.results) {
        let results = sqlResults.results;

        if (checkPermissionFn && typeof checkPermissionFn === 'function') {
          results = results.filter(result => {
            return !result.box || checkPermissionFn(result.box);
          });
        }

        sqlProcessed = results.map(result => ({
          ...result,
          source: 'sql',
          sourceScore: result.relevanceScore || 0
        }));
      }

      const totalResults = vectorProcessed.length + sqlProcessed.length;
      
      const mergedResults = this.mergeAndDeduplicateResults(
        vectorProcessed,
        sqlProcessed,
        limit,
        denseWeight,
        sparseWeight,
        sqlWeight
      );

      let finalResults = mergedResults;
      let rerankInfo = null;

      if (enableRerank && this.vectorManager && this.vectorManager.embeddingManager) {
        try {
          const rerankConfig = this.config?.rerank || {};
          const reranker = new Reranker(
            this.vectorManager.embeddingManager,
            {
              rerankTopK: rerankTopK || rerankConfig.rerankTopK || 50,
              rerankWeight: rerankWeight !== undefined ? rerankWeight : (rerankConfig.rerankWeight || 0.5),
              preserveOriginalScore: rerankConfig.preserveOriginalScore !== false,
              batchSize: rerankConfig.batchSize || 10,
              enableSegmentRerank: rerankConfig.enableSegmentRerank !== false,
              segmentMaxLength: this.config?.embedding?.maxChunkLength || 4000,
              segmentOverlap: Math.floor((this.config?.embedding?.minChunkLength || 200) / 2) || 100,
              maxContentLength: this.config?.embedding?.maxContentLength || 4000
            }
          );

          finalResults = await reranker.rerank(query, mergedResults);

          rerankInfo = {
            enabled: true,
            rerankCount: finalResults.length
          };
        } catch (error) {
          console.warn('重排失败，使用原始结果:', error.message);
          console.error('重排错误详情:', error);
          finalResults = mergedResults;
          rerankInfo = {
            enabled: false,
            error: error.message
          };
        }
      }

      return {
        query,
        mode: 'hybrid',
        notebookId,
        results: finalResults,
        total: finalResults.length,
        limit,
        denseWeight,
        sparseWeight,
        sqlWeight,
        vectorSearch: true,
        sqlSearch: enableSQLFallback && sqlProcessed.length > 0,
        vectorCount: vectorProcessed.length,
        sqlCount: sqlProcessed.length,
        rerank: rerankInfo
      };
    } catch (error) {
      return this.searchContent(query, options);
    }
  }

  /**
   * 语义搜索（仅 Dense Vector）
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async semanticSearch(query, options = {}) {
    if (!this.vectorManager || !await this.isVectorSearchAvailable()) {
      return this.searchContent(query, options);
    }

    const {
      notebookId,
      limit = 20,
      threshold = 0.0,
      checkPermissionFn,
      enableRerank = false,
      rerankTopK = 50,
      rerankWeight = 0.5
    } = options;

    try {
      const filter = this.buildVectorFilter(options);

      const vectorResults = await this.vectorManager.semanticSearch(query, {
        limit,
        threshold,
        filter
      });

      let results = vectorResults.results;

      if (checkPermissionFn && typeof checkPermissionFn === 'function') {
        results = results.filter(result =>
          !result.notebookId || checkPermissionFn(result.notebookId)
        );
      }

      const deduplicatedResults = this.deduplicateByDocId(results);
      const processedResults = await this.enrichResultsWithContent(deduplicatedResults);

      let finalResults = processedResults;
      let rerankInfo = null;

      if (enableRerank && this.vectorManager && this.vectorManager.embeddingManager) {
        try {
          const rerankConfig = this.config?.rerank || {};
          const reranker = new Reranker(
            this.vectorManager.embeddingManager,
            {
              rerankTopK: rerankTopK || rerankConfig.rerankTopK || 50,
              rerankWeight: rerankWeight !== undefined ? rerankWeight : (rerankConfig.rerankWeight || 0.5),
              preserveOriginalScore: rerankConfig.preserveOriginalScore !== false,
              batchSize: rerankConfig.batchSize || 10,
              enableSegmentRerank: rerankConfig.enableSegmentRerank !== false,
              segmentMaxLength: this.config?.embedding?.maxChunkLength || 4000,
              segmentOverlap: Math.floor((this.config?.embedding?.minChunkLength || 200) / 2) || 100,
              maxContentLength: this.config?.embedding?.maxContentLength || 4000
            }
          );

          finalResults = await reranker.rerank(query, processedResults);

          rerankInfo = {
            enabled: true,
            rerankCount: finalResults.length
          };
        } catch (error) {
          console.warn('重排失败，使用原始结果:', error.message);
          finalResults = processedResults;
          rerankInfo = {
            enabled: false,
            error: error.message
          };
        }
      }

      return {
        query,
        mode: 'semantic',
        notebookId,
        results: finalResults,
        total: finalResults.length,
        limit,
        vectorSearch: true,
        rerank: rerankInfo
      };
    } catch (error) {
      return this.searchContent(query, options);
    }
  }

  /**
   * 关键词搜索（仅 Sparse Vector）
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async keywordSearch(query, options = {}) {
    if (!this.vectorManager || !await this.isVectorSearchAvailable()) {
      return this.searchContent(query, options);
    }

    const {
      notebookId,
      limit = 20,
      checkPermissionFn,
      enableRerank = false,
      rerankTopK = 50,
      rerankWeight = 0.5
    } = options;

    try {
      const filter = this.buildVectorFilter(options);

      const vectorResults = await this.vectorManager.keywordSearch(query, {
        limit,
        filter
      });

      let results = vectorResults.results;

      if (checkPermissionFn && typeof checkPermissionFn === 'function') {
        results = results.filter(result =>
          !result.notebookId || checkPermissionFn(result.notebookId)
        );
      }

      const deduplicatedResults = this.deduplicateByDocId(results);
      const processedResults = await this.enrichResultsWithContent(deduplicatedResults);

      let finalResults = processedResults;
      let rerankInfo = null;

      if (enableRerank && this.vectorManager && this.vectorManager.embeddingManager) {
        try {
          const rerankConfig = this.config?.rerank || {};
          const reranker = new Reranker(
            this.vectorManager.embeddingManager,
            {
              rerankTopK: rerankTopK || rerankConfig.rerankTopK || 50,
              rerankWeight: rerankWeight !== undefined ? rerankWeight : (rerankConfig.rerankWeight || 0.5),
              preserveOriginalScore: rerankConfig.preserveOriginalScore !== false,
              batchSize: rerankConfig.batchSize || 10,
              enableSegmentRerank: rerankConfig.enableSegmentRerank !== false,
              segmentMaxLength: this.config?.embedding?.maxChunkLength || 4000,
              segmentOverlap: Math.floor((this.config?.embedding?.minChunkLength || 200) / 2) || 100,
              maxContentLength: this.config?.embedding?.maxContentLength || 4000
            }
          );

          finalResults = await reranker.rerank(query, processedResults);

          rerankInfo = {
            enabled: true,
            rerankCount: finalResults.length
          };
        } catch (error) {
          console.warn('重排失败，使用原始结果:', error.message);
          finalResults = processedResults;
          rerankInfo = {
            enabled: false,
            error: error.message
          };
        }
      }

      return {
        query,
        mode: 'keyword',
        notebookId,
        results: finalResults,
        total: finalResults.length,
        limit,
        vectorSearch: true,
        rerank: rerankInfo
      };
    } catch (error) {
      return this.searchContent(query, options);
    }
  }

  /**
   * 构建向量搜索过滤条件
   * @param {Object} options - 搜索选项
   * @returns {Object|null} 过滤条件
   */
  buildVectorFilter(options) {
    const filter = {};

    if (options.notebookId) {
      filter.notebookId = options.notebookId;
    }

    if (options.notebookIds && Array.isArray(options.notebookIds)) {
      filter.notebookIds = options.notebookIds;
    }

    if (options.tags && Array.isArray(options.tags)) {
      filter.tags = options.tags;
    }

    if (options.updatedAfter) {
      filter.updatedAfter = options.updatedAfter;
    }

    return Object.keys(filter).length > 0 ? filter : null;
  }

  /**
   * 从 chunk ID 中提取原始文档 ID
   * @param {string} id - 可能包含 _chunk_X 后缀的 ID
   * @returns {string} 原始文档 ID
   */
  extractOriginalId(id) {
    if (!id || typeof id !== 'string') {
      return id;
    }
    const chunkMatch = id.match(/^(.+)_chunk_\d+$/);
    if (chunkMatch) {
      return chunkMatch[1];
    }
    return id;
  }

  /**
   * 用完整内容丰富单个搜索结果
   * @param {Object} result - 单个搜索结果
   * @returns {Promise<Object>} 丰富后的结果
   */
  async enrichSingleResult(result) {
    const originalId = this.extractOriginalId(result.id);
    const isChunk = originalId !== result.id;
    
    try {
      const docContent = await this.connector.request('/api/export/exportMdContent', {
        id: originalId
      });

      const content = docContent?.content || result.contentPreview || '';
      const tags = this.extractTags(content);
      const excerpt = content.substring(0, 200) + (content.length > 200 ? '...' : '');

      const baseResult = {
        id: result.id,
        originalId,
        blockId: result.blockId || originalId,
        isChunk,
        chunkIndex: result.chunkIndex || null,
        totalChunks: result.totalChunks || null,
        content,
        type: 'd',
        path: result.path || '',
        updated: result.updated || Date.now(),
        box: result.notebookId || '',
        notebookId: result.notebookId || '',
        parent_id: '',
        root_id: originalId,
        tags,
        title: result.title || '',
        relevanceScore: result.score || 0,
        finalScore: result.score || 0,
        denseScore: result.denseScore,
        sparseScore: result.sparseScore,
        excerpt,
        vectorSearch: true,
        source: 'vector'
      };

      return this.normalizeResult(baseResult);
    } catch (error) {
      const baseResult = {
        id: result.id,
        originalId,
        blockId: result.blockId || originalId,
        isChunk,
        chunkIndex: result.chunkIndex || null,
        totalChunks: result.totalChunks || null,
        content: result.contentPreview || '',
        type: 'd',
        path: result.path || '',
        updated: result.updated || Date.now(),
        box: result.notebookId || '',
        notebookId: result.notebookId || '',
        parent_id: '',
        root_id: originalId,
        tags: [],
        title: result.title || '',
        relevanceScore: result.score || 0,
        finalScore: result.score || 0,
        denseScore: result.denseScore,
        sparseScore: result.sparseScore,
        excerpt: (result.contentPreview || '').substring(0, 200),
        vectorSearch: true,
        source: 'vector'
      };

      return this.normalizeResult(baseResult);
    }
  }

  /**
   * 带并发控制的批量处理
   * @param {Array} items - 需要处理的项目数组
   * @param {Function} processor - 处理函数
   * @param {number} concurrency - 并发数
   * @returns {Promise<Array>} 处理结果数组
   */
  async processWithConcurrency(items, processor, concurrency = this.concurrencyLimit) {
    const results = [];
    const executing = [];

    for (const item of items) {
      const promise = processor(item).then(result => {
        executing.splice(executing.indexOf(promise), 1);
        return result;
      });
      results.push(promise);
      executing.push(promise);

      if (executing.length >= concurrency) {
        await Promise.race(executing);
      }
    }

    return Promise.all(results);
  }

  /**
   * 用完整内容丰富搜索结果（带并发控制和分批处理）
   * @param {Array} results - 向量搜索结果
   * @returns {Promise<Array>} 丰富后的结果
   */
  async enrichResultsWithContent(results) {
    if (!results || results.length === 0) {
      return [];
    }

    if (results.length <= this.batchSize) {
      return this.processWithConcurrency(results, this.enrichSingleResult.bind(this));
    }

    const batches = [];
    for (let i = 0; i < results.length; i += this.batchSize) {
      batches.push(results.slice(i, i + this.batchSize));
    }

    const enrichedResults = [];
    for (let i = 0; i < batches.length; i++) {
      const batchResults = await this.processWithConcurrency(
        batches[i],
        this.enrichSingleResult.bind(this)
      );
      enrichedResults.push(...batchResults);
    }

    return enrichedResults;
  }

  /**
   * 搜索内容（SQL 搜索）
   * @param {string} query - 搜索查询
   * @param {Object} [options={}] - 搜索选项
   * @param {string} [options.notebookId] - 笔记本ID
   * @param {string} [options.path] - 搜索路径
   * @param {string} [options.parentId] - 父文档ID
   * @param {number} [options.limit=20] - 结果限制
   * @param {string} [options.sort='relevance'] - 排序方式
   * @param {string} [options.type] - 按单个类型过滤
   * @param {Array} [options.types] - 按多个类型过滤
   * @param {Array} [options.tags] - 标签过滤
   * @param {string} [options.where] - 自定义WHERE条件
   * @returns {Promise<Object>} 搜索结果
   */
  async searchContent(query, options = {}) {
    const {
      notebookId,
      path,
      parentId,
      limit = 20,
      sort = 'relevance',
      checkPermissionFn,
      type,
      types,
      tags,
      where
    } = options;

    let results = [];

    try {
      const escapedQuery = this.escapeSql(query);
      let sqlQuery = `SELECT id, content, type, path, updated, box, parent_id, root_id FROM blocks WHERE content LIKE '%${escapedQuery}%'`;

      const config = this.config || this.connector.getConfig();
      const permissionMode = config.permissionMode || 'all';
      const notebookList = Array.isArray(config.notebookList) ? config.notebookList : [];

      if (permissionMode === 'whitelist' && notebookList.length > 0) {
        const validNotebooks = notebookList
          .map(id => this.validateId(id))
          .filter(id => id !== null);
        if (validNotebooks.length > 0) {
          sqlQuery += ` AND box IN ('${validNotebooks.join("','")}')`;
        }
      } else if (permissionMode === 'blacklist' && notebookList.length > 0) {
        const validNotebooks = notebookList
          .map(id => this.validateId(id))
          .filter(id => id !== null);
        if (validNotebooks.length > 0) {
          sqlQuery += ` AND box NOT IN ('${validNotebooks.join("','")}')`;
        }
      }
      
      if (notebookId) {
        const validNotebookId = this.validateId(notebookId);
        if (validNotebookId) {
          sqlQuery += ` AND box = '${validNotebookId}'`;
        }
      }
      
      if (parentId) {
        const validParentId = this.validateId(parentId);
        if (validParentId) {
          sqlQuery += ` AND (path LIKE '/${validParentId}/%' OR root_id = '${validParentId}')`;
        }
      }
      
      if (type) {
        const validType = this.validateType(type);
        if (validType) {
          sqlQuery += ` AND type = '${validType}'`;
        }
      }
      
      if (types && Array.isArray(types) && types.length > 0) {
        const validTypes = types
          .map(t => this.validateType(t))
          .filter(t => t !== null);
        if (validTypes.length > 0) {
          sqlQuery += ` AND type IN ('${validTypes.join("','")}')`;
        }
      }
      
      if (where && typeof where === 'string') {
        const sanitizedWhere = this.sanitizeWhereClause(where);
        sqlQuery += ` AND ${sanitizedWhere}`;
      }
      
      const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
      sqlQuery += ` LIMIT ${safeLimit}`;
      
      const sqlResults = await this.connector.request('/api/query/sql', { stmt: sqlQuery });
      results = sqlResults || [];
    } catch (error) {
      results = [];
    }

    let filteredResults = results;
    if (checkPermissionFn && typeof checkPermissionFn === 'function') {
      filteredResults = results.filter(result => {
        return !result.box || checkPermissionFn(result.box);
      });
    }

    let finalResults = filteredResults;
    if (tags !== undefined && Array.isArray(tags) && tags.length > 0) {
      finalResults = finalResults.filter(result => {
        const resultTags = this.extractTags(result.content || '');
        return tags.some(tag => resultTags.includes(tag));
      });
    }

    const processedResults = this.processSearchResults(finalResults, query, sort);

    return {
      query,
      mode: 'legacy',
      notebookId,
      path,
      parentId,
      type,
      types,
      tags,
      where,
      results: processedResults,
      total: processedResults.length,
      limit,
      sort,
      vectorSearch: false
    };
  }

  /**
   * 处理搜索结果
   * @param {Array} results - 原始搜索结果
   * @param {string} query - 搜索查询
   * @param {string} sort - 排序方式
   * @returns {Array} 处理后的结果
   */
  processSearchResults(results, query, sort) {
    if (!results || !Array.isArray(results)) {
      return [];
    }

    const processedResults = results.map(result => {
      const content = result.content || '';
      const tags = this.extractTags(content);
      const relevanceScore = this.scoreCalculator.calculateRelevanceScore(content, query, tags);
      const excerpt = content.substring(0, 200) + (content.length > 200 ? '...' : '');

      const baseResult = {
        id: result.id,
        content,
        type: result.type || 'block',
        path: result.path || '',
        updated: result.updated || Date.now(),
        box: result.box || '',
        notebookId: result.notebookId || result.box || '',
        parent_id: result.parent_id || '',
        root_id: result.root_id || '',
        tags,
        relevanceScore,
        finalScore: relevanceScore,
        excerpt,
        source: 'sql',
        vectorSearch: false
      };

      return this.normalizeResult(baseResult);
    });

    return processedResults.sort((a, b) => {
      if (sort === 'date') {
        return new Date(b.updated) - new Date(a.updated);
      }
      return (b.scores?.final || 0) - (a.scores?.final || 0);
    });
  }

  /**
   * 从内容中提取标签
   * @param {string} content - 内容文本
   * @returns {Array} 标签数组
   */
  extractTags(content) {
    const tagRegex = /#([^\s#]+)/g;
    const tags = [];
    let match;
    while ((match = tagRegex.exec(content)) !== null) {
      tags.push(match[1]);
    }
    return tags;
  }

  /**
   * 按文档ID去重，每个文档只保留得分最高的结果
   * @param {Array} results - 搜索结果数组
   * @returns {Array} 去重后的结果数组
   */
  deduplicateByDocId(results) {
    if (!Array.isArray(results) || results.length === 0) {
      return [];
    }

    const docMap = new Map();

    results.forEach(result => {
      const docId = result.blockId || result.id;
      const existing = docMap.get(docId);
      const currentScore = result.score || result.relevanceScore || 0;
      const existingScore = existing?.score || existing?.relevanceScore || 0;

      if (!existing || currentScore > existingScore) {
        docMap.set(docId, result);
      }
    });

    return Array.from(docMap.values());
  }

  /**
   * 合并和去重搜索结果（使用 ScoreCalculator 统一分数计算）
   * @param {Array} vectorResults - 向量搜索结果
   * @param {Array} sqlResults - SQL搜索结果
   * @param {number} limit - 结果限制
   * @param {number} denseWeight - 密集向量权重
   * @param {number} sparseWeight - 稀疏向量权重
   * @param {number} sqlWeight - SQL搜索权重
   * @returns {Array} 合并后的结果
   */
  mergeAndDeduplicateResults(vectorResults, sqlResults, limit, denseWeight = 0.7, sparseWeight = 0.3, sqlWeight = 0.0) {
    const totalWeight = denseWeight + sparseWeight + sqlWeight;
    if (totalWeight <= 0) {
      return [];
    }

    const weights = { dense: denseWeight, sparse: sparseWeight, sql: sqlWeight };
    const exactMatchBoost = sqlWeight > 0 ? 0.5 : 0;
    const resultMap = new Map();

    vectorResults.forEach(result => {
      const id = result.id;
      const denseScore = result.denseScore || result.scores?.vector?.dense || null;
      const sparseScore = result.sparseScore || result.scores?.vector?.sparse || null;
      const vectorScore = this.scoreCalculator.calculateVectorScore(denseScore, sparseScore, weights);
      const weightedScore = vectorScore * ((denseWeight + sparseWeight) / totalWeight);

      if (!resultMap.has(id)) {
        resultMap.set(id, {
          ...result,
          source: 'vector',
          weightedScore,
          vectorScore: result.relevanceScore || vectorScore
        });
      } else {
        const existing = resultMap.get(id);
        if (weightedScore > (existing.weightedScore || 0)) {
          resultMap.set(id, {
            ...result,
            source: 'vector',
            weightedScore,
            vectorScore: result.relevanceScore || vectorScore
          });
        }
      }
    });

    sqlResults.forEach(result => {
      const id = result.id;
      const sqlScore = result.relevanceScore || result.sourceScore || 0;
      const normalizedSqlScore = this.scoreCalculator.normalize(sqlScore, 0, 1);
      const boostedSqlScore = Math.min(normalizedSqlScore + exactMatchBoost, 1);
      const weightedSqlScore = boostedSqlScore * (sqlWeight / totalWeight);

      if (!resultMap.has(id)) {
        resultMap.set(id, {
          ...result,
          source: 'sql',
          weightedScore: weightedSqlScore,
          sqlScore: sqlScore,
          exactMatch: true
        });
      } else {
        const existing = resultMap.get(id);
        const combinedWeightedScore = (existing.weightedScore || 0) + weightedSqlScore;

        resultMap.set(id, {
          ...existing,
          source: 'hybrid',
          weightedScore: combinedWeightedScore,
          sqlScore: sqlScore,
          relevanceScore: combinedWeightedScore,
          exactMatch: true
        });
      }
    });

    const allResults = Array.from(resultMap.values());

    allResults.sort((a, b) => {
      const exactA = a.exactMatch ? 1 : 0;
      const exactB = b.exactMatch ? 1 : 0;
      if (exactA !== exactB) {
        return exactB - exactA;
      }
      
      const scoreA = a.weightedScore || 0;
      const scoreB = b.weightedScore || 0;
      return scoreB - scoreA;
    });

    return allResults.slice(0, limit).map(result => {
      const finalScore = this.scoreCalculator.calculateFinalScore({
        relevanceScore: result.relevanceScore,
        denseScore: result.denseScore,
        sparseScore: result.sparseScore,
        sqlScore: result.sqlScore,
        weights
      });

      return this.normalizeResult({
        ...result,
        relevanceScore: result.weightedScore || finalScore,
        finalScore: finalScore,
        originalVectorScore: result.vectorScore,
        originalSqlScore: result.sqlScore,
        source: result.source || 'unknown'
      });
    });
  }
}

module.exports = SearchManager;
