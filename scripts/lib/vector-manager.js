/**
 * vector-manager.js - Qdrant 向量数据库交互共享模块
 *
 * 负责与 Qdrant 向量数据库交互，支持向量存储、搜索和混合检索
 * 使用 Node.js 原生 http 模块，零外部依赖
 */
'use strict';

const http = require('http');
const https = require('https');

/**
 * VectorManager 类
 * 管理 Qdrant 向量数据库的集合、向量存储和搜索
 */
class VectorManager {
  /**
   * 构造函数
   * @param {Object} config - 配置对象
   * @param {Object} config.qdrant - Qdrant 配置
   * @param {string} config.qdrant.url - Qdrant 服务地址 (默认: 'http://localhost:6333')
   * @param {string} config.qdrant.apiKey - API 密钥 (可选)
   * @param {string} config.qdrant.collectionName - 集合名称 (默认: 'siyuan_notes')
   * @param {Object} config.embedding - 嵌入配置
   * @param {number} config.embedding.dimension - 向量维度 (默认: 768)
   * @param {Object} config.hybridSearch - 混合搜索配置
   * @param {number} config.hybridSearch.denseWeight - 稠密向量权重 (默认: 0.7)
   * @param {number} config.hybridSearch.sparseWeight - 稀疏向量权重 (默认: 0.3)
   * @param {number} config.hybridSearch.limit - 搜索结果数量限制 (默认: 20)
   * @param {number} config.qdrant.timeout - 请求超时时间（毫秒，默认: 30000）
   */
  constructor(config = {}) {
    const qdrantConfig = config.qdrant || {};
    const embeddingConfig = config.embedding || {};
    const hybridConfig = config.hybridSearch || {};

    this.url = qdrantConfig.url || 'http://localhost:6333';
    this.apiKey = qdrantConfig.apiKey || '';
    this.collectionName = qdrantConfig.collectionName || 'siyuan_notes';
    this.dimension = embeddingConfig.dimension || 768;
    this.denseWeight = hybridConfig.denseWeight || 0.7;
    this.sparseWeight = hybridConfig.sparseWeight || 0.3;
    this.defaultLimit = hybridConfig.limit || 20;
    this.timeout = qdrantConfig.timeout || 30000;

    // 解析 URL
    this._parseUrl();
  }

  /**
   * 解析 URL
   * @private
   */
  _parseUrl() {
    try {
      const parsedUrl = new URL(this.url);
      this.protocol = parsedUrl.protocol;
      this.hostname = parsedUrl.hostname;
      this.port = parsedUrl.port || (this.protocol === 'https:' ? 443 : 6333);
    } catch (error) {
      throw new Error(`无效的 Qdrant URL: ${this.url}`);
    }
  }

