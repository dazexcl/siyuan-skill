/**
 * Vector 管理器
 * 管理 Qdrant 向量数据库连接和搜索操作
 * 使用内置 fetch API 代替 @qdrant/js-client-rest 依赖
 */

/**
 * VectorManager 类
 * 管理 Qdrant 向量数据库的连接、索引和搜索
 */
class VectorManager {
  /**
   * 构造函数
   * @param {Object} config - 配置对象
   * @param {Object} embeddingManager - Embedding 管理器实例
   */
  constructor(config = {}, embeddingManager = null) {
    this.qdrantConfig = config.qdrant || {
      url: null,
      apiKey: '',
      collectionName: 'siyuan_notes'
    };
    this.embeddingConfig = config.embedding || {
      model: 'nomic-embed-text',
      dimension: 768,
      batchSize: 8
    };
    this.hybridConfig = config.hybridSearch || {
      denseWeight: 0.7,
      sparseWeight: 0.3,
      limit: 20
    };
    this.embeddingManager = embeddingManager;
    this.initialized = false;
    this.collectionName = this.qdrantConfig.collectionName;
  }

  /**
   * 获取配置信息
   * @returns {Object} 配置对象
   */
  getConfig() {
    return {
      qdrant: { ...this.qdrantConfig },
      embedding: { ...this.embeddingConfig },
      hybridSearch: { ...this.hybridConfig }
    };
  }

  /**
   * 发送 HTTP 请求到 Qdrant API
   * @param {string} path - API 路径
   * @param {string} method - HTTP 方法
   * @param {Object} body - 请求体
   * @returns {Promise<Object>} 响应数据
   */
  async fetchAPI(path, method = 'GET', body = null) {
    const url = `${this.qdrantConfig.url}${path}`;
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.qdrantConfig.apiKey) {
      headers['api-key'] = this.qdrantConfig.apiKey;
    }

    try {
      const options = {
        method,
        headers
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Qdrant API 错误: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Qdrant API 请求失败:', error.message);
      throw error;
    }
  }

  /**
   * 初始化 Qdrant 连接
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // 检查服务是否可访问
      await this.fetchAPI('/collections');
      
      const collectionExists = await this.checkCollectionExists();
      if (!collectionExists) {
        await this.createCollection();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.warn('Qdrant 集合已存在，继续使用现有集合');
        this.initialized = true;
        return true;
      }
      
      console.error('Qdrant 连接失败:', error.message);
      this.initialized = false;
      return false;
    }
  }

  /**
   * 检查集合是否存在
   * @returns {Promise<boolean>}
   */
  async checkCollectionExists() {
    try {
      const collections = await this.fetchAPI('/collections');
      return collections.collections.some(
        c => c.name === this.collectionName
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * 创建向量集合
   * @returns {Promise<boolean>}
   */
  async createCollection() {
    try {
      await this.fetchAPI(`/collections/${this.collectionName}`, 'PUT', {
        vectors: {
          dense: {
            size: this.embeddingConfig.dimension,
            distance: 'Cosine'
          }
        },
        sparse_vectors: {
          sparse: {}
        }
      });

      // 创建 payload 索引
      await Promise.all([
        this.fetchAPI(`/collections/${this.collectionName}/indexes/doc_id`, 'PUT', {
          field_name: 'doc_id',
          field_schema: 'keyword'
        }),
        this.fetchAPI(`/collections/${this.collectionName}/indexes/notebook_id`, 'PUT', {
          field_name: 'notebook_id',
          field_schema: 'keyword'
        }),
        this.fetchAPI(`/collections/${this.collectionName}/indexes/updated`, 'PUT', {
          field_name: 'updated',
          field_schema: 'integer'
        })
      ]);

      return true;
    } catch (error) {
      console.error('创建集合失败:', error.message);
      throw error;
    }
  }

  /**
   * 检查是否已初始化
   * @returns {boolean}
   */
  isReady() {
    return this.initialized;
  }

  /**
   * 索引单个文档
   * @param {string} docId - 文档 ID
   * @param {string} content - 文档内容
   * @param {Object} metadata - 元数据
   * @returns {Promise<Object>} 索引结果
   */
  async indexDocument(docId, content, metadata = {}) {
    if (!this.isReady()) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Qdrant 未初始化');
      }
    }

    if (!this.embeddingManager || !this.embeddingManager.isReady()) {
      throw new Error('Embedding 管理器未初始化');
    }

    const denseVector = await this.embeddingManager.generateEmbedding(content);
    const sparseVector = this.embeddingManager.generateSparseVector(content);

    const point = {
      id: docId,
      vector: {
        dense: denseVector,
        sparse: sparseVector
      },
      payload: {
        doc_id: docId,
        notebook_id: metadata.notebookId || '',
        title: metadata.title || '',
        path: metadata.path || '',
        content_preview: content.substring(0, 500),
        updated: metadata.updated || Date.now(),
        tags: metadata.tags || [],
        entities: metadata.entities || []
      }
    };

    try {
      await this.fetchAPI(`/collections/${this.collectionName}/points?wait=true`, 'PUT', {
        points: [point]
      });

      return {
        success: true,
        docId,
        vectorSize: denseVector.length
      };
    } catch (error) {
      console.error('索引文档失败:', error.message);
      throw error;
    }
  }

  /**
   * 批量索引文档
   * @param {Array} documents - 文档数组 [{docId, content, metadata}]
   * @returns {Promise<Object>} 索引结果
   */
  async indexBatch(documents) {
    if (!Array.isArray(documents) || documents.length === 0) {
      return { success: true, indexed: 0 };
    }

    if (!this.isReady()) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Qdrant 未初始化');
      }
    }

