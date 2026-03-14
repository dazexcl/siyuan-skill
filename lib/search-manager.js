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
    const { mode = 'legacy' } = options;

    // 检查配置是否完整
    const isConfigComplete = await this.isVectorSearchConfigComplete();

    // 对于 semantic 和 keyword 模式，配置缺失时报错
    if (mode === 'semantic' || mode === 'keyword') {
      if (!isConfigComplete) {
        throw new Error(`配置不完整，${mode} 搜索需要设置 QDRANT_URL 和 Ollama 相关配置`);
      }
    }

    // 对于 hybrid 模式，配置缺失时回退到 SQL 搜索
    if (mode === 'hybrid' && !isConfigComplete) {
      throw new Error(`配置不完整，${mode} 搜索需要设置 QDRANT_URL 和 Ollama 相关配置`);
    }

    // 对于 legacy 模式，直接使用 SQL 搜索
    if (mode === 'legacy') {
      return this.searchContent(query, options);
    }

    // 向量搜索可用时执行相应模式
    switch (mode) {
      case 'semantic':
        return this.semanticSearch(query, options);
      case 'keyword':
        return this.keywordSearch(query, options);
      case 'hybrid':
      default:
        return this.hybridSearch(query, options);
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
   * 用完整内容丰富搜索结果
   * @param {Array} results - 向量搜索结果
   * @returns {Promise<Array>} 丰富后的结果
   */
  async enrichResultsWithContent(results) {
    if (!results || results.length === 0) {
      return [];
    }

    const enrichedResults = await Promise.all(
      results.map(async (result) => {
        try {
          const docContent = await this.connector.request('/api/export/exportMdContent', {
            id: result.id
          });

          const content = docContent?.content || result.contentPreview || '';
          const tags = this.extractTags(content);

          return {
            id: result.id,
            content,
            type: 'd',
            path: result.path || '',
            updated: result.updated || Date.now(),
            box: result.notebookId || '',
            parent_id: '',
            root_id: result.id,
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
            content: result.contentPreview || '',
            type: 'd',
            path: result.path || '',
            updated: result.updated || Date.now(),
            box: result.notebookId || '',
            parent_id: '',
            root_id: result.id,
            tags: [],
            title: result.title || '',
            relevanceScore: result.score || 0,
            denseScore: result.denseScore,
            sparseScore: result.sparseScore,
            excerpt: (result.contentPreview || '').substring(0, 200),
            vectorSearch: true
          };
        }
      })
    );

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
   * @param {string} [options.sql] - 自定义SQL查询条件
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
      let sqlQuery = `SELECT id, content, type, path, updated, box, parent_id, root_id FROM blocks WHERE content LIKE '%${query}%'`;
      
      if (notebookId) {
        sqlQuery += ` AND box = '${notebookId}'`;
      }
      
      if (parentId) {
        sqlQuery += ` AND (path LIKE '/${parentId}/%' OR root_id = '${parentId}')`;
      }
      
      if (type) {
        sqlQuery += ` AND type = '${type}'`;
      }
      
      if (types && Array.isArray(types) && types.length > 0) {
        sqlQuery += ` AND type IN ('${types.join("','")}')`;
      }
      
      if (sql) {
        sqlQuery += ` AND ${sql}`;
      }
      
      sqlQuery += ` LIMIT ${Math.min(limit, 100)}`;
      
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
   * 计算相关性分数
   * @param {string} content - 内容文本
   * @param {string} query - 搜索查询
   * @param {Array} tags - 标签数组
   * @returns {number} 相关性分数
   */
  calculateRelevanceScore(content, query, tags) {
    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    if (contentLower.includes(queryLower)) {
      score += 50;
    }

    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    queryWords.forEach(word => {
      if (contentLower.includes(word)) {
        score += 10;
      }
    });

    score += Math.min(content.length / 100, 20);
    score += tags.length * 5;

    if (content.startsWith('#')) {
      const headingLevel = content.match(/^#{1,6}/)?.[0]?.length || 0;
      if (headingLevel > 0) {
        score += (7 - headingLevel) * 8;
      }
    }

    return score;
  }

  /**
   * 合并和去重搜索结果
   * @param {Array} vectorResults - 向量搜索结果
   * @param {Array} sqlResults - SQL搜索结果
   * @param {number} limit - 结果限制
   * @param {number} denseWeight - 密集向量权重
   * @param {number} sparseWeight - 稀疏向量权重
   * @param {number} sqlWeight - SQL搜索权重
   * @returns {Array} 合并后的结果
   */
  mergeAndDeduplicateResults(vectorResults, sqlResults, limit, denseWeight = 0.7, sparseWeight = 0.3, sqlWeight = 0.0) {
    const resultMap = new Map();

    vectorResults.forEach(result => {
      const id = result.id;
      if (!resultMap.has(id)) {
        resultMap.set(id, {
          ...result,
          source: 'vector',
          sourceScore: result.relevanceScore || 0
        });
      } else {
        const existing = resultMap.get(id);
        if (result.relevanceScore > existing.relevanceScore) {
          resultMap.set(id, {
            ...result,
            source: 'vector',
            sourceScore: result.relevanceScore || 0
          });
        }
      }
    });

    sqlResults.forEach(result => {
      const id = result.id;
      if (!resultMap.has(id)) {
        resultMap.set(id, {
          ...result,
          source: 'sql',
          sourceScore: (result.relevanceScore || 0) * sqlWeight
        });
      } else {
        const existing = resultMap.get(id);
        if (existing.source === 'vector') {
          const combinedScore = existing.relevanceScore + (result.relevanceScore || 0) * sqlWeight;
          resultMap.set(id, {
            ...existing,
            relevanceScore: combinedScore,
            source: 'hybrid',
            sqlScore: result.relevanceScore || 0
          });
        }
      }
    });

    const allResults = Array.from(resultMap.values());
    
    const vectorResultsOnly = allResults.filter(r => r.source === 'vector' || r.source === 'hybrid');
    const sqlResultsOnly = allResults.filter(r => r.source === 'sql');
    
    const totalWeight = denseWeight + sparseWeight + sqlWeight;
    const vectorLimit = Math.floor(limit * (denseWeight + sparseWeight) / totalWeight);
    const sqlLimit = Math.floor(limit * sqlWeight / totalWeight);
    
    const sortedVectorResults = vectorResultsOnly
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, vectorLimit);
    
    const sortedSqlResults = sqlResultsOnly
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      .slice(0, sqlLimit);
    
    const selectedIds = new Set([
      ...sortedVectorResults.map(r => r.id),
      ...sortedSqlResults.map(r => r.id)
    ]);
    
    const mergedResults = allResults.filter(result => selectedIds.has(result.id));
    
    mergedResults.sort((a, b) => {
      const scoreA = a.relevanceScore || 0;
      const scoreB = b.relevanceScore || 0;
      return scoreB - scoreA;
    });

    return mergedResults.slice(0, limit);
  }
}

module.exports = SearchManager;
