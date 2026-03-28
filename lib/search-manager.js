/**
 * 搜索管理器
 * 提供内容搜索相关的核心功能
 * 支持 SQL 搜索、语义搜索、关键词搜索和混合搜索
 */

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
   */
  constructor(connector, vectorManager = null, nlpManager = null) {
    this.connector = connector;
    this.vectorManager = vectorManager;
    this.nlpManager = nlpManager;
    this.concurrencyLimit = 5;
    this.batchSize = 10;
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
   * 验证并清理 ID 格式（思源笔记 ID 为 14-22 位字母数字）
   * @param {string} id - 需要验证的 ID
   * @returns {string|null} 清理后的 ID 或 null
   */
  validateId(id) {
    if (!id || typeof id !== 'string') {
      return null;
    }
    const cleaned = id.trim();
    if (!/^[a-zA-Z0-9_-]{14,32}$/.test(cleaned)) {
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

    if (mode === 'legacy') {
      return this.searchContent(validatedQuery, options);
    }

    switch (mode) {
      case 'semantic':
        return this.semanticSearch(validatedQuery, options);
      case 'keyword':
        return this.keywordSearch(validatedQuery, options);
      case 'hybrid':
      default:
        return this.hybridSearch(validatedQuery, options);
    }
  }

  /**
   * 检查向量搜索配置是否完整
   * @returns {Promise<boolean>}
   */
  async isVectorSearchConfigComplete() {
    if (!this.vectorManager) {
      return false;
    }

    // 检查 Qdrant 配置
    const qdrantConfig = this.vectorManager.getConfig ? this.vectorManager.getConfig() : {};
    const qdrantAvailable = qdrantConfig.url && qdrantConfig.url.trim() !== '';

    // 检查 Embedding 配置
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
      enableSQLFallback = true
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

        vectorProcessed = await this.enrichResultsWithContent(results);
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

      return {
        query,
        mode: 'hybrid',
        notebookId,
        results: mergedResults,
        total: mergedResults.length,
        limit,
        denseWeight,
        sparseWeight,
        sqlWeight,
        vectorSearch: true,
        sqlSearch: enableSQLFallback && sqlProcessed.length > 0,
        vectorCount: vectorProcessed.length,
        sqlCount: sqlProcessed.length
      };
    } catch (error) {
      console.error('混合搜索失败，回退到 SQL 搜索:', error.message);
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
      checkPermissionFn
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

      const processedResults = await this.enrichResultsWithContent(results);

      return {
        query,
        mode: 'semantic',
        notebookId,
        results: processedResults,
        total: processedResults.length,
        limit,
        vectorSearch: true
      };
    } catch (error) {
      console.error('语义搜索失败，回退到 SQL 搜索:', error.message);
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
      checkPermissionFn
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

      const processedResults = await this.enrichResultsWithContent(results);

      return {
        query,
        mode: 'keyword',
        notebookId,
        results: processedResults,
        total: processedResults.length,
        limit,
        vectorSearch: true
      };
    } catch (error) {
      console.error('关键词搜索失败，回退到 SQL 搜索:', error.message);
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

      return {
        id: result.id,
        originalId,
        isChunk,
        content,
        type: 'd',
        path: result.path || '',
        updated: result.updated || Date.now(),
        box: result.notebookId || '',
        parent_id: '',
        root_id: originalId,
        tags,
        title: result.title || '',
        relevanceScore: result.score || 0,
        denseScore: result.denseScore,
        sparseScore: result.sparseScore,
        excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
        vectorSearch: true
      };
    } catch (error) {
      return {
        id: result.id,
        originalId,
        isChunk,
        content: result.contentPreview || '',
        type: 'd',
        path: result.path || '',
        updated: result.updated || Date.now(),
        box: result.notebookId || '',
        parent_id: '',
        root_id: originalId,
        tags: [],
        title: result.title || '',
        relevanceScore: result.score || 0,
        denseScore: result.denseScore,
        sparseScore: result.sparseScore,
        excerpt: (result.contentPreview || '').substring(0, 200),
        vectorSearch: true
      };
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
   * @param {string} [options.sortBy='relevance'] - 排序方式
   * @param {string} [options.type] - 按单个类型过滤
   * @param {Array} [options.types] - 按多个类型过滤
   * @param {boolean} [options.hasTags] - 是否有标签
   * @param {string} [options.sql] - 自定义WHERE条件（通过 --where 参数传入）
   * @returns {Promise<Object>} 搜索结果
   */
  async searchContent(query, options = {}) {
    const {
      notebookId,
      path,
      parentId,
      limit = 20,
      sortBy = 'relevance',
      checkPermissionFn,
      type,
      types,
      hasTags,
      sql
    } = options;

    let results = [];

    try {
      const escapedQuery = this.escapeSql(query);
      let sqlQuery = `SELECT id, content, type, path, updated, box, parent_id, root_id FROM blocks WHERE content LIKE '%${escapedQuery}%'`;
      
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
      
      if (sql && typeof sql === 'string') {
        const sanitizedSql = sql
          .replace(/--/g, '')
          .replace(/;/g, '')
          .replace(/\/\*/g, '')
          .replace(/\*\//g, '');
        sqlQuery += ` AND ${sanitizedSql}`;
      }
      
      const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
      sqlQuery += ` LIMIT ${safeLimit}`;
      
      const sqlResults = await this.connector.request('/api/query/sql', { stmt: sqlQuery });
      results = sqlResults || [];
    } catch (error) {
      console.error('SQL查询失败:', error.message);
      results = [];
    }

    let filteredResults = results;
    if (checkPermissionFn && typeof checkPermissionFn === 'function') {
      filteredResults = results.filter(result => {
        return !result.box || checkPermissionFn(result.box);
      });
    }

    let finalResults = filteredResults;
    if (hasTags !== undefined) {
      finalResults = finalResults.filter(result => {
        const tags = this.extractTags(result.content || '');
        return hasTags ? tags.length > 0 : tags.length === 0;
      });
    }

    const processedResults = this.processSearchResults(finalResults, query, sortBy);

    return {
      query,
      mode: 'legacy',
      notebookId,
      path,
      parentId,
      type,
      types,
      hasTags,
      sql,
      results: processedResults,
      total: processedResults.length,
      limit,
      sortBy,
      vectorSearch: false
    };
  }

  /**
   * 处理搜索结果
   * @param {Array} results - 原始搜索结果
   * @param {string} query - 搜索查询
   * @param {string} sortBy - 排序方式
   * @returns {Array} 处理后的结果
   */
  processSearchResults(results, query, sortBy) {
    if (!results || !Array.isArray(results)) {
      return [];
    }

    const processedResults = results.map(result => {
      const content = result.content || '';
      const tags = this.extractTags(content);
      const relevanceScore = this.calculateRelevanceScore(content, query, tags);

      return {
        id: result.id,
        content,
        type: result.type || 'block',
        path: result.path || '',
        updated: result.updated || Date.now(),
        box: result.box || '',
        parent_id: result.parent_id || '',
        root_id: result.root_id || '',
        tags,
        relevanceScore,
        excerpt: content.substring(0, 200) + (content.length > 200 ? '...' : '')
      };
    });

    return processedResults.sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.updated) - new Date(a.updated);
      }
      return b.relevanceScore - a.relevanceScore;
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
   * 计算相关性分数（归一化到 0-1 范围）
   * @param {string} content - 内容文本
   * @param {string} query - 搜索查询
   * @param {Array} tags - 标签数组
   * @returns {number} 相关性分数 (0-1)
   */
  calculateRelevanceScore(content, query, tags) {
    if (!content || !query) {
      return 0;
    }

    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    if (contentLower.includes(queryLower)) {
      score += 0.4;
    }

    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    const matchedWords = queryWords.filter(word => contentLower.includes(word));
    if (queryWords.length > 0) {
      score += 0.3 * (matchedWords.length / queryWords.length);
    }

    const contentLengthBonus = Math.min(content.length / 5000, 0.1);
    score += contentLengthBonus;

    const tagBonus = Math.min(tags.length * 0.02, 0.1);
    score += tagBonus;

    if (content.startsWith('#')) {
      const headingMatch = content.match(/^#{1,6}/);
      if (headingMatch) {
        const headingLevel = headingMatch[0].length;
        score += (7 - headingLevel) * 0.02;
      }
    }

    return Math.min(Math.max(score, 0), 1);
  }

  /**
   * 归一化分数到 0-1 范围
   * @param {number} score - 原始分数
   * @param {number} minScore - 最小分数
   * @param {number} maxScore - 最大分数
   * @returns {number} 归一化后的分数
   */
  normalizeScore(score, minScore, maxScore) {
    if (maxScore === minScore) {
      return score > 0 ? 1 : 0;
    }
    return Math.min(Math.max((score - minScore) / (maxScore - minScore), 0), 1);
  }

  /**
   * 合并和去重搜索结果（改进的权重归一化版本）
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

    const normalizedDenseWeight = denseWeight / totalWeight;
    const normalizedSparseWeight = sparseWeight / totalWeight;
    const normalizedSqlWeight = sqlWeight / totalWeight;

    const vectorScores = vectorResults.map(r => r.relevanceScore || 0);
    const sqlScores = sqlResults.map(r => r.relevanceScore || 0);

    const vectorMin = vectorScores.length > 0 ? Math.min(...vectorScores) : 0;
    const vectorMax = vectorScores.length > 0 ? Math.max(...vectorScores) : 1;
    const sqlMin = sqlScores.length > 0 ? Math.min(...sqlScores) : 0;
    const sqlMax = sqlScores.length > 0 ? Math.max(...sqlScores) : 1;

    const exactMatchBoost = sqlWeight > 0 ? 0.5 : 0;

    const resultMap = new Map();

    vectorResults.forEach(result => {
      const id = result.id;
      const normalizedVectorScore = this.normalizeScore(result.relevanceScore || 0, vectorMin, vectorMax);
      const weightedScore = normalizedVectorScore * (normalizedDenseWeight + normalizedSparseWeight);

      if (!resultMap.has(id)) {
        resultMap.set(id, {
          ...result,
          source: 'vector',
          normalizedScore: normalizedVectorScore,
          weightedScore,
          vectorScore: result.relevanceScore || 0
        });
      } else {
        const existing = resultMap.get(id);
        if (weightedScore > existing.weightedScore) {
          resultMap.set(id, {
            ...result,
            source: 'vector',
            normalizedScore: normalizedVectorScore,
            weightedScore,
            vectorScore: result.relevanceScore || 0
          });
        }
      }
    });

    sqlResults.forEach(result => {
      const id = result.id;
      const normalizedSqlScore = this.normalizeScore(result.relevanceScore || 0, sqlMin, sqlMax);
      const boostedSqlScore = normalizedSqlScore + exactMatchBoost;
      const weightedSqlScore = Math.min(boostedSqlScore, 1) * normalizedSqlWeight;

      if (!resultMap.has(id)) {
        resultMap.set(id, {
          ...result,
          source: 'sql',
          normalizedScore: normalizedSqlScore,
          weightedScore: weightedSqlScore,
          sqlScore: result.relevanceScore || 0,
          exactMatch: true
        });
      } else {
        const existing = resultMap.get(id);
        const combinedWeightedScore = existing.weightedScore + weightedSqlScore;

        resultMap.set(id, {
          ...existing,
          source: 'hybrid',
          weightedScore: combinedWeightedScore,
          sqlScore: result.relevanceScore || 0,
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

    return allResults.slice(0, limit).map(result => ({
      ...result,
      relevanceScore: result.weightedScore
    }));
  }
}

module.exports = SearchManager;
