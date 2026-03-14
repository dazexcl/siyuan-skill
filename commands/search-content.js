/**
 * 搜索内容指令
 * 在 Siyuan Notes 中搜索内容
 * 支持 SQL 搜索、语义搜索、关键词搜索和混合搜索
 */

const { pathToId } = require('./convert-path');
const Permission = require('../utils/permission');

/**
 * 指令配置
 */
const command = {
  name: 'search-content',
  description: '在 Siyuan Notes 中搜索内容（支持向量搜索）',
  usage: 'search-content --query <query> [--mode hybrid|semantic|keyword|legacy] [--notebook-id <notebookId>] [--limit <limit>]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.query - 搜索查询
   * @param {string} args.mode - 搜索模式：hybrid(混合)、semantic(语义)、keyword(关键词)、legacy(SQL)
   * @param {string} args.notebookId - 笔记本ID（可选）
   * @param {string} args.path - 搜索路径（可选）
   * @param {number} args.limit - 结果数量限制
   * @param {string} args.sortBy - 排序方式：relevance、date
   * @param {string} args.type - 按单个类型过滤 (d/p/h/l/i/tb/c/s/img)
   * @param {Array|string} args.types - 按多个类型过滤
   * @param {boolean} args.hasTags - 是否有标签
   * @param {string} args.sql - 自定义SQL查询条件（可选）
   * @param {number} args.denseWeight - 语义搜索权重（混合搜索时）
   * @param {number} args.sparseWeight - 关键词搜索权重（混合搜索时）
   * @param {number} args.sqlWeight - SQL搜索权重（混合搜索时）
   * @param {number} args.threshold - 相似度阈值
   * @returns {Promise<Object>} 搜索结果
   */
  async execute(skill, args = {}) {
    const { 
      query, 
      mode = 'legacy',
      notebookId, 
      path,
      limit = 10, 
      sortBy = 'relevance',
      type,
      types,
      hasTags,
      sql,
      denseWeight = 0.7,
      sparseWeight = 0.3,
      sqlWeight = 0,
      threshold = 0.0
    } = args;
    
    if (!query) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 query 参数'
      };
    }
    
    const validModes = ['hybrid', 'semantic', 'keyword', 'legacy'];
    if (!validModes.includes(mode)) {
      return {
        success: false,
        error: '无效的搜索模式',
        message: `mode 必须是以下之一: ${validModes.join(', ')}`
      };
    }
    
    const validSortBy = ['relevance', 'date'];
    if (!validSortBy.includes(sortBy)) {
      return {
        success: false,
        error: '无效的排序参数',
        message: `sortBy 必须是以下之一: ${validSortBy.join(', ')}`
      };
    }
    
    const validTypes = ['d', 'p', 'h', 'l', 'i', 'tb', 'c', 's', 'img'];
    if (type && !validTypes.includes(type)) {
      return {
        success: false,
        error: '无效的类型参数',
        message: `type 必须是以下之一: ${validTypes.join(', ')}`
      };
    }
    
    let parsedTypes = types;
    if (parsedTypes && typeof parsedTypes === 'string') {
      parsedTypes = parsedTypes.split(',').map(t => t.trim());
    }
    
    if (notebookId) {
      const notebookPermission = Permission.checkNotebookPermission(skill, notebookId);
      if (!notebookPermission.hasPermission) {
        return {
          success: false,
          error: '权限不足',
          message: notebookPermission.error
        };
      }
    }
    
    let parentId = null;
    if (path) {
      console.log('处理搜索路径:', path);
      const pathResult = await pathToId(skill.connector, path, true);
      if (!pathResult.success) {
        return {
          success: false,
          error: '路径处理失败',
          message: pathResult.message
        };
      }
      parentId = pathResult.data.id;
      console.log('路径对应的文档ID:', parentId);
      
      const pathPermission = await Permission.checkDocumentPermission(skill, parentId);
      if (!pathPermission.hasPermission) {
        return {
          success: false,
          error: '权限不足',
          message: `无权访问路径 ${path}`
        };
      }
    }
    
    try {
      const searchOptions = {
        notebookId,
        path,
        parentId,
        limit,
        sortBy,
        type,
        types: parsedTypes,
        hasTags,
        sql,
        denseWeight,
        sparseWeight,
        sqlWeight,
        threshold,
        checkPermissionFn: Permission.createCheckPermissionCallback(skill)
      };

      let searchResult;
      
      if (mode === 'legacy') {
        searchResult = await skill.searchManager.searchContent(query, searchOptions);
      } else if (mode === 'hybrid') {
        searchResult = await skill.searchManager.hybridSearch(query, searchOptions);
      } else if (mode === 'semantic') {
        searchResult = await skill.searchManager.semanticSearch(query, searchOptions);
      } else if (mode === 'keyword') {
        searchResult = await skill.searchManager.keywordSearch(query, searchOptions);
      } else {
        searchResult = await skill.searchManager.search(query, { ...searchOptions, mode });
      }
      
      return {
        success: true,
        data: searchResult,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('搜索内容失败:', error);
      return {
        success: false,
        error: error.message,
        message: '搜索内容失败'
      };
    }
  }
};

module.exports = command;
