/**
 * embedding-manager.js - 文本嵌入向量生成共享模块
 *
 * 负责调用 Ollama API 生成文本嵌入向量
 * 使用 Node.js 原生 http 模块，零外部依赖
 */
'use strict';

const http = require('http');
const https = require('https');

/**
 * EmbeddingManager 类
 * 管理文本嵌入向量的生成和文本分块
 */
class EmbeddingManager {
  /**
   * 构造函数
   * @param {Object} config - 配置对象
   * @param {Object} config.embedding - 嵌入配置
   * @param {string} config.embedding.model - 嵌入模型名称 (默认: 'nomic-embed-text')
   * @param {number} config.embedding.dimension - 向量维度 (默认: 768)
   * @param {number} config.embedding.batchSize - 批量处理大小 (默认: 5)
   * @param {string} config.embedding.baseUrl - Ollama API 地址 (默认: 'http://localhost:11434')
   * @param {number} config.embedding.maxContentLength - 最大内容长度 (默认: 4000)
   * @param {number} config.embedding.maxChunkLength - 最大分块长度 (默认: 4000)
   * @param {number} config.embedding.minChunkLength - 最小分块长度 (默认: 200)
   * @param {string[]} config.embedding.skipIndexAttrs - 跳过索引的属性列表
   * @param {number} config.embedding.timeout - 请求超时时间（毫秒，默认: 30000）
   */
  constructor(config = {}) {
    const embeddingConfig = config.embedding || {};

    this.model = embeddingConfig.model || 'nomic-embed-text';
    this.dimension = embeddingConfig.dimension || 768;
    this.batchSize = embeddingConfig.batchSize || 5;
    this.baseUrl = embeddingConfig.baseUrl || 'http://localhost:11434';
    this.maxContentLength = embeddingConfig.maxContentLength || 4000;
    this.maxChunkLength = embeddingConfig.maxChunkLength || 4000;
    this.minChunkLength = embeddingConfig.minChunkLength || 200;
    this.skipIndexAttrs = embeddingConfig.skipIndexAttrs || [];
    this.timeout = embeddingConfig.timeout || 30000;

    // 解析 URL
    this._parseUrl();
  }

  /**
   * 解析 baseUrl
   * @private
   */
  _parseUrl() {
    try {
      const parsedUrl = new URL(this.baseUrl);
      this.protocol = parsedUrl.protocol;
      this.hostname = parsedUrl.hostname;
      this.port = parsedUrl.port || (this.protocol === 'https:' ? 443 : 80);
    } catch (error) {
      throw new Error(`无效的 Ollama URL: ${this.baseUrl}`);
    }
  }