  /**
   * 发送 HTTP 请求到 Qdrant
   * @private
   * @param {string} method - HTTP 方法 (GET, POST, PUT, DELETE)
   * @param {string} endpoint - API 端点
   * @param {Object} [data] - 请求数据 (可选)
   * @returns {Promise<any>} 响应数据
   */
  _makeRequest(method, endpoint, data) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        port: this.port,
        path: endpoint,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SiyuanVectorManager/1.0.0'
        },
        timeout: this.timeout
      };

      // 添加 API Key
      if (this.apiKey) {
        options.headers['api-key'] = this.apiKey;
      }

      // 处理 HTTPS
      let agent = null;
      if (this.protocol === 'https:') {
        agent = new https.Agent({
          rejectUnauthorized: true
        });
        options.agent = agent;
      }

      const req = (this.protocol === 'https:' ? https : http).request(options, (res) => {
        let responseData = '';
        const statusCode = res.statusCode;

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            if (!responseData) {
              if (statusCode >= 200 && statusCode < 300) {
                resolve(null);
              } else {
                reject(new Error(`Qdrant HTTP ${statusCode}: 空响应`));
              }
              return;
            }

            const parsedData = JSON.parse(responseData);

            if (statusCode >= 400) {
              const errorMsg = parsedData.error || parsedData.message ||
                parsedData.status?.error || `HTTP ${statusCode}`;
              reject(new Error(`Qdrant API 错误: ${errorMsg}`));
            } else {
              resolve(parsedData);
            }
          } catch (error) {
            reject(new Error(`Qdrant 响应解析失败: ${error.message}`));
          }
        });
      });

      // 超时处理
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Qdrant 请求超时 (${this.timeout}ms)`));
      });

      // 错误处理
      req.on('error', (error) => {
        reject(new Error(`Qdrant 连接失败: ${error.message}`));
      });

      // 发送请求数据
      if (data) {
        const postData = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(postData);
        req.write(postData);
      }

      req.end();
    });
  }

  /**
   * 确保 Qdrant 集合存在，不存在则创建
   * @returns {Promise<{success: boolean, created: boolean, message: string}>}
   */
  async ensureCollection() {
    try {
      // 检查集合是否存在
      const collectionInfo = await this._makeRequest(
        'GET',
        `/collections/${this.collectionName}`
      );

      if (collectionInfo && collectionInfo.result) {
        return {
          success: true,
          created: false,
          message: `集合 ${this.collectionName} 已存在`
        };
      }
    } catch (error) {
      // 集合不存在，继续创建
      if (!error.message.includes('404') && !error.message.includes('Not found')) {
        // 其他错误
        console.error('检查集合失败:', error.message);
      }
    }

    // 创建集合
    try {
      await this._makeRequest(
        'PUT',
        `/collections/${this.collectionName}`,
        {
          vectors: {
            size: this.dimension,
            distance: 'Cosine'
          }
        }
      );

      return {
        success: true,
        created: true,
        message: `集合 ${this.collectionName} 创建成功`
      };
    } catch (error) {
      return {
        success: false,
        created: false,
        message: `创建集合失败: ${error.message}`
      };
    }
  }

  /**
   * 批量插入/更新向量
   * @param {Array<{id: string, vector: number[], payload: Object}>} vectors - 向量数据数组
   * @returns {Promise<{success: boolean, count: number, message: string}>}
   */
  async upsertVectors(vectors) {
    if (!Array.isArray(vectors) || vectors.length === 0) {
      return {
        success: false,
        count: 0,
        message: '向量数据为空'
      };
    }

    try {
      // 转换为 Qdrant 格式
      const points = vectors.map(v => ({
        id: v.id,
        vector: v.vector,
        payload: v.payload || {}
      }));

      await this._makeRequest(
        'PUT',
        `/collections/${this.collectionName}/points`,
        {
          points: points,
          wait: true
        }
      );

      return {
        success: true,
        count: points.length,
        message: `成功插入/更新 ${points.length} 个向量`
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        message: `插入向量失败: ${error.message}`
      };
    }
  }

  /**
   * 向量相似度搜索
   * @param {number[]} queryVector - 查询向量
   * @param {number} [limit] - 返回结果数量限制
   * @param {number} [threshold] - 相似度阈值 (0-1)
   * @returns {Promise<Array<{id: string, score: number, payload: Object}>>}
   */
  async searchSimilar(queryVector, limit, threshold) {
    const searchLimit = limit || this.defaultLimit;
    const scoreThreshold = threshold || 0;

    if (!Array.isArray(queryVector) || queryVector.length === 0) {
      return [];
    }

    try {
      const response = await this._makeRequest(
        'POST',
        `/collections/${this.collectionName}/points/search`,
        {
          vector: queryVector,
          limit: searchLimit,
          score_threshold: scoreThreshold,
          with_payload: true
        }
      );

      if (response && response.result) {
        return response.result.map(item => ({
          id: item.id,
          score: item.score,
          payload: item.payload || {}
        }));
      }

      return [];
    } catch (error) {
      console.error('向量搜索失败:', error.message);
      return [];
    }
  }

  /**
   * 混合搜索 - 结合向量搜索和 Siyuan 原生搜索结果
   * @param {number[]} queryVector - 查询向量
   * @param {Array<{id: string, score: number, content?: string}>} siyuanResults - Siyuan 搜索结果
   * @param {number} [limit] - 返回结果数量限制
   * @returns {Promise<Array<{id: string, score: number, vectorScore: number, keywordScore: number, payload: Object}>>}
   */
  async hybridSearch(queryVector, siyuanResults, limit) {
    const searchLimit = limit || this.defaultLimit;

    // 执行向量搜索
    const vectorResults = await this.searchSimilar(queryVector, searchLimit * 2);

    // 构建结果映射
    const resultMap = new Map();

    // 处理向量搜索结果
    for (const item of vectorResults) {
      resultMap.set(item.id, {
        id: item.id,
        vectorScore: item.score,
        keywordScore: 0,
        payload: item.payload
      });
    }

    // 处理 Siyuan 搜索结果
    for (const item of siyuanResults || []) {
      const existing = resultMap.get(item.id);
      if (existing) {
        existing.keywordScore = item.score || 0.5;
      } else {
        resultMap.set(item.id, {
          id: item.id,
          vectorScore: 0,
          keywordScore: item.score || 0.5,
          payload: { id: item.id, content: item.content || '' }
        });
      }
    }

    // 计算混合分数并排序
    const combinedResults = Array.from(resultMap.values()).map(item => {
      // 归一化分数（假设 Siyuan 分数已经是 0-1 范围）
      const normalizedVectorScore = item.vectorScore;
      const normalizedKeywordScore = item.keywordScore;

      // 加权融合
      const hybridScore = (normalizedVectorScore * this.denseWeight) +
        (normalizedKeywordScore * this.sparseWeight);

      return {
        id: item.id,
        score: hybridScore,
        vectorScore: item.vectorScore,
        keywordScore: item.keywordScore,
        payload: item.payload
      };
    });

    // 按混合分数降序排序
    combinedResults.sort((a, b) => b.score - a.score);

    // 返回前 limit 个结果
    return combinedResults.slice(0, searchLimit);
  }

  /**
   * 删除指定笔记本的所有向量
   * @param {string} notebookId - 笔记本 ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deleteByNotebook(notebookId) {
    if (!notebookId) {
      return {
        success: false,
        message: '笔记本 ID 不能为空'
      };
    }

    try {
      await this._makeRequest(
        'POST',
        `/collections/${this.collectionName}/points/delete`,
        {
          filter: {
            must: [
              {
                key: 'notebookId',
                match: {
                  value: notebookId
                }
              }
            ]
          },
          wait: true
        }
      );

      return {
        success: true,
        message: `已删除笔记本 ${notebookId} 的所有向量`
      };
    } catch (error) {
      return {
        success: false,
        message: `删除笔记本向量失败: ${error.message}`
      };
    }
  }

  /**
   * 根据 ID 删除单个向量
   * @param {string} pointId - 向量点 ID
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async deleteById(pointId) {
    if (!pointId) {
      return {
        success: false,
        message: '向量 ID 不能为空'
      };
    }

    try {
      await this._makeRequest(
        'POST',
        `/collections/${this.collectionName}/points/delete`,
        {
          points: [pointId],
          wait: true
        }
      );

      return {
        success: true,
        message: `已删除向量 ${pointId}`
      };
    } catch (error) {
      return {
        success: false,
        message: `删除向量失败: ${error.message}`
      };
    }
  }

  /**
   * 批量删除向量
   * @param {string[]} pointIds - 向量点 ID 数组
   * @returns {Promise<{success: boolean, count: number, message: string}>}
   */
  async deleteByIds(pointIds) {
    if (!Array.isArray(pointIds) || pointIds.length === 0) {
      return {
        success: false,
        count: 0,
        message: '向量 ID 数组为空'
      };
    }

    try {
      await this._makeRequest(
        'POST',
        `/collections/${this.collectionName}/points/delete`,
        {
          points: pointIds,
          wait: true
        }
      );

      return {
        success: true,
        count: pointIds.length,
        message: `已删除 ${pointIds.length} 个向量`
      };
    } catch (error) {
      return {
        success: false,
        count: 0,
        message: `批量删除向量失败: ${error.message}`
      };
    }
  }

  /**
   * 获取集合信息
   * @returns {Promise<{success: boolean, info: Object|null, message: string}>}
   */
  async getCollectionInfo() {
    try {
      const response = await this._makeRequest(
        'GET',
        `/collections/${this.collectionName}`
      );

      if (response && response.result) {
        return {
          success: true,
          info: {
            name: this.collectionName,
            status: response.result.status,
            vectorsCount: response.result.vectors_count || 0,
            pointsCount: response.result.points_count || 0,
            dimension: response.result.config?.params?.vectors?.size || this.dimension,
            distance: response.result.config?.params?.vectors?.distance || 'Unknown'
          },
          message: '获取集合信息成功'
        };
      }

      return {
        success: false,
        info: null,
        message: '获取集合信息失败: 响应格式无效'
      };
    } catch (error) {
      return {
        success: false,
        info: null,
        message: `获取集合信息失败: ${error.message}`
      };
    }
  }

  /**
   * 测试 Qdrant 连接
   * @returns {Promise<boolean>} 连接是否成功
   */
  async testConnection() {
    try {
      const response = await this._makeRequest('GET', '/collections');
      if (response) {
        console.log(`Qdrant 连接成功，地址: ${this.url}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Qdrant 连接测试失败:', error.message);
      return false;
    }
  }

  /**
   * 获取配置信息
   * @returns {Object} 当前配置
   */
  getConfig() {
    return {
      url: this.url,
      collectionName: this.collectionName,
      dimension: this.dimension,
      denseWeight: this.denseWeight,
      sparseWeight: this.sparseWeight,
      defaultLimit: this.defaultLimit,
      timeout: this.timeout,
      hasApiKey: !!this.apiKey
    };
  }
}

module.exports = VectorManager;
