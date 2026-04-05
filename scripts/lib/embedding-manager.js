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
   * 获取配置信息
   * @returns {Object} 配置对象
   */
  getConfig() {
    return {
      model: this.model,
      dimension: this.dimension,
      baseUrl: this.baseUrl,
      maxContentLength: this.maxContentLength,
      maxChunkLength: this.maxChunkLength,
      minChunkLength: this.minChunkLength
    };
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

        this.initialized = false;
        return false;
      }

      // 获取模型信息
      await this.getModelInfo();
      
      this.initialized = true;
      return true;
    } catch (error) {

      this.initialized = false;
      return false;
    }
  }

  /**
   * 检查 Ollama 连接
   * @returns {Promise<boolean>}
   */
  async checkConnection() {
    if (!this.baseUrl) {
      return false;
    }

    try {
      const response = await this.makeOllamaRequest('/api/tags');
      return response && response.models;
    } catch (error) {

      return false;
    }
  }

  /**
   * 获取模型信息
   * @returns {Promise<Object>}
   */
  async getModelInfo() {
    try {
      const response = await this.makeOllamaRequest('/api/tags');
      const models = response.models || [];
      const modelInfo = models.find(m => m.name.includes(this.model));
      
      if (modelInfo) {
        this.modelInfo = modelInfo;
        return modelInfo;
      }
      

      return null;
    } catch (error) {

      return null;
    }
  }

  /**
   * 生成文本向量嵌入
   * @param {string} text - 输入文本
   * @returns {Promise<number[]>} 向量数组
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      throw new Error('无效的输入文本');
    }

    if (!this.baseUrl) {
      throw new Error('未配置 Ollama 服务地址');
    }

    try {
      const response = await this.makeOllamaRequest('/api/embeddings', {
        model: this.model,
        prompt: text
      });

      if (response && response.embedding) {
        return response.embedding;
      }

      throw new Error('未收到向量嵌入响应');
    } catch (error) {

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

    const embeddings = [];
    const batchSize = 5; // Ollama 批处理大小

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchEmbeddings = await Promise.all(
        batch.map(text => this.generateEmbedding(text))
      );
      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  /**
   * 将文本分割成块
   * @param {string} text - 输入文本
   * @returns {string[]} 文本块数组
   */
  splitIntoChunks(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // 如果文本较短，不需要分割
    if (text.length <= this.maxChunkLength) {
      return text.length >= this.minChunkLength ? [text] : [];
    }

    const chunks = [];
    const sentences = this.splitIntoSentences(text);
    let currentChunk = '';

    for (const sentence of sentences) {
      const potentialChunk = currentChunk ? currentChunk + sentence : sentence;
      
      if (potentialChunk.length <= this.maxChunkLength) {
        currentChunk = potentialChunk;
      } else {
        // 保存当前块
        if (currentChunk.length >= this.minChunkLength) {
          chunks.push(currentChunk.trim());
        }
        
        // 开始新块
        currentChunk = sentence;
      }
    }

    // 添加最后一个块
    if (currentChunk.length >= this.minChunkLength) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 将文本分割成句子
   * @param {string} text - 输入文本
   * @returns {string[]} 句子数组
   */
  splitIntoSentences(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // 按标点符号分割
    const sentences = text
      .replace(/([.!?。！？]+)/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    return sentences;
  }

  /**
   * 计算两个向量的余弦相似度
   * @param {number[]} vec1 - 向量1
   * @param {number[]} vec2 - 向量2
   * @returns {number} 相似度（0-1）
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
   * 检查是否已初始化
   * @returns {boolean}
   */
  isReady() {
    return this.initialized;
  }

  /**
   * 发送 Ollama API 请求
   * @param {string} path - API 路径
   * @param {Object} body - 请求体
   * @returns {Promise<Object>} 响应数据
   */
  async makeOllamaRequest(path, body = null) {
    const url = new URL(this.baseUrl);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 11434),
      path: path,
      method: body ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

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
              reject(new Error(`Ollama API 错误: ${res.statusCode}`));
            } else {
              resolve(parsedData);
            }
          } catch (error) {
            reject(new Error(`Ollama 响应解析失败: ${error.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (body) {
        req.write(JSON.stringify(body));
      }

      req.end();
    });
  }

  /**
   * 文本分词
   * @param {string} text - 输入文本
   * @returns {string[]} 分词结果
   */
  tokenize(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    return this.tokenizer.segment(text);
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
   * 哈希词项到固定范围的索引
   * @param {string} term - 词项
   * @returns {number} 索引
   */
  hashTerm(term) {
    let hash = 0;
    for (let i = 0; i < term.length; i++) {
      const char = term.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash) % 10000; // 使用10000作为哈希空间大小
  }
}

module.exports = EmbeddingManager;