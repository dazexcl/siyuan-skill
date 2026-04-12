/**
 * Vector 管理器
 * 管理 Qdrant 向量数据库连接和搜索操作
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
      dimension: 768
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
   * 安全序列化 JSON，处理特殊字符
   * @param {Object} obj - 要序列化的对象
   * @returns {string} 安全的 JSON 字符串
   */
  safeStringify(obj) {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'string') {
        // 移除或替换可能导致问题的控制字符
        // eslint-disable-next-line no-control-regex
        return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
          // 处理未配对的代理对
          .replace(/[\uD800-\uDFFF]/g, char => {
            const code = char.charCodeAt(0);
            return `\\u${code.toString(16).padStart(4, '0')}`;
          });
      }
      return value;
    });
  }

  /**
   * 发送 HTTP 请求到 Qdrant API
   * @param {string} path - API 路径
   * @param {string} method - HTTP 方法
   * @param {Object} body - 请求体
   * @param {boolean} silentError - 是否静默处理错误（不打印日志）
   * @returns {Promise<Object>} 响应数据
   */
  async fetchAPI(path, method = 'GET', body = null, silentError = false) {
    const http = require('http');
    const https = require('https');
    const url = require('url');

    const parsedUrl = url.parse(this.qdrantConfig.url);
    const isHttps = parsedUrl.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 6333),
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (this.qdrantConfig.apiKey) {
      options.headers['api-key'] = this.qdrantConfig.apiKey;
    }

    return new Promise((resolve, reject) => {
      const req = lib.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsedData = JSON.parse(responseData || '{}');

            if (res.statusCode >= 400) {
              const errorMsg = parsedData.error || parsedData.message ||
                parsedData.status?.error || `HTTP ${res.statusCode}`;
              reject(new Error(`Qdrant API 错误: ${errorMsg}`));
            } else {
              resolve(parsedData);
            }
          } catch (error) {
            reject(new Error(`Qdrant 响应解析失败: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        if (!silentError) {

        }
        reject(error);
      });

      if (body) {
        req.write(this.safeStringify(body));
      }

      req.end();
    });
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
      // 获取集合列表，同时检查服务可访问性和集合是否存在
      const response = await this.fetchAPI('/collections');
      
      // Qdrant API 返回格式: { result: { collections: [...] } }
      const collections = response.result?.collections || response.collections || [];
      
      // 检查集合是否存在
      const collectionExists = collections.some(
        c => c.name === this.collectionName
      );
      
      if (!collectionExists) {
        try {
          await this.createCollection();
        } catch (createError) {
          // 如果创建失败是因为集合已存在（竞态条件），忽略错误
          if (createError.message.includes('already exists') || createError.message.includes('409')) {

          } else {
            throw createError;
          }
        }
      }

      this.initialized = true;
      return true;
    } catch (error) {

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
      }, true);

      await this.delay(300);

      let indexErrors = [];
      for (const [field, schema] of [
        ['block_id', 'keyword'],
        ['notebook_id', 'keyword'],
        ['updated', 'integer']
      ]) {
        try {
          await this.fetchAPI(`/collections/${this.collectionName}/indexes/${field}`, 'PUT', {
            field_name: field,
            field_schema: schema
          }, true);
        } catch (indexError) {
          if (!indexError.message.includes('404')) {
            indexErrors.push(`${field}: ${indexError.message}`);
          }
        }
      }

      if (indexErrors.length > 0) {

      }

      return true;
    } catch (error) {
      if (error.status === 409 || error.message.includes('already exists')) {
        return true;
      }
      throw error;
    }
  }

  /**
   * 确保 Qdrant 集合存在，不存在则创建
   * @returns {Promise<{success: boolean, created: boolean, message: string}>}
   */
  async ensureCollection() {
    try {
      // 检查集合是否存在
      const collections = await this.fetchAPI('/collections');
      const collectionExists = (collections.result?.collections || collections.collections || [])
        .some(c => c.name === this.collectionName);
      
      if (collectionExists) {
        return {
          success: true,
          created: false,
          message: `集合 ${this.collectionName} 已存在`
        };
      }

      // 创建集合
      await this.createCollection();
      
      return {
        success: true,
        created: true,
        message: `集合 ${this.collectionName} 创建成功`
      };
    } catch (error) {
      return {
        success: false,
        created: false,
        message: `确保集合存在失败: ${error.message}`
      };
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

    const pointId = this.generateUUIDFromId(docId);
    const point = {
      id: pointId,
      vector: {
        dense: denseVector,
        sparse: sparseVector
      },
      payload: {
        id: docId,
        block_id: metadata.originalDocId || (metadata.isChunk ? docId.replace(/_chunk_\d+$/, '') : docId),
        notebook_id: metadata.notebookId || '',
        title: metadata.title || '',
        path: metadata.path || '',
        content_preview: content.substring(0, 500),
        updated: metadata.updated || Date.now(),
        tags: metadata.tags || [],
        is_chunk: metadata.isChunk || false,
        chunk_index: metadata.chunkIndex,
        total_chunks: metadata.totalChunks
      }
    };

    try {
      await this.fetchAPI(`/collections/${this.collectionName}/points?wait=true`, 'PUT', {
        points: [point]
      });

      return {
        success: true,
        docId,
        pointId,
        vectorSize: denseVector.length
      };
    } catch (error) {

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

    try {
      const points = await Promise.all(
        documents.map(async (doc) => {
          const denseVector = await this.embeddingManager.generateEmbedding(doc.content);
          const sparseVector = this.embeddingManager.generateSparseVector(doc.content);
          const pointId = this.generateUUIDFromId(doc.docId);

          return {
            id: pointId,
            vector: {
              dense: denseVector,
              sparse: sparseVector
            },
            payload: {
              id: doc.docId,
              block_id: doc.metadata?.original_doc_id || (doc.metadata?.is_chunk ? doc.docId.replace(/_chunk_\d+$/, '') : doc.docId),
              notebook_id: doc.metadata?.notebookId || doc.metadata?.notebook_id || '',
              title: doc.metadata?.title || '',
              path: doc.metadata?.path || '',
              content_preview: doc.content.substring(0, 500),
              updated: doc.metadata?.updated || Date.now(),
              tags: doc.metadata?.tags || [],
              is_chunk: doc.metadata?.is_chunk || false,
              chunk_index: doc.metadata?.chunk_index,
              total_chunks: doc.metadata?.total_chunks
            }
          };
        })
      );

      await this.fetchAPI(`/collections/${this.collectionName}/points?wait=true`, 'PUT', {
        points: points
      });

      return {
        success: true,
        indexed: documents.length,
        total: documents.length
      };
    } catch (error) {
      return {
        success: false,
        indexed: 0,
        total: documents.length,
        message: error.message
      };
    }
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

      let sparseResultPoints = [];
      if (querySparseVector.indices && querySparseVector.indices.length > 0) {
        const sparseSearchOptions = {
          query: {
            indices: querySparseVector.indices,
            values: querySparseVector.values
          },
          using: 'sparse',
          limit,
          with_payload: true
        };

        if (filter) {
          sparseSearchOptions.filter = this.buildFilter(filter);
        }

        const sparseResponse = await this.fetchAPI(`/collections/${this.collectionName}/points/query`, 'POST', sparseSearchOptions);
        if (sparseResponse.result?.points && Array.isArray(sparseResponse.result.points)) {
          sparseResultPoints = sparseResponse.result.points;
        } else if (Array.isArray(sparseResponse.result)) {
          sparseResultPoints = sparseResponse.result;
        } else if (sparseResponse.points && Array.isArray(sparseResponse.points)) {
          sparseResultPoints = sparseResponse.points;
        }
      }

      const mergedResults = this.mergeSearchResults(
        denseResults.result || [],
        sparseResultPoints,
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
          id: r.payload.id,
          score: 1 - r.score,
          distance: r.score,
          denseScore: 1 - r.score,
          title: r.payload.title,
          path: r.payload.path,
          notebookId: r.payload.notebook_id,
          contentPreview: r.payload.content_preview,
          updated: r.payload.updated,
          tags: r.payload.tags,
          blockId: r.payload.block_id,
          isChunk: r.payload.is_chunk,
          chunkIndex: r.payload.chunk_index,
          totalChunks: r.payload.total_chunks
        })),
        total: results.result.length
      };
    } catch (error) {

      throw error;
    }
  }

  /**
   * 关键词搜索（仅 Sparse Vector）
   * 使用 Qdrant Query API 进行稀疏向量搜索
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

    if (!querySparseVector.indices || querySparseVector.indices.length === 0) {
      return {
        query,
        mode: 'keyword',
        results: [],
        total: 0
      };
    }

    try {
      const searchOptions = {
        query: {
          indices: querySparseVector.indices,
          values: querySparseVector.values
        },
        using: 'sparse',
        limit,
        with_payload: true
      };

      if (filter) {
        searchOptions.filter = this.buildFilter(filter);
      }

      const response = await this.fetchAPI(`/collections/${this.collectionName}/points/query`, 'POST', searchOptions);

      let resultPoints = [];
      if (response.result?.points && Array.isArray(response.result.points)) {
        resultPoints = response.result.points;
      } else if (Array.isArray(response.result)) {
        resultPoints = response.result;
      } else if (response.points && Array.isArray(response.points)) {
        resultPoints = response.points;
      }

      return {
        query,
        mode: 'keyword',
        results: resultPoints.map(r => ({
          id: r.payload?.id || r.payload?.block_id || r.id,
          score: r.score,
          sparseScore: r.score,
          title: r.payload?.title || '',
          path: r.payload?.path || '',
          notebookId: r.payload?.notebook_id || '',
          contentPreview: r.payload?.content_preview || '',
          updated: r.payload?.updated || 0,
          tags: r.payload?.tags || [],
          blockId: r.payload?.block_id,
          isChunk: r.payload?.is_chunk,
          chunkIndex: r.payload?.chunk_index,
          totalChunks: r.payload?.total_chunks
        })),
        total: resultPoints.length
      };
    } catch (error) {

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
      const docId = result.payload.block_id;
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
      const docId = result.payload.block_id;
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
        id: item.payload.id || item.id,
        score: item.rrfScore,
        denseScore: item.denseScore,
        sparseScore: item.sparseScore,
        title: item.payload.title,
        path: item.payload.path,
        notebookId: item.payload.notebook_id,
        contentPreview: item.payload.content_preview,
        updated: item.payload.updated,
        tags: item.payload.tags,
        blockId: item.payload.block_id,
        isChunk: item.payload.is_chunk,
        chunkIndex: item.payload.chunk_index,
        totalChunks: item.payload.total_chunks
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
      const pointId = this.generateUUIDFromId(docId);
      await this.fetchAPI(`/collections/${this.collectionName}/points/delete?wait=true`, 'POST', {
        points: [pointId]
      });
      return true;
    } catch (error) {

      return false;
    }
  }

  /**
   * 删除指定文档及其所有分块的索引
   * @param {Array<string>} docIds - 原始文档 ID 数组
   * @returns {Promise<boolean>}
   */
  async deleteDocumentsWithChunks(docIds) {
    if (!this.isReady()) {
      await this.initialize();
    }

    if (!docIds || docIds.length === 0) {
      return true;
    }

    try {
      const conditions = [];
      
      for (const docId of docIds) {
        conditions.push({
          key: 'block_id',
          match: { value: docId }
        });
        conditions.push({
          key: 'original_doc_id',
          match: { value: docId }
        });
      }

      await this.fetchAPI(`/collections/${this.collectionName}/points/delete?wait=true`, 'POST', {
        filter: {
          should: conditions
        }
      });

      return true;
    } catch (error) {

      return false;
    }
  }

  /**
   * 生成 UUID v4
   * @returns {string} UUID 字符串
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * 基于字符串生成稳定的 UUID v5（使用命名空间）
   * @param {string} str - 输入字符串
   * @returns {string} UUID 字符串
   */
  generateUUIDFromId(str) {
    function hashString(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash);
    }

    const hash = hashString(str);
    const hex = hash.toString(16).padStart(32, '0');
    
    return [
      hex.substring(0, 8),
      hex.substring(8, 12),
      '4' + hex.substring(13, 16),
      (8 + (parseInt(hex.substring(16, 17), 16) & 3)).toString(16) + hex.substring(17, 20),
      hex.substring(20, 32)
    ].join('-');
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

      return null;
    }
  }

  /**
   * 获取已索引文档的更新时间
   * @param {Array} docIds - 文档 ID 数组
   * @returns {Promise<Map<string, number>>} 文档ID -> 更新时间的映射
   */
  async getIndexedDocumentsUpdateTime(docIds) {
    if (!this.isReady()) {
      await this.initialize();
    }

    const updateTimes = new Map();
    
    if (!docIds || docIds.length === 0) {
      return updateTimes;
    }

    try {
      for (const docId of docIds) {
        const result = await this.fetchAPI(`/collections/${this.collectionName}/points/scroll`, 'POST', {
          limit: 1,
          with_payload: true,
          filter: {
            should: [
              {
                key: 'block_id',
                match: { value: docId }
              },
              {
                key: 'original_doc_id',
                match: { value: docId }
              }
            ]
          }
        });

        if (result.result?.points?.length > 0) {
          const point = result.result.points[0];
          updateTimes.set(docId, point.payload?.updated || 0);
        }
      }
    } catch (error) {

    }

    return updateTimes;
  }

  async getIndexedOriginalDocIds(options = {}) {
    if (!this.isReady()) {
      await this.initialize();
    }

    const { notebookId } = options;
    const docIds = new Set();
    let hasMore = true;
    let nextPageOffset = null;

    try {
      while (hasMore) {
        const requestBody = {
          limit: 100,
          with_payload: true
        };

        if (nextPageOffset) {
          requestBody.offset = nextPageOffset;
        }

        const filterConditions = [];

        if (notebookId) {
          filterConditions.push({
            key: 'notebook_id',
            match: { value: notebookId }
          });
        }

        if (filterConditions.length > 0) {
          requestBody.filter = {
            must: filterConditions
          };
        }

        const result = await this.fetchAPI(
          `/collections/${this.collectionName}/points/scroll`,
          'POST',
          requestBody
        );

        if (result.result?.points?.length > 0) {
          for (const point of result.result.points) {
            const originalDocId = point.payload?.original_doc_id || point.payload?.block_id;
            if (originalDocId && !originalDocId.includes('_chunk_')) {
              docIds.add(originalDocId);
            }
          }
          
          nextPageOffset = result.result.next_page_offset;
          hasMore = !!nextPageOffset && result.result.points.length === 100;
        } else {
          hasMore = false;
        }
      }
    } catch (error) {

    }

    return docIds;
  }

  /**
   * 删除指定笔记本的所有索引
   * @param {string} notebookId - 笔记本 ID
   * @returns {Promise<boolean>}
   */
  async deleteNotebookDocuments(notebookId) {
    if (!this.isReady()) {
      await this.initialize();
    }

    try {
      await this.fetchAPI(`/collections/${this.collectionName}/points/delete?wait=true`, 'POST', {
        filter: {
          must: [
            {
              key: 'notebook_id',
              match: { value: notebookId }
            }
          ]
        }
      });
      return true;
    } catch (error) {

      return false;
    }
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 清空集合
   * @returns {Promise<boolean>}
   */
  async clearCollection() {
    try {
      await this.fetchAPI(`/collections/${this.collectionName}`, 'DELETE');
      
    } catch (error) {
      if (!error.message.includes('404') && !error.message.includes('Not Found')) {
        
      }
    }

    this.initialized = false;

    await this.delay(500);

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.createCollection();
        this.initialized = true;

        return true;
      } catch (error) {

        if (attempt < maxRetries) {
          await this.delay(1000 * attempt);
        } else {

          return false;
        }
      }
    }
    return false;
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
