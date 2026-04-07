/**
 * 配置管理器
 * 管理 Siyuan Skill 技能的配置
 */

const fs = require('fs');
const path = require('path');

/**
 * ConfigManager 类
 * 处理配置的加载、验证和保存
 */
class ConfigManager {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.configPath - 配置文件路径
   * @param {Object} options.overrideConfig - 覆盖配置
   */
  constructor(options = {}) {
    this.configPath = options.configPath || path.join(__dirname, '../../config.json');
    this.defaultConfig = this.getDefaultConfig();
    this.overrideConfig = options.overrideConfig || {};
    this.config = this.loadConfig();
  }
  
  /**
   * 获取默认配置
   * @returns {Object} 默认配置
   */
  getDefaultConfig() {
    return {
      // 连接配置
      baseURL: 'http://localhost:6806',
      token: '',
      timeout: 10000,
      
      // 默认值
      defaultNotebook: null,
      
      // 权限配置
      permissionMode: 'all', // all, blacklist, whitelist
      notebookList: [],
      
      // Qdrant 向量数据库配置 - 无默认值
      qdrant: {
        url: null,
        apiKey: '',
        collectionName: 'siyuan_notes'
      },
      
      // Embedding 模型配置
      embedding: {
        model: 'nomic-embed-text',
        dimension: 768,
        indexConcurrency: 2,
        baseUrl: null,
        maxContentLength: 4000,
        maxChunkLength: 4000,
        minChunkLength: 200,
        maxDepth: 10,
        skipIndexAttrs: []
      },
      
      // 混合搜索配置
      hybridSearch: {
        denseWeight: 0.7,
        sparseWeight: 0.3,
        limit: 20
      },
      
      // NLP 配置
      nlp: {
        language: 'zh',
        extractEntities: true,
        extractKeywords: true
      },
      
      // 删除保护配置
      deleteProtection: {
        safeMode: true,
        requireConfirmation: false
      },
      
      // TLS 安全配置
      tls: {
          allowSelfSignedCerts: false,
          allowedHosts: ['localhost']
        },

      // 嵌入重排配置
      // 注意: segmentMaxLength 和 segmentOverlap 已统一使用 embedding 配置
      rerank: {
        enable: false,
        rerankTopK: 50,
        rerankWeight: 0.5,
        batchSize: 10,
        preserveOriginalScore: true,
        enableSegmentRerank: true
      }
    };
  }
  
  /**
   * 加载配置
   * @returns {Object} 合并后的配置
   */
  loadConfig() {
    // 从环境变量加载配置
    const envConfig = this.loadFromEnv();
    
    // 从配置文件加载配置
    const fileConfig = this.loadFromFile();
    
    // 简单合并配置，确保嵌套对象被正确覆盖
    const mergedConfig = {
      ...this.defaultConfig,
      ...fileConfig,
      ...envConfig,
      ...this.overrideConfig,
      qdrant: {
        ...this.defaultConfig.qdrant,
        ...fileConfig.qdrant,
        ...envConfig.qdrant,
        ...(this.overrideConfig.qdrant || {})
      },
      embedding: {
        ...this.defaultConfig.embedding,
        ...fileConfig.embedding,
        ...envConfig.embedding,
        ...(this.overrideConfig.embedding || {})
      },
      hybridSearch: {
        ...this.defaultConfig.hybridSearch,
        ...fileConfig.hybridSearch,
        ...envConfig.hybridSearch,
        ...(this.overrideConfig.hybridSearch || {})
      },
      nlp: {
        ...this.defaultConfig.nlp,
        ...fileConfig.nlp,
        ...envConfig.nlp,
        ...(this.overrideConfig.nlp || {})
      },
      deleteProtection: {
        ...this.defaultConfig.deleteProtection,
        ...fileConfig.deleteProtection,
        ...envConfig.deleteProtection,
        ...(this.overrideConfig.deleteProtection || {})
      },
      tls: {
        ...this.defaultConfig.tls,
        ...fileConfig.tls,
        ...envConfig.tls,
        ...(this.overrideConfig.tls || {})
      },
      rerank: {
        ...this.defaultConfig.rerank,
        ...fileConfig.rerank,
        ...envConfig.rerank,
        ...(this.overrideConfig.rerank || {})
      }
    };
    
    // 验证并返回配置
    return this.validateConfig(mergedConfig);
  }

