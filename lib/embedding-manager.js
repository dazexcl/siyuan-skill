/**
 * Embedding 管理器
 * 使用 Ollama API 生成文本向量嵌入
 * 支持本地 Ollama 服务
 */

const https = require('https');
const http = require('http');
const ChineseTokenizer = require('./chinese-tokenizer');

/**
 * EmbeddingManager 类
 * 管理文本向量嵌入的生成（使用 Ollama）
 */
class EmbeddingManager {
  /**
   * 构造函数
   * @param {Object} config - 配置对象
   * @param {string} config.model - 模型名称（默认：nomic-embed-text）
   * @param {number} config.dimension - 向量维度
   * @param {string} config.baseUrl - Ollama 服务地址
   * @param {number} config.maxContentLength - 最大内容长度（触发分块阈值）
   * @param {number} config.maxChunkLength - 每个块的最大长度
   * @param {number} config.minChunkLength - 每个块的最小长度
   */
  constructor(config = {}) {
    this.model = config.model || 'nomic-embed-text';
    this.dimension = config.dimension || 768;
    this.baseUrl = config.baseUrl || null;
    this.maxContentLength = config.maxContentLength || 1000;
    this.maxChunkLength = config.maxChunkLength || 800;
    this.minChunkLength = config.minChunkLength || 200;
    this.initialized = false;
    this.modelInfo = null;
    this.tokenizer = new ChineseTokenizer();
  }

  /**
   * 初始化 Embedding（检查 Ollama 连接）
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.initialized) {
      return true;
    }

    try {
      // 检查 Ollama 服务是否可用
      const available = await this.checkConnection();
      if (!available) {
        throw new Error('无法连接到 Ollama 服务');
      }

      // 获取模型信息
      await this.fetchModelInfo();
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Ollama 初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 检查 Ollama 连接
   * @returns {Promise<boolean>}
   */
  async checkConnection() {
    try {
      // 使用 GET 请求检查服务
      const response = await this.request('/api/tags', null, 'GET');
      return response && Array.isArray(response.models);
    } catch (error) {
      console.warn('Ollama 连接检查失败:', error.message);
      return false;
    }
  }

  /**
   * 获取模型信息
   * @returns {Promise<Object>}
   */
  async fetchModelInfo() {
    try {
      const response = await this.request('/api/show', {
        name: this.model
      });
      
      this.modelInfo = {
        name: this.model,
        dimension: response.model?.details?.parameter_size || 'unknown',
        format: response.model?.details?.format || 'unknown'
      };
      
      return this.modelInfo;
    } catch (error) {
      this.modelInfo = { name: this.model };
      return this.modelInfo;
    }
  }

