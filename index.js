/**
 * Siyuan Skill 技能主入口文件
 * 提供标准技能接口和单指令调用支持
 * 支持向量搜索和 NLP 功能
 */

const path = require('path');
const ConfigManager = require('./config');
const SiyuanConnector = require('./connector');
const commands = require('./commands');
const CacheManager = require('./utils/cache');
const NotebookManager = require('./lib/notebook-manager');
const DocumentManager = require('./lib/document-manager');
const SearchManager = require('./lib/search-manager');
const SyncManager = require('./lib/sync-manager');
const EmbeddingManager = require('./lib/embedding-manager');
const VectorManager = require('./lib/vector-manager');
const NLPManager = require('./lib/nlp-manager');

/**
 * SiyuanNotesSkill 类
 * 提供完整的 Siyuan Notes 连接和管理功能
 */
class SiyuanNotesSkill {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {string} options.baseURL - Siyuan Notes API 地址
   * @param {string} options.token - API 令牌
   * @param {number} options.timeout - 请求超时时间（毫秒）
   * @param {number} options.cacheExpiry - 缓存过期时间（毫秒）
   * @param {boolean} options.enableVectorSearch - 是否启用向量搜索
   * @param {boolean} options.enableNLP - 是否启用 NLP 功能
   */
  constructor(options = {}) {
    this.configManager = new ConfigManager({
      overrideConfig: options
    });
    const config = this.configManager.getConfig();

    this.connector = new SiyuanConnector(config);
    this.config = config;
    this.initialized = false;

    this.cacheManager = new CacheManager(config.cacheExpiry || 300000);
    this.notebookManager = new NotebookManager(this.connector, this.cacheManager);
    this.documentManager = new DocumentManager(this.connector, this.cacheManager);
    this.searchManager = new SearchManager(this.connector);
    this.syncManager = new SyncManager(this.cacheManager);

    this.embeddingManager = null;
    this.vectorManager = null;
    this.nlpManager = null;

    this.vectorSearchEnabled = options.enableVectorSearch !== false;
    this.nlpEnabled = options.enableNLP !== false;

    this.cache = {
      notebooks: null,
      notebookConfigs: {},
      docStructure: {},
      cacheExpiry: config.cacheExpiry || 300000
    };

    this.syncStatus = {
      lastSync: null,
      isSyncing: false,
      syncError: null,
      syncInterval: null
    };
  }

  /**
   * 获取所有笔记本（便捷方法）
   * @param {boolean} forceRefresh - 是否强制刷新缓存
   * @returns {Promise<Object>} 笔记本列表
   */
  async getNotebooks(forceRefresh = false) {
    return this.notebookManager.getNotebooks(forceRefresh);
  }

  /**
   * 初始化技能连接
   * @param {Object} options - 初始化选项
   * @param {boolean} options.initVectorSearch - 是否初始化向量搜索
   * @param {boolean} options.initNLP - 是否初始化 NLP
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async init(options = {}) {
    if (this.initialized) {
      return true;
    }

    try {
      const connected = await this.connector.testConnection();
      if (!connected) {
        throw new Error('无法连接到 Siyuan Notes');
      }

      const initVectorSearch = options.initVectorSearch !== false && this.vectorSearchEnabled;
      const initNLP = options.initNLP !== false && this.nlpEnabled;

      if (initVectorSearch) {
        await this.initVectorSearch();
      }

      if (initNLP) {
        await this.initNLP();
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error('初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化向量搜索功能
   * @returns {Promise<boolean>}
   */
  async initVectorSearch() {
    try {
      if (!this.embeddingManager) {
        this.embeddingManager = new EmbeddingManager(this.config.embedding);
        await this.embeddingManager.initialize();
      }

      if (!this.vectorManager) {
        this.vectorManager = new VectorManager(this.config, this.embeddingManager);
        const success = await this.vectorManager.initialize();
        
        if (success) {
          this.searchManager.setVectorManager(this.vectorManager);
          console.log('向量搜索功能已启用');
        }
        return success;
      }

      return this.vectorManager.isReady();
    } catch (error) {
      console.warn('向量搜索初始化失败，将使用 SQL 搜索:', error.message);
      return false;
    }
  }