  /**
   * 深度合并配置对象
   */
  deepMergeConfigs(...configs) {
    return configs.reduce((target, source) => {
      if (typeof target !== 'object' || target === null) {
        return source;
      }
      
      if (typeof source !== 'object' || source === null) {
        return source;
      }
      
      const merged = { ...target };
      
      for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && 
            !Array.isArray(source[key]) && 
            target[key] && typeof target[key] === 'object' && 
            !Array.isArray(target[key])) {
          // 深度合并嵌套对象
          merged[key] = this.deepMergeConfigs(target[key], source[key]);
        } else {
          // 简单值或数组直接覆盖
          merged[key] = source[key];
        }
      }
      
      return merged;
    }, {});
  }
  
  /**
   * 从环境变量加载配置
   * @returns {Object} 环境变量配置
   */
  loadFromEnv() {
    const envConfig = {};
    
    // 基础配置
    if (process.env.SIYUAN_BASE_URL) envConfig.baseURL = process.env.SIYUAN_BASE_URL;
    if (process.env.SIYUAN_TOKEN) envConfig.token = process.env.SIYUAN_TOKEN;
    if (process.env.SIYUAN_TIMEOUT) envConfig.timeout = parseInt(process.env.SIYUAN_TIMEOUT, 10);
    
    // 默认值
    if (process.env.SIYUAN_DEFAULT_NOTEBOOK) envConfig.defaultNotebook = process.env.SIYUAN_DEFAULT_NOTEBOOK;
    
    // 权限配置
    if (process.env.SIYUAN_PERMISSION_MODE) envConfig.permissionMode = process.env.SIYUAN_PERMISSION_MODE;
    if (process.env.SIYUAN_NOTEBOOK_LIST) {
      try {
        let notebookListStr = process.env.SIYUAN_NOTEBOOK_LIST.trim();
        // 处理 PowerShell 转义问题，修复单引号导致的解析失败
        if (notebookListStr.startsWith("'") && notebookListStr.endsWith("'")) {
          notebookListStr = notebookListStr.slice(1, -1);
        }
        // 替换可能存在的转义字符
        notebookListStr = notebookListStr.replace(/''/g, "'").replace(/\\"/g, '"');
        
        // 增强容错性：处理没有引号的数组元素
        if (notebookListStr.startsWith('[') && notebookListStr.endsWith(']')) {
          // 移除 [] 并处理元素
          const innerContent = notebookListStr.slice(1, -1).trim();
          if (innerContent) {
            // 检查是否是有效的JSON数组，不是则尝试修复
            try {
              envConfig.notebookList = JSON.parse(notebookListStr);
            } catch (jsonError) {
              const fixedStr = '["' + innerContent.replace(/["']/g, '').split(/\s*,\s*/).join('","') + '"]';
              envConfig.notebookList = JSON.parse(fixedStr);
            }
          } else {
            envConfig.notebookList = [];
          }
        } else if (notebookListStr.includes(',')) {
          envConfig.notebookList = notebookListStr.split(',').map(id => id.trim().replace(/['"]/g, '')).filter(id => id);
        } else {
          envConfig.notebookList = [notebookListStr.replace(/['"]/g, '')];
        }
      } catch (error) {
        envConfig.notebookList = [];
      }
    }
    
    // Qdrant 配置
    if (process.env.QDRANT_URL || process.env.QDRANT_API_KEY || process.env.QDRANT_COLLECTION_NAME) {
      envConfig.qdrant = {
        url: process.env.QDRANT_URL || this.defaultConfig.qdrant.url,
        apiKey: process.env.QDRANT_API_KEY || '',
        collectionName: process.env.QDRANT_COLLECTION_NAME || this.defaultConfig.qdrant.collectionName
      };
    }
    
    // Embedding 配置
    if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_EMBED_MODEL || process.env.EMBEDDING_MODEL || process.env.EMBEDDING_DIMENSION || process.env.EMBEDDING_INDEX_CONCURRENCY || process.env.SIYUAN_EMBEDDING_MAX_CONTENT_LENGTH || process.env.SIYUAN_EMBEDDING_MAX_CHUNK_LENGTH || process.env.SIYUAN_EMBEDDING_MIN_CHUNK_LENGTH || process.env.SIYUAN_EMBEDDING_MAX_DEPTH || process.env.SIYUAN_SKIP_INDEX_ATTRS) {
      envConfig.embedding = {
        model: process.env.OLLAMA_EMBED_MODEL || process.env.EMBEDDING_MODEL || this.defaultConfig.embedding.model,
        dimension: parseInt(process.env.EMBEDDING_DIMENSION, 10) || this.defaultConfig.embedding.dimension,
        indexConcurrency: parseInt(process.env.EMBEDDING_INDEX_CONCURRENCY, 10) || this.defaultConfig.embedding.indexConcurrency,
        baseUrl: process.env.OLLAMA_BASE_URL || process.env.EMBEDDING_BASE_URL || this.defaultConfig.embedding.baseUrl,
        maxContentLength: parseInt(process.env.SIYUAN_EMBEDDING_MAX_CONTENT_LENGTH, 10) || this.defaultConfig.embedding.maxContentLength,
        maxChunkLength: parseInt(process.env.SIYUAN_EMBEDDING_MAX_CHUNK_LENGTH, 10) || this.defaultConfig.embedding.maxChunkLength,
        minChunkLength: parseInt(process.env.SIYUAN_EMBEDDING_MIN_CHUNK_LENGTH, 10) || this.defaultConfig.embedding.minChunkLength,
        maxDepth: parseInt(process.env.SIYUAN_EMBEDDING_MAX_DEPTH, 10) || this.defaultConfig.embedding.maxDepth,
        skipIndexAttrs: process.env.SIYUAN_SKIP_INDEX_ATTRS ? process.env.SIYUAN_SKIP_INDEX_ATTRS.split(',').map(a => a.trim()).filter(Boolean) : this.defaultConfig.embedding.skipIndexAttrs
      };
    }
    
    // 混合搜索配置
    if (process.env.HYBRID_DENSE_WEIGHT || process.env.HYBRID_SPARSE_WEIGHT || process.env.HYBRID_SEARCH_LIMIT) {
      envConfig.hybridSearch = {
        denseWeight: parseFloat(process.env.HYBRID_DENSE_WEIGHT) || this.defaultConfig.hybridSearch.denseWeight,
        sparseWeight: parseFloat(process.env.HYBRID_SPARSE_WEIGHT) || this.defaultConfig.hybridSearch.sparseWeight,
        limit: parseInt(process.env.HYBRID_SEARCH_LIMIT, 10) || this.defaultConfig.hybridSearch.limit
      };
    }
    
    // NLP 配置
    if (process.env.NLP_LANGUAGE) {
      envConfig.nlp = {
        language: process.env.NLP_LANGUAGE || this.defaultConfig.nlp.language,
        extractEntities: process.env.NLP_EXTRACT_ENTITIES !== 'false',
        extractKeywords: process.env.NLP_EXTRACT_KEYWORDS !== 'false'
      };
    }
    
    // 删除保护配置
    if (process.env.SIYUAN_DELETE_SAFE_MODE !== undefined || 
        process.env.SIYUAN_DELETE_REQUIRE_CONFIRMATION !== undefined) {
      const deleteProtection = { ...this.defaultConfig.deleteProtection };
      
      if (process.env.SIYUAN_DELETE_SAFE_MODE !== undefined) {
        deleteProtection.safeMode = process.env.SIYUAN_DELETE_SAFE_MODE !== 'false';
      }
      
      if (process.env.SIYUAN_DELETE_REQUIRE_CONFIRMATION !== undefined) {
        deleteProtection.requireConfirmation = process.env.SIYUAN_DELETE_REQUIRE_CONFIRMATION === 'true';
      }
      
      envConfig.deleteProtection = deleteProtection;
    }
    
    // TLS 安全配置
    if (process.env.SIYUAN_TLS_ALLOW_SELF_SIGNED !== undefined) {
      envConfig.tls = {
        allowSelfSignedCerts: process.env.SIYUAN_TLS_ALLOW_SELF_SIGNED === 'true',
        allowedHosts: process.env.SIYUAN_TLS_ALLOWED_HOSTS
          ? process.env.SIYUAN_TLS_ALLOWED_HOSTS.split(',').map(h => h.trim())
          : this.defaultConfig.tls.allowedHosts
      };
    }

    // 嵌入重排配置
    if (process.env.RERANK_ENABLE || process.env.RERANK_TOP_K || process.env.RERANK_WEIGHT ||
        process.env.RERANK_CACHE_ENABLED || process.env.RERANK_CACHE_SIZE || process.env.RERANK_BATCH_SIZE) {
      envConfig.rerank = {
        enable: process.env.RERANK_ENABLE === 'true',
        rerankTopK: parseInt(process.env.RERANK_TOP_K, 10) || this.defaultConfig.rerank.rerankTopK,
        rerankWeight: parseFloat(process.env.RERANK_WEIGHT) || this.defaultConfig.rerank.rerankWeight,
        batchSize: parseInt(process.env.RERANK_BATCH_SIZE, 10) || this.defaultConfig.rerank.batchSize,
        preserveOriginalScore: process.env.RERANK_PRESERVE_ORIGINAL_SCORE !== 'false'
      };
    }

    return envConfig;
  }
  
  /**
   * 从文件加载配置
   * @returns {Object} 文件配置
   */
  loadFromFile() {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(configData);
      }
    } catch (error) {
      console.warn('配置文件加载失败:', error.message);
    }
    
    return {};
  }
  
  /**
   * 验证配置
   * @param {Object} config - 要验证的配置
   * @returns {Object} 验证后的配置
   */
  validateConfig(config) {
    const validatedConfig = { ...config };
    
    // 验证连接配置
    if (typeof validatedConfig.baseURL !== 'string' || !validatedConfig.baseURL) {
      validatedConfig.baseURL = this.defaultConfig.baseURL;
    }
    
    if (typeof validatedConfig.token !== 'string') {
      validatedConfig.token = this.defaultConfig.token;
    }
    
    if (typeof validatedConfig.timeout !== 'number' || validatedConfig.timeout <= 0) {
      validatedConfig.timeout = this.defaultConfig.timeout;
    }
    
    // 验证权限配置
    if (typeof validatedConfig.permissionMode !== 'string' || 
        !['all', 'blacklist', 'whitelist'].includes(validatedConfig.permissionMode)) {
      validatedConfig.permissionMode = this.defaultConfig.permissionMode;
    }
    
    // 修复 notebookList 配置验证问题
    if (!Array.isArray(validatedConfig.notebookList)) {
      // 如果是字符串，尝试解析
      if (typeof validatedConfig.notebookList === 'string') {
        if (validatedConfig.notebookList.trim()) {
          // 处理单个笔记本ID字符串
          validatedConfig.notebookList = [validatedConfig.notebookList.trim()];
        } else {
          validatedConfig.notebookList = [];
        }
      } else {
        validatedConfig.notebookList = this.defaultConfig.notebookList;
      }
    }
    
    // 验证 Qdrant 配置
    if (!validatedConfig.qdrant || typeof validatedConfig.qdrant !== 'object') {
      validatedConfig.qdrant = { ...this.defaultConfig.qdrant };
    } else {
      validatedConfig.qdrant = {
        url: validatedConfig.qdrant.url || this.defaultConfig.qdrant.url,
        apiKey: validatedConfig.qdrant.apiKey || '',
        collectionName: validatedConfig.qdrant.collectionName || this.defaultConfig.qdrant.collectionName
      };
    }
    
    // 验证 Embedding 配置
    if (!validatedConfig.embedding || typeof validatedConfig.embedding !== 'object') {
      validatedConfig.embedding = { ...this.defaultConfig.embedding };
    } else {
      validatedConfig.embedding = {
        model: validatedConfig.embedding.model || this.defaultConfig.embedding.model,
        dimension: validatedConfig.embedding.dimension || this.defaultConfig.embedding.dimension,
        indexConcurrency: validatedConfig.embedding.indexConcurrency || this.defaultConfig.embedding.indexConcurrency,
        baseUrl: validatedConfig.embedding.baseUrl || this.defaultConfig.embedding.baseUrl,
        maxContentLength: validatedConfig.embedding.maxContentLength || this.defaultConfig.embedding.maxContentLength,
        maxChunkLength: validatedConfig.embedding.maxChunkLength || this.defaultConfig.embedding.maxChunkLength,
        minChunkLength: validatedConfig.embedding.minChunkLength || this.defaultConfig.embedding.minChunkLength,
        maxDepth: validatedConfig.embedding.maxDepth || this.defaultConfig.embedding.maxDepth,
        skipIndexAttrs: Array.isArray(validatedConfig.embedding.skipIndexAttrs) ? validatedConfig.embedding.skipIndexAttrs : this.defaultConfig.embedding.skipIndexAttrs
      };
    }
    
    // 验证混合搜索配置
    if (!validatedConfig.hybridSearch || typeof validatedConfig.hybridSearch !== 'object') {
      validatedConfig.hybridSearch = { ...this.defaultConfig.hybridSearch };
    } else {
      validatedConfig.hybridSearch = {
        denseWeight: validatedConfig.hybridSearch.denseWeight ?? this.defaultConfig.hybridSearch.denseWeight,
        sparseWeight: validatedConfig.hybridSearch.sparseWeight ?? this.defaultConfig.hybridSearch.sparseWeight,
        limit: validatedConfig.hybridSearch.limit || this.defaultConfig.hybridSearch.limit
      };
    }
    
    // 验证 NLP 配置
    if (!validatedConfig.nlp || typeof validatedConfig.nlp !== 'object') {
      validatedConfig.nlp = { ...this.defaultConfig.nlp };
    } else {
      validatedConfig.nlp = {
        language: validatedConfig.nlp.language || this.defaultConfig.nlp.language,
        extractEntities: validatedConfig.nlp.extractEntities ?? this.defaultConfig.nlp.extractEntities,
        extractKeywords: validatedConfig.nlp.extractKeywords ?? this.defaultConfig.nlp.extractKeywords
      };
    }
    
    // 验证删除保护配置
    if (!validatedConfig.deleteProtection || typeof validatedConfig.deleteProtection !== 'object') {
      validatedConfig.deleteProtection = { ...this.defaultConfig.deleteProtection };
    } else {
      validatedConfig.deleteProtection = {
        safeMode: validatedConfig.deleteProtection.safeMode ?? this.defaultConfig.deleteProtection.safeMode,
        requireConfirmation: validatedConfig.deleteProtection.requireConfirmation ?? this.defaultConfig.deleteProtection.requireConfirmation
      };
    }
    
    // 验证 TLS 配置
    if (!validatedConfig.tls || typeof validatedConfig.tls !== 'object') {
      validatedConfig.tls = { ...this.defaultConfig.tls };
    } else {
      validatedConfig.tls = {
        allowSelfSignedCerts: validatedConfig.tls.allowSelfSignedCerts ?? this.defaultConfig.tls.allowSelfSignedCerts,
        allowedHosts: Array.isArray(validatedConfig.tls.allowedHosts)
          ? validatedConfig.tls.allowedHosts
          : this.defaultConfig.tls.allowedHosts
      };
    }

    // 验证重排配置
    if (!validatedConfig.rerank || typeof validatedConfig.rerank !== 'object') {
      validatedConfig.rerank = { ...this.defaultConfig.rerank };
    } else {
      validatedConfig.rerank = {
        enable: validatedConfig.rerank.enable ?? this.defaultConfig.rerank.enable,
        rerankTopK: typeof validatedConfig.rerank.rerankTopK === 'number' && validatedConfig.rerank.rerankTopK > 0
          ? Math.min(validatedConfig.rerank.rerankTopK, 200)
          : this.defaultConfig.rerank.rerankTopK,
        rerankWeight: typeof validatedConfig.rerank.rerankWeight === 'number'
          ? Math.max(0, Math.min(validatedConfig.rerank.rerankWeight, 1))
          : this.defaultConfig.rerank.rerankWeight,
        batchSize: typeof validatedConfig.rerank.batchSize === 'number' && validatedConfig.rerank.batchSize > 0
          ? Math.min(validatedConfig.rerank.batchSize, 50)
          : this.defaultConfig.rerank.batchSize,
        preserveOriginalScore: validatedConfig.rerank.preserveOriginalScore ?? this.defaultConfig.rerank.preserveOriginalScore,
        enableSegmentRerank: validatedConfig.rerank.enableSegmentRerank ?? this.defaultConfig.rerank.enableSegmentRerank,
        segmentMaxLength: typeof validatedConfig.rerank.segmentMaxLength === 'number' && validatedConfig.rerank.segmentMaxLength > 100
          ? Math.min(validatedConfig.rerank.segmentMaxLength, 50000)
          : this.defaultConfig.rerank.segmentMaxLength,
        segmentOverlap: typeof validatedConfig.rerank.segmentOverlap === 'number' && validatedConfig.rerank.segmentOverlap > 0
          ? Math.min(validatedConfig.rerank.segmentOverlap, 1000)
          : this.defaultConfig.rerank.segmentOverlap
      };
    }

    return validatedConfig;
  }
  
  /**
   * 获取配置
   * @returns {Object} 当前配置
   */
  getConfig() {
    // 每次获取配置时都重新加载，以支持环境变量的动态变化
    this.config = this.loadConfig();
    return { ...this.config };
  }
  
  /**
   * 获取配置值
   * @param {string} key - 配置键
   * @returns {any} 配置值
   */
  get(key) {
    return this.config[key];
  }
  
  /**
   * 获取配置摘要
   * @returns {Object} 配置摘要
   */
  getSummary() {
    const config = this.getConfig();
    return {
      baseURL: config.baseURL,
      token: config.token ? '***' + config.token.slice(-4) : '未设置',
      timeout: config.timeout,
      defaultNotebook: config.defaultNotebook || '未设置',
      permissionMode: config.permissionMode,
      notebookCount: config.notebookList.length
    };
  }
}

module.exports = ConfigManager;