  /**
   * 发送 HTTP 请求到 Ollama
   * @param {string} endpoint - API 端点
   * @param {Object|null} data - 请求数据
   * @param {string} method - HTTP 方法
   * @returns {Promise<Object>}
   */
  async request(endpoint, data = null, method = 'POST') {
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      const req = lib.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            if (!responseData) {
              resolve({});
              return;
            }
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } catch (error) {
            console.error('响应数据:', responseData.substring(0, 200));
            reject(new Error(`JSON 解析失败：${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`请求失败：${error.message}`));
      });

      req.setTimeout(60000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      if (data && method === 'POST') {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * 检查是否已初始化
   * @returns {boolean}
   */
  isReady() {
    return this.initialized;
  }

  /**
   * 生成单个文本的向量嵌入
   * @param {string} text - 输入文本
   * @returns {Promise<number[]>} 向量数组
   */
  async generateEmbedding(text) {
    if (!this.isReady()) {
      await this.initialize();
    }

    if (!text || typeof text !== 'string') {
      throw new Error('输入文本不能为空');
    }

    // 截断过长的文本
    const maxTextLength = this.maxChunkLength;
    let processedText = text;
    if (text.length > maxTextLength) {
      processedText = text.substring(0, maxTextLength);
      console.warn(`文本过长 (${text.length} 字符)，已截断到 ${maxTextLength} 字符`);
    }

    try {
      // 首先尝试新版 API (/api/embed)
      let response = await this.request('/api/embed', {
        model: this.model,
        input: processedText
      });

      // 新版 API 返回 embeddings 数组
      if (response && response.embeddings && response.embeddings.length > 0) {
        const embedding = response.embeddings[0];
        if (this.dimension && embedding.length !== this.dimension) {
          console.warn(`向量维度不匹配：期望 ${this.dimension}, 实际 ${embedding.length}`);
        }
        return embedding;
      }

      // 回退到旧版 API (/api/embeddings)
      response = await this.request('/api/embeddings', {
        model: this.model,
        prompt: processedText
      });

      if (!response || !response.embedding) {
        console.error('Ollama 响应:', JSON.stringify(response).substring(0, 500));
        throw new Error('Ollama 返回的 embedding 为空');
      }

      const embedding = response.embedding;
      
      if (this.dimension && embedding.length !== this.dimension) {
        console.warn(`向量维度不匹配：期望 ${this.dimension}, 实际 ${embedding.length}`);
      }
      
      return embedding;
    } catch (error) {
      console.error('生成向量失败:', error.message);
      throw error;
    }
  }

  /**
   * 批量生成向量嵌入
   * @param {string[]} texts - 文本数组
   * @returns {Promise<number[][]>} 向量数组
   */
  async generateBatchEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    if (!this.isReady()) {
      await this.initialize();
    }

    const results = [];
    const batchSize = 8;
    const batches = this.createBatches(texts, batchSize);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchResults = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      
      results.push(...batchResults);
    }
    return results;
  }

  /**
   * 生成稀疏向量
   * @param {string} text - 输入文本
   * @returns {Object} 稀疏向量 { indices: number[], values: number[] }
   */
  generateSparseVector(text) {
    if (!text || typeof text !== 'string') {
      return { indices: [], values: [] };
    }

    const tokens = this.tokenize(text);
    const termFreq = new Map();
    
    tokens.forEach(token => {
      const lowerToken = token.toLowerCase();
      termFreq.set(lowerToken, (termFreq.get(lowerToken) || 0) + 1);
    });

    const indexValueMap = new Map();
    
    termFreq.forEach((freq, term) => {
      const hashIndex = this.hashTerm(term);
      if (indexValueMap.has(hashIndex)) {
        indexValueMap.set(hashIndex, indexValueMap.get(hashIndex) + freq);
      } else {
        indexValueMap.set(hashIndex, freq);
      }
    });

    const sortedEntries = Array.from(indexValueMap.entries()).sort((a, b) => a[0] - b[0]);
    const indices = sortedEntries.map(([idx]) => idx);
    const values = sortedEntries.map(([, val]) => val);

    return { indices, values };
  }

  /**
   * 文本预处理
   * @param {string} text - 原始文本
   * @returns {string} 处理后的文本
   */
  preprocessText(text) {
    let processed = text;
    
    processed = processed.replace(/```[\s\S]*?```/g, ' ');
    processed = processed.replace(/`[^`]+`/g, ' ');
    processed = processed.replace(/#{1,6}\s/g, ' ');
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '$1');
    processed = processed.replace(/\*([^*]+)\*/g, '$1');
    processed = processed.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    processed = processed.replace(/!\[([^\]]*)\]\([^)]+\)/g, ' ');
    processed = processed.replace(/<[^>]+>/g, ' ');
    processed = processed.replace(/\s+/g, ' ').trim();
    
    return processed;
  }

  /**
   * 中文分词 + N-gram 分词
   * @param {string} text - 输入文本
   * @returns {string[]} 词元数组
   */
  tokenize(text) {
    const processed = this.preprocessText(text);
    const finalTokens = new Set();
    
    const chineseParts = processed.match(/[\u4e00-\u9fa5]+/g) || [];
    const nonChineseParts = processed.match(/[a-zA-Z]+|[0-9]+/g) || [];
    
    nonChineseParts.forEach(token => {
      if (token.length > 1) {
        finalTokens.add(token.toLowerCase());
      }
    });
    
    chineseParts.forEach(part => {
      const segmented = this.tokenizer.segment(part);
      
      segmented.forEach(token => {
        if (token.length > 1) {
          finalTokens.add(token);
        }
      });
      
      for (let i = 0; i < part.length - 1; i++) {
        finalTokens.add(part.substring(i, i + 2));
      }
      for (let i = 0; i < part.length - 2; i++) {
        finalTokens.add(part.substring(i, i + 3));
      }
    });
    
    return Array.from(finalTokens);
  }

  /**
   * 计算词项哈希值
   * @param {string} term - 词项
   * @returns {number} 哈希值
   */
  hashTerm(term) {
    let hash = 0;
    for (let i = 0; i < term.length; i++) {
      const char = term.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * 创建批次
   * @param {Array} array - 数组
   * @param {number} batchSize - 批次大小
   * @returns {Array[]} 批次数组
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * 计算余弦相似度
   * @param {number[]} vec1 - 向量 1
   * @param {number[]} vec2 - 向量 2
   * @returns {number} 相似度 (0-1)
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) {
      throw new Error('向量维度不匹配');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 获取配置信息
   * @returns {Object} 配置对象
   */
  getConfig() {
    return {
      model: this.model,
      dimension: this.dimension,
      baseUrl: this.baseUrl
    };
  }

  /**
   * 获取模型信息
   * @returns {Object} 模型信息
   */
  getModelInfo() {
    return {
      name: this.model,
      dimension: this.dimension,
      baseUrl: this.baseUrl,
      initialized: this.initialized,
      ...this.modelInfo
    };
  }

  /**
   * 卸载
   */
  unload() {
    this.initialized = false;
    this.modelInfo = null;
    console.log('Ollama Embedding 已断开');
  }
}

module.exports = EmbeddingManager;