    const batchSize = this.embeddingConfig.batchSize || 8;
    let indexed = 0;
    const errors = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      try {
        const points = await Promise.all(
          batch.map(async (doc) => {
            const denseVector = await this.embeddingManager.generateEmbedding(doc.content);
            const sparseVector = this.embeddingManager.generateSparseVector(doc.content);

            // 转换 Siyuan Notes 文档 ID 为 Qdrant 可接受的格式（使用哈希函数）
            function hashStringToUint(str) {
              let hash = 0;
              for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为 32 位无符号整数
              }
              return Math.abs(hash);
            }

            return {
              id: hashStringToUint(doc.docId),
              vector: {
                dense: denseVector,
                sparse: sparseVector
              },
              payload: {
                doc_id: doc.docId,
                notebook_id: doc.metadata?.notebookId || '',
                title: doc.metadata?.title || '',
                path: doc.metadata?.path || '',
                content_preview: doc.content.substring(0, 500),
                updated: doc.metadata?.updated || Date.now(),
                tags: doc.metadata?.tags || [],
                entities: doc.metadata?.entities || []
              }
            };
          })
        );

        await this.fetchAPI(`/collections/${this.collectionName}/points?wait=true`, 'PUT', {
          points: points
        });

        indexed += batch.length;
      } catch (error) {
        console.error(`批次 ${Math.floor(i / batchSize) + 1} 索引失败:`, error.message);
        errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error.message
        });
      }
    }

    return {
      success: errors.length === 0,
      indexed,
      total: documents.length,
      errors
    };
  }

  /**
   * 混合搜索（Dense + Sparse）
   * @param {string} query - 查询文本
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async hybridSearch(query, options = {}) {
    if (!this.isReady()) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Qdrant 未初始化');
      }
    }

    const {
      denseWeight = this.hybridConfig.denseWeight,
      sparseWeight = this.hybridConfig.sparseWeight,
      limit = this.hybridConfig.limit,
      threshold = 0.0,
      filter = null
    } = options;

    const queryDenseVector = await this.embeddingManager.generateEmbedding(query);
    const querySparseVector = this.embeddingManager.generateSparseVector(query);

    try {
      // 执行 dense 搜索
      const denseSearchOptions = {
        vector: {
          name: 'dense',
          vector: queryDenseVector
        },
        limit,
        with_payload: true,
        score_threshold: threshold > 0 ? threshold : undefined
      };

      if (filter) {
        denseSearchOptions.filter = this.buildFilter(filter);
      }

      const denseResults = await this.fetchAPI(`/collections/${this.collectionName}/points/search`, 'POST', denseSearchOptions);

      // 执行 sparse 搜索
      const sparseSearchOptions = {
        vector: {
          name: 'sparse',
          vector: querySparseVector
        },
        limit,
        with_payload: true
      };

      if (filter) {
        sparseSearchOptions.filter = this.buildFilter(filter);
      }

      const sparseResults = await this.fetchAPI(`/collections/${this.collectionName}/points/search`, 'POST', sparseSearchOptions);

      const mergedResults = this.mergeSearchResults(
        denseResults.result,
        sparseResults.result,
        denseWeight,
        sparseWeight
      );

      return {
        query,
        mode: 'hybrid',
        results: mergedResults.slice(0, limit),
        total: mergedResults.length,
        denseWeight,
        sparseWeight
      };
    } catch (error) {
      console.error('混合搜索失败:', error.message);
      throw error;
    }
  }

  /**
   * 语义搜索（仅 Dense Vector）
   * @param {string} query - 查询文本
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async semanticSearch(query, options = {}) {
    if (!this.isReady()) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Qdrant 未初始化');
      }
    }

    const { limit = this.hybridConfig.limit, threshold = 0.0, filter = null } = options;

    const queryVector = await this.embeddingManager.generateEmbedding(query);

    try {
      const searchOptions = {
        vector: {
          name: 'dense',
          vector: queryVector
        },
        limit,
        with_payload: true,
        score_threshold: threshold > 0 ? threshold : undefined
      };

      if (filter) {
        searchOptions.filter = this.buildFilter(filter);
      }

      const results = await this.fetchAPI(`/collections/${this.collectionName}/points/search`, 'POST', searchOptions);

      return {
        query,
        mode: 'semantic',
        results: results.result.map(r => ({
          id: r.payload.doc_id,
          score: r.score,
          title: r.payload.title,
          path: r.payload.path,
          notebookId: r.payload.notebook_id,
          contentPreview: r.payload.content_preview,
          updated: r.payload.updated,
          tags: r.payload.tags,
          entities: r.payload.entities
        })),
        total: results.result.length
      };
    } catch (error) {
      console.error('语义搜索失败:', error.message);
      throw error;
    }
  }

  /**
   * 关键词搜索（仅 Sparse Vector）
   * @param {string} query - 查询文本
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async keywordSearch(query, options = {}) {
    if (!this.isReady()) {
      const success = await this.initialize();
      if (!success) {
        throw new Error('Qdrant 未初始化');
      }
    }

    const { limit = this.hybridConfig.limit, filter = null } = options;

    const querySparseVector = this.embeddingManager.generateSparseVector(query);

    try {
      const searchOptions = {
        vector: {
          name: 'sparse',
          vector: querySparseVector
        },
        limit,
        with_payload: true
      };

      if (filter) {
        searchOptions.filter = this.buildFilter(filter);
      }

      const results = await this.fetchAPI(`/collections/${this.collectionName}/points/search`, 'POST', searchOptions);

      return {
        query,
        mode: 'keyword',
        results: results.result.map(r => ({
          id: r.payload.doc_id,
          score: r.score,
          title: r.payload.title,
          path: r.payload.path,
          notebookId: r.payload.notebook_id,
          contentPreview: r.payload.content_preview,
          updated: r.payload.updated,
          tags: r.payload.tags,
          entities: r.payload.entities
        })),
        total: results.result.length
      };
    } catch (error) {
      console.error('关键词搜索失败:', error.message);
      throw error;
    }
  }

  /**
   * 合并搜索结果（使用 RRF 算法）
   * @param {Array} denseResults - Dense 搜索结果
   * @param {Array} sparseResults - Sparse 搜索结果
   * @param {number} denseWeight - Dense 权重
   * @param {number} sparseWeight - Sparse 权重
   * @returns {Array} 合并后的结果
   */
  mergeSearchResults(denseResults, sparseResults, denseWeight, sparseWeight) {
    const k = 60;
    const scores = new Map();

    denseResults.forEach((result, index) => {
      const docId = result.payload.doc_id;
      const rrfScore = denseWeight / (k + index + 1);
      
      if (!scores.has(docId)) {
        scores.set(docId, {
          id: docId,
          denseScore: result.score,
          sparseScore: 0,
          rrfScore: 0,
          payload: result.payload
        });
      }
      scores.get(docId).rrfScore += rrfScore;
    });

    sparseResults.forEach((result, index) => {
      const docId = result.payload.doc_id;
      const rrfScore = sparseWeight / (k + index + 1);
      
      if (!scores.has(docId)) {
        scores.set(docId, {
          id: docId,
          denseScore: 0,
          sparseScore: result.score,
          rrfScore: 0,
          payload: result.payload
        });
      }
      const existing = scores.get(docId);
      existing.sparseScore = result.score;
      existing.rrfScore += rrfScore;
    });

    const merged = Array.from(scores.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .map(item => ({
        id: item.id,
        score: item.rrfScore,
        denseScore: item.denseScore,
        sparseScore: item.sparseScore,
        title: item.payload.title,
        path: item.payload.path,
        notebookId: item.payload.notebook_id,
        contentPreview: item.payload.content_preview,
        updated: item.payload.updated,
        tags: item.payload.tags,
        entities: item.payload.entities
      }));

    return merged;
  }

  /**
   * 构建过滤条件
   * @param {Object} filter - 过滤条件
   * @returns {Object} Qdrant 过滤条件
   */
  buildFilter(filter) {
    const conditions = [];

    if (filter.notebookId) {
      conditions.push({
        key: 'notebook_id',
        match: { value: filter.notebookId }
      });
    }

    if (filter.notebookIds && Array.isArray(filter.notebookIds)) {
      conditions.push({
        key: 'notebook_id',
        match: { any: filter.notebookIds }
      });
    }

    if (filter.tags && Array.isArray(filter.tags)) {
      conditions.push({
        key: 'tags',
        match: { any: filter.tags }
      });
    }

    if (filter.updatedAfter) {
      conditions.push({
        key: 'updated',
        range: { gte: filter.updatedAfter }
      });
    }

    if (conditions.length === 0) {
      return undefined;
    }

    return {
      must: conditions
    };
  }

  /**
   * 删除文档索引
   * @param {string} docId - 文档 ID
   * @returns {Promise<boolean>}
   */
  async deleteDocument(docId) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      await this.fetchAPI(`/collections/${this.collectionName}/points/delete?wait=true`, 'POST', {
        points: [docId]
      });
      return true;
    } catch (error) {
      console.error('删除文档索引失败:', error.message);
      return false;
    }
  }

  /**
   * 获取集合统计信息
   * @returns {Promise<Object>}
   */
  async getCollectionStats() {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      const info = await this.fetchAPI(`/collections/${this.collectionName}`);
      return {
        name: this.collectionName,
        vectorsCount: info.result.points_count || 0,
        indexedVectorsCount: info.result.indexed_vectors_count || 0,
        segmentsCount: info.result.segments_count || 0,
        status: info.result.status || 'unknown'
      };
    } catch (error) {
      console.error('获取集合统计失败:', error.message);
      return null;
    }
  }

  /**
   * 清空集合
   * @returns {Promise<boolean>}
   */
  async clearCollection() {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      await this.fetchAPI(`/collections/${this.collectionName}`, 'DELETE');
      await this.createCollection();
      return true;
    } catch (error) {
      console.error('清空集合失败:', error.message);
      return false;
    }
  }

  /**
   * 设置 Embedding 管理器
   * @param {Object} manager - Embedding 管理器实例
   */
  setEmbeddingManager(manager) {
    this.embeddingManager = manager;
  }
}

module.exports = VectorManager;