  /**
   * 发送 HTTP 请求
   * @private
   * @param {string} endpoint - API 端点
   * @param {Object} data - 请求数据
   * @returns {Promise<any>} 响应数据
   */
  _makeRequest(endpoint, data) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        port: this.port,
        path: endpoint,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SiyuanEmbeddingManager/1.0.0'
        },
        timeout: this.timeout
      };

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
                reject(new Error(`Ollama HTTP ${statusCode}: 空响应`));
              }
              return;
            }

            const parsedData = JSON.parse(responseData);

            if (statusCode >= 400) {
              const errorMsg = parsedData.error || parsedData.message || `HTTP ${statusCode}`;
              reject(new Error(`Ollama API 错误: ${errorMsg}`));
            } else {
              resolve(parsedData);
            }
          } catch (error) {
            reject(new Error(`Ollama 响应解析失败: ${error.message}`));
          }
        });
      });

      // 超时处理
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Ollama 请求超时 (${this.timeout}ms)`));
      });

      // 错误处理
      req.on('error', (error) => {
        reject(new Error(`Ollama 连接失败: ${error.message}`));
      });

      // 发送请求数据
      const postData = JSON.stringify(data);
      options.headers['Content-Length'] = Buffer.byteLength(postData);

      req.write(postData);
      req.end();
    });
  }

  /**
   * 生成单个文本的嵌入向量
   * @param {string} text - 待嵌入的文本
   * @returns {Promise<number[]|null>} 嵌入向量数组，失败返回 null
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    // 截断过长的文本
    const truncatedText = text.length > this.maxContentLength
      ? text.substring(0, this.maxContentLength)
      : text;

    try {
      const response = await this._makeRequest('/api/embeddings', {
        model: this.model,
        prompt: truncatedText
      });

      if (response && response.embedding && Array.isArray(response.embedding)) {
        return response.embedding;
      }

      console.error('Ollama 响应格式无效:', JSON.stringify(response).substring(0, 200));
      return null;
    } catch (error) {
      console.error('生成嵌入向量失败:', error.message);
      return null;
    }
  }

  /**
   * 批量生成嵌入向量
   * 按 batchSize 分批调用，避免一次性请求过多
   * @param {string[]} texts - 文本数组
   * @returns {Promise<Array<number[]|null>>} 嵌入向量数组（与输入顺序对应）
   */
  async generateEmbeddings(texts) {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    const results = new Array(texts.length).fill(null);

    // 分批处理
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchPromises = batch.map((text, batchIndex) =>
        this.generateEmbedding(text).then(embedding => ({
          index: i + batchIndex,
          embedding
        }))
      );

      try {
        const batchResults = await Promise.all(batchPromises);
        for (const result of batchResults) {
          results[result.index] = result.embedding;
        }
      } catch (error) {
        console.error(`批量生成嵌入失败 (批次 ${Math.floor(i / this.batchSize) + 1}):`, error.message);
      }

      // 批次间短暂延迟，避免过载
      if (i + this.batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * 将长文本分割为合适大小的块
   * 智能分割：优先在段落、句子边界处分割
   * @param {string} text - 待分割的文本
   * @param {number} [maxChunkLength] - 最大分块长度（默认使用配置值）
   * @param {number} [minChunkLength] - 最小分块长度（默认使用配置值）
   * @returns {string[]} 分割后的文本块数组
   */
  splitIntoChunks(text, maxChunkLength, minChunkLength) {
    const maxLen = maxChunkLength || this.maxChunkLength;
    const minLen = minChunkLength || this.minChunkLength;

    if (!text || typeof text !== 'string') {
      return [];
    }

    // 如果文本不长，直接返回
    if (text.length <= maxLen) {
      return [text.trim()].filter(chunk => chunk.length >= minLen);
    }

    const chunks = [];

    // 优先按段落分割
    const paragraphs = text.split(/\n\n+/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      // 如果当前块加上段落不超过最大长度
      if (currentChunk.length + paragraph.length + 2 <= maxLen) {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      } else {
        // 保存当前块
        if (currentChunk.length >= minLen) {
          chunks.push(currentChunk.trim());
        }

        // 如果段落本身就超过最大长度，需要进一步分割
        if (paragraph.length > maxLen) {
          const sentenceChunks = this._splitSentences(paragraph, maxLen, minLen);
          chunks.push(...sentenceChunks);
          currentChunk = '';
        } else {
          currentChunk = paragraph;
        }
      }
    }

    // 处理最后一个块
    if (currentChunk.length >= minLen) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 按句子分割文本（内部方法）
   * @private
   * @param {string} text - 待分割的文本
   * @param {number} maxLen - 最大长度
   * @param {number} minLen - 最小长度
   * @returns {string[]} 分割后的文本块
   */
  _splitSentences(text, maxLen, minLen) {
    const chunks = [];

    // 按句子边界分割（中英文句号、问号、感叹号）
    const sentences = text.split(/(?<=[。！？.!?])\s*/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length + 1 <= maxLen) {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      } else {
        if (currentChunk.length >= minLen) {
          chunks.push(currentChunk.trim());
        }

        // 如果单个句子超过最大长度，强制分割
        if (sentence.length > maxLen) {
          const forcedChunks = this._forceSplit(sentence, maxLen, minLen);
          chunks.push(...forcedChunks);
          currentChunk = '';
        } else {
          currentChunk = sentence;
        }
      }
    }

    if (currentChunk.length >= minLen) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * 强制分割文本（最后手段）
   * @private
   * @param {string} text - 待分割的文本
   * @param {number} maxLen - 最大长度
   * @param {number} minLen - 最小长度
   * @returns {string[]} 分割后的文本块
   */
  _forceSplit(text, maxLen, minLen) {
    const chunks = [];

    for (let i = 0; i < text.length; i += maxLen) {
      const chunk = text.slice(i, i + maxLen);
      if (chunk.length >= minLen) {
        chunks.push(chunk.trim());
      }
    }

    return chunks;
  }

  /**
   * 测试 Ollama 连接
   * @returns {Promise<boolean>} 连接是否成功
   */
  async testConnection() {
    try {
      const embedding = await this.generateEmbedding('测试连接');
      if (embedding && embedding.length === this.dimension) {
        console.log(`Ollama 连接成功，模型: ${this.model}，维度: ${this.dimension}`);
        return true;
      } else if (embedding) {
        console.warn(`Ollama 连接成功，但维度不匹配: 期望 ${this.dimension}，实际 ${embedding.length}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Ollama 连接测试失败:', error.message);
      return false;
    }
  }

  /**
   * 获取配置信息
   * @returns {Object} 当前配置
   */
  getConfig() {
    return {
      model: this.model,
      dimension: this.dimension,
      batchSize: this.batchSize,
      baseUrl: this.baseUrl,
      maxContentLength: this.maxContentLength,
      maxChunkLength: this.maxChunkLength,
      minChunkLength: this.minChunkLength,
      timeout: this.timeout
    };
  }
}

module.exports = EmbeddingManager;