  /**
   * 初始化 NLP 功能
   * @returns {Promise<boolean>}
   */
  async initNLP() {
    try {
      if (!this.nlpManager) {
        this.nlpManager = new NLPManager(this.config.nlp);
        const success = await this.nlpManager.initialize();
        
        if (success) {
          this.searchManager.setNLPManager(this.nlpManager);
          console.log('NLP 功能已启用');
        }
        return success;
      }

      return this.nlpManager.isReady();
    } catch (error) {
      console.warn('NLP 初始化失败:', error.message);
      return false;
    }
  }

  /**
   * 检查向量搜索是否可用
   * @returns {boolean}
   */
  isVectorSearchReady() {
    return this.vectorManager?.isReady() || false;
  }

  /**
   * 检查 NLP 是否可用
   * @returns {boolean}
   */
  isNLPReady() {
    return this.nlpManager?.isReady() || false;
  }

  /**
   * 获取技能信息
   * @returns {Object} 技能信息
   */
  getInfo() {
    return {
      name: 'siyuan-skill',
      version: '1.6.10',
      description: 'Siyuan Notes 连接器技能（支持向量搜索和 NLP）',
      commands: Object.keys(commands).map(cmd => ({
        name: cmd,
        description: commands[cmd].description || '无描述'
      })),
      features: {
        vectorSearch: this.isVectorSearchReady(),
        nlp: this.isNLPReady()
      }
    };
  }

  /**
   * 执行单指令
   * @param {string} commandName - 指令名称
   * @param {Object} args - 指令参数
   * @returns {Promise<any>} 指令执行结果
   */
  async executeCommand(commandName, args = {}) {
    if (!this.initialized) {
      await this.init();
    }

    const command = commands[commandName];
    if (!command) {
      throw new Error(`未知指令：${commandName}`);
    }

    return command.execute(this, args);
  }

  /**
   * 获取所有可用指令
   * @returns {Array} 指令列表
   */
  getCommands() {
    return Object.keys(commands).map(name => ({
      name,
      description: commands[name].description || '',
      usage: commands[name].usage || ''
    }));
  }

