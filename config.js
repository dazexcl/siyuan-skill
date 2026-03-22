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
    this.configPath = options.configPath || path.join(__dirname, 'config.json');
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
      
      // 缓存配置
      cacheExpiry: 300000, // 5分钟
      syncInterval: 30000, // 30秒
      
      // 默认值
      defaultNotebook: null,
      defaultFormat: 'markdown',
      
      // 权限配置
      permissionMode: 'all', // all, blacklist, whitelist
      notebookList: [],
      
      // 功能配置
      enableCache: true,
      enableSync: false,
      enableLogging: true,
      debugMode: false,
      
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
        batchSize: 5,
        baseUrl: null,
        maxContentLength: 4000,
        maxChunkLength: 4000,
        minChunkLength: 200
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
    
    // 缓存配置
    if (process.env.SIYUAN_CACHE_EXPIRY) envConfig.cacheExpiry = parseInt(process.env.SIYUAN_CACHE_EXPIRY, 10);
    if (process.env.SIYUAN_SYNC_INTERVAL) envConfig.syncInterval = parseInt(process.env.SIYUAN_SYNC_INTERVAL, 10);
    
    // 默认值
    if (process.env.SIYUAN_DEFAULT_NOTEBOOK) envConfig.defaultNotebook = process.env.SIYUAN_DEFAULT_NOTEBOOK;
    if (process.env.SIYUAN_DEFAULT_FORMAT) envConfig.defaultFormat = process.env.SIYUAN_DEFAULT_FORMAT;
    
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
              // 尝试直接解析
              envConfig.notebookList = JSON.parse(notebookListStr);
            } catch (jsonError) {
              // 尝试修复：给数组元素添加引号
              const fixedStr = '["' + innerContent.replace(/["']/g, '').split(/\s*,\s*/).join('","') + '"]';
              envConfig.notebookList = JSON.parse(fixedStr);
              console.log('环境变量 SIYUAN_NOTEBOOK_LIST 解析成功（已修复格式）:', envConfig.notebookList);
            }
          } else {
            envConfig.notebookList = [];
          }
        } else if (notebookListStr.includes(',')) {
          // 逗号分隔格式：id1,id2,id3
          envConfig.notebookList = notebookListStr.split(',').map(id => id.trim().replace(/['"]/g, '')).filter(id => id);
          console.log('环境变量 SIYUAN_NOTEBOOK_LIST 解析成功（逗号分隔）:', envConfig.notebookList);
        } else {
          // 单个笔记本ID
          envConfig.notebookList = [notebookListStr.replace(/['"]/g, '')];
          console.log('环境变量 SIYUAN_NOTEBOOK_LIST 解析成功（单个ID）:', envConfig.notebookList);
        }
      } catch (error) {
        console.warn('环境变量 SIYUAN_NOTEBOOK_LIST 解析失败:', error.message);
        console.warn('原始值:', process.env.SIYUAN_NOTEBOOK_LIST);
        envConfig.notebookList = [];
      }
    }
    
    // 功能配置
    if (process.env.SIYUAN_ENABLE_CACHE) envConfig.enableCache = process.env.SIYUAN_ENABLE_CACHE === 'true';
    if (process.env.SIYUAN_ENABLE_SYNC) envConfig.enableSync = process.env.SIYUAN_ENABLE_SYNC === 'true';
    if (process.env.SIYUAN_ENABLE_LOGGING) envConfig.enableLogging = process.env.SIYUAN_ENABLE_LOGGING === 'true';
    if (process.env.SIYUAN_DEBUG_MODE) envConfig.debugMode = process.env.SIYUAN_DEBUG_MODE === 'true';
    
    // Qdrant 配置
    if (process.env.QDRANT_URL || process.env.QDRANT_API_KEY || process.env.QDRANT_COLLECTION_NAME) {
      envConfig.qdrant = {
        url: process.env.QDRANT_URL || this.defaultConfig.qdrant.url,
        apiKey: process.env.QDRANT_API_KEY || '',
        collectionName: process.env.QDRANT_COLLECTION_NAME || this.defaultConfig.qdrant.collectionName
      };
    }
    
    // Embedding 配置
    if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_EMBED_MODEL || process.env.EMBEDDING_MODEL || process.env.EMBEDDING_DIMENSION || process.env.EMBEDDING_BATCH_SIZE || process.env.SIYUAN_EMBEDDING_MAX_CONTENT_LENGTH || process.env.SIYUAN_EMBEDDING_MAX_CHUNK_LENGTH || process.env.SIYUAN_EMBEDDING_MIN_CHUNK_LENGTH) {
      envConfig.embedding = {
        model: process.env.OLLAMA_EMBED_MODEL || process.env.EMBEDDING_MODEL || this.defaultConfig.embedding.model,
        dimension: parseInt(process.env.EMBEDDING_DIMENSION, 10) || this.defaultConfig.embedding.dimension,
        batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE, 10) || this.defaultConfig.embedding.batchSize,
        baseUrl: process.env.OLLAMA_BASE_URL || process.env.EMBEDDING_BASE_URL || this.defaultConfig.embedding.baseUrl,
        maxContentLength: parseInt(process.env.SIYUAN_EMBEDDING_MAX_CONTENT_LENGTH, 10) || this.defaultConfig.embedding.maxContentLength,
        maxChunkLength: parseInt(process.env.SIYUAN_EMBEDDING_MAX_CHUNK_LENGTH, 10) || this.defaultConfig.embedding.maxChunkLength,
        minChunkLength: parseInt(process.env.SIYUAN_EMBEDDING_MIN_CHUNK_LENGTH, 10) || this.defaultConfig.embedding.minChunkLength
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
      envConfig.deleteProtection = {
        safeMode: process.env.SIYUAN_DELETE_SAFE_MODE !== 'false',
        requireConfirmation: process.env.SIYUAN_DELETE_REQUIRE_CONFIRMATION === 'true'
      };
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
    
    // 验证缓存配置
    if (typeof validatedConfig.cacheExpiry !== 'number' || validatedConfig.cacheExpiry <= 0) {
      validatedConfig.cacheExpiry = this.defaultConfig.cacheExpiry;
    }
    
    if (typeof validatedConfig.syncInterval !== 'number' || validatedConfig.syncInterval <= 0) {
      validatedConfig.syncInterval = this.defaultConfig.syncInterval;
    }
    
    // 验证默认值
    if (typeof validatedConfig.defaultFormat !== 'string' || 
        !['markdown', 'text', 'html'].includes(validatedConfig.defaultFormat)) {
      validatedConfig.defaultFormat = this.defaultConfig.defaultFormat;
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
    
    // 验证功能配置
    if (typeof validatedConfig.enableCache !== 'boolean') {
      validatedConfig.enableCache = this.defaultConfig.enableCache;
    }
    
    if (typeof validatedConfig.enableSync !== 'boolean') {
      validatedConfig.enableSync = this.defaultConfig.enableSync;
    }
    
    if (typeof validatedConfig.enableLogging !== 'boolean') {
      validatedConfig.enableLogging = this.defaultConfig.enableLogging;
    }
    
    if (typeof validatedConfig.debugMode !== 'boolean') {
      validatedConfig.debugMode = this.defaultConfig.debugMode;
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
        batchSize: validatedConfig.embedding.batchSize || this.defaultConfig.embedding.batchSize,
        baseUrl: validatedConfig.embedding.baseUrl || this.defaultConfig.embedding.baseUrl,
        maxContentLength: validatedConfig.embedding.maxContentLength || this.defaultConfig.embedding.maxContentLength,
        maxChunkLength: validatedConfig.embedding.maxChunkLength || this.defaultConfig.embedding.maxChunkLength,
        minChunkLength: validatedConfig.embedding.minChunkLength || this.defaultConfig.embedding.minChunkLength
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
    
    return validatedConfig;
  }
  
  /**
   * 保存配置到文件
   * @returns {boolean} 保存是否成功
   */
  saveConfig() {
    try {
      const configDir = path.dirname(this.configPath);
      
      // 确保目录存在
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      // 保存配置
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
      console.log('配置已保存到:', this.configPath);
      return true;
    } catch (error) {
      console.error('保存配置失败:', error);
      return false;
    }
  }
  
  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   * @returns {boolean} 更新是否成功
   */
  updateConfig(newConfig) {
    this.config = this.validateConfig({ ...this.config, ...newConfig });
    return this.saveConfig();
  }
  
  /**
   * 获取配置
   * @returns {Object} 当前配置
   */
  getConfig() {
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
   * 设置配置值
   * @param {string} key - 配置键
   * @param {any} value - 配置值
   * @returns {boolean} 设置是否成功
   */
  set(key, value) {
    this.config[key] = value;
    return this.saveConfig();
  }
  
  /**
   * 重置为默认配置
   * @returns {boolean} 重置是否成功
   */
  resetToDefault() {
    this.config = { ...this.defaultConfig };
    return this.saveConfig();
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
      notebookCount: config.notebookList.length,
      cacheEnabled: config.enableCache,
      syncEnabled: config.enableSync
    };
  }
}

module.exports = ConfigManager;