  /**
   * 获取配置
   * @returns {Object} 当前配置
   */
  getConfig() {
    return this.config;
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   */
  setConfig(newConfig) {
    this.configManager.updateConfig(newConfig);
    this.config = this.configManager.getConfig();

    if (newConfig.baseURL) {
      this.connector.setBaseURL(newConfig.baseURL);
    }

    if (newConfig.token) {
      this.connector.setToken(newConfig.token);
    }

    if (newConfig.timeout) {
      this.connector.setTimeout(newConfig.timeout);
    }

    if (newConfig.cacheExpiry) {
      this.cacheManager.defaultExpiry = newConfig.cacheExpiry;
    }

    this.initialized = false;
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cacheManager.clear();
    
    this.cache.notebooks = null;
    this.cache.notebookConfigs = {};
    this.cache.docStructure = {};
  }

  /**
   * 检查权限
   * @param {string} notebookId - 笔记本 ID
   * @returns {boolean} 是否有权限
   */
  checkPermission(notebookId) {
    const { permissionMode, notebookList } = this.config;

    if (permissionMode === 'all') {
      return true;
    }

    if (permissionMode === 'blacklist') {
      return !notebookList.includes(notebookId);
    }

    if (permissionMode === 'whitelist') {
      return notebookList.includes(notebookId);
    }

    return true;
  }

  /**
   * 索引文档到向量数据库
   * @param {Object} options - 索引选项
   * @returns {Promise<Object>} 索引结果
   */
  async indexDocuments(options = {}) {
    if (!this.isVectorSearchReady()) {
      await this.initVectorSearch();
    }

    if (!this.isVectorSearchReady()) {
      throw new Error('向量搜索功能不可用');
    }

    return this.executeCommand('index-documents', options);
  }

  /**
   * 获取向量搜索统计信息
   * @returns {Promise<Object|null>}
   */
  async getVectorStats() {
    if (!this.vectorManager) {
      return null;
    }
    return this.vectorManager.getCollectionStats();
  }

  /**
   * 分析文本（NLP）
   * @param {string} text - 待分析文本
   * @returns {Object} 分析结果
   */
  analyzeText(text) {
    if (!this.isNLPReady()) {
      throw new Error('NLP 功能不可用');
    }
    return this.nlpManager.analyze(text);
  }
}

/**
 * 创建技能实例的工厂函数
 * @param {Object} options - 配置选项
 * @returns {SiyuanNotesSkill} 技能实例
 */
function createSkill(options = {}) {
  return new SiyuanNotesSkill(options);
}

/**
 * 单指令执行函数
 * @param {string} commandName - 指令名称
 * @param {Object} args - 指令参数
 * @param {Object} options - 技能配置选项
 * @returns {Promise<any>} 执行结果
 */
async function executeSingleCommand(commandName, args = {}, options = {}) {
  const skill = createSkill(options);
  await skill.init();
  return skill.executeCommand(commandName, args);
}

const getNotebooks = async (options = {}) => {
  return executeSingleCommand('get-notebooks', {}, options);
};

const getDocStructure = async (notebookId, options = {}) => {
  return executeSingleCommand('get-doc-structure', { notebookId }, options);
};

const getDocContent = async (docId, format = 'markdown', options = {}) => {
  return executeSingleCommand('get-doc-content', { docId, format }, options);
};

const searchContent = async (query, searchOptions = {}, skillOptions = {}) => {
  return executeSingleCommand('search-content', { query, ...searchOptions }, skillOptions);
};

const createDocument = async (parentId, title, content = '', options = {}) => {
  return executeSingleCommand('create-document', { parentId, title, content }, options);
};

const updateDocument = async (docId, content, options = {}) => {
  return executeSingleCommand('update-document', { docId, content }, options);
};

const deleteDocument = async (docId, options = {}) => {
  return executeSingleCommand('delete-document', { docId }, options);
};

const moveDocument = async (docId, targetParentId, moveOptions = {}, options = {}) => {
  return executeSingleCommand('move-document', { docId, targetParentId, ...moveOptions }, options);
};

const convertPath = async (params, options = {}) => {
  return executeSingleCommand('convert-path', params, options);
};

const pathToId = async (path, options = {}) => {
  return executeSingleCommand('convert-path', { path }, options);
};

const idToPath = async (id, options = {}) => {
  return executeSingleCommand('convert-path', { id }, options);
};

const hybridSearch = async (query, searchOptions = {}, skillOptions = {}) => {
  return executeSingleCommand('search-content', { query, mode: 'hybrid', ...searchOptions }, skillOptions);
};

const semanticSearch = async (query, searchOptions = {}, skillOptions = {}) => {
  return executeSingleCommand('search-content', { query, mode: 'semantic', ...searchOptions }, skillOptions);
};

const keywordSearch = async (query, searchOptions = {}, skillOptions = {}) => {
  return executeSingleCommand('search-content', { query, mode: 'keyword', ...searchOptions }, skillOptions);
};

const indexDocuments = async (indexOptions = {}, skillOptions = {}) => {
  return executeSingleCommand('index-documents', indexOptions, skillOptions);
};

const nlpAnalyze = async (text, nlpOptions = {}, skillOptions = {}) => {
  return executeSingleCommand('nlp-analyze', { text, ...nlpOptions }, skillOptions);
};

module.exports = {
  SiyuanNotesSkill,
  createSkill,
  executeSingleCommand,
  commands,
  getNotebooks,
  getDocStructure,
  getDocContent,
  searchContent,
  createDocument,
  updateDocument,
  deleteDocument,
  moveDocument,
  convertPath,
  pathToId,
  idToPath,
  hybridSearch,
  semanticSearch,
  keywordSearch,
  indexDocuments,
  nlpAnalyze,
  EmbeddingManager,
  VectorManager,
  NLPManager
};
