/**
 * 搜索内容指令
 * 在 Siyuan Notes 中搜索内容
 * 支持 SQL 搜索、语义搜索、关键词搜索和混合搜索
 */

const { pathToId } = require('./convert-path');
const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 指令配置
 */
const command = {
  name: 'search',
  aliases: ['find'],
  description: '搜索内容（支持向量搜索）',
  usage: 'siyuan search <query> [--mode <mode>]',
  sortOrder: 50,
  
  initOptions: { initVectorSearch: false, initNLP: false },
  options: {
    '--type': { hasValue: true, aliases: ['-T'], description: '按类型过滤：d/p/h/l/i/tb/c' },
    '--types': { hasValue: true, description: '按多个类型过滤（逗号分隔）' },
    '--mode': { hasValue: true, aliases: ['-m'], description: '搜索模式：hybrid|semantic|keyword|legacy' },
    '--limit': { hasValue: true, aliases: ['-l'], description: '结果数量限制（默认10）' },
    '--path': { hasValue: true, aliases: ['-P'], description: '限定路径范围' },
    '--notebook-id': { hasValue: true, aliases: ['-n', '--notebook'], description: '限定笔记本ID' },
    '--sort-by': { hasValue: true, description: '排序字段' },
    '--has-tags': { isFlag: true, description: '只返回有标签的结果' },
    '--where': { hasValue: true, description: 'SQL WHERE 条件' },
    '--threshold': { hasValue: true, description: '相似度阈值' },
    '--dense-weight': { hasValue: true, description: '稠密向量权重' },
    '--sparse-weight': { hasValue: true, description: '稀疏向量权重' },
    '--sql-weight': { hasValue: true, description: 'SQL 权重' }
  },
  positionalCount: 1,
  
  notes: [
    'mode: hybrid(混合)、semantic(语义)、keyword(关键词)、legacy(SQL)',
    'type: d(文档)、p(段落)、h(标题)、l(列表)、i(图片)、tb(表格)、c(代码块)'
  ],
  
  examples: [
    'siyuan search "关键词"',
    'siyuan search "查询" --mode semantic --limit 5',
    'siyuan find "测试" --type d'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.query = parsed.positional[0];
    }
    if (parsed.options.type) args.type = parsed.options.type;
    if (parsed.options.types) args.types = parsed.options.types;
    if (parsed.options.mode) args.mode = parsed.options.mode;
    if (parsed.options.limit) args.limit = parseInt(parsed.options.limit, 10);
    if (parsed.options.path) args.path = parsed.options.path;
    if (parsed.options.notebookId) args.notebookId = parsed.options.notebookId;
    if (parsed.options.sortBy) args.sortBy = parsed.options.sortBy;
    if (parsed.options.hasTags) args.hasTags = true;
    if (parsed.options.where) args.sql = parsed.options.where;
    if (parsed.options.threshold) args.threshold = parseFloat(parsed.options.threshold);
    if (parsed.options.denseWeight) args.denseWeight = parseFloat(parsed.options.denseWeight);
    if (parsed.options.sparseWeight) args.sparseWeight = parseFloat(parsed.options.sparseWeight);
    if (parsed.options.sqlWeight) args.sqlWeight = parseFloat(parsed.options.sqlWeight);
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.query) {
      console.error('错误: 请提供搜索查询');
      console.log('用法: siyuan search <query> [options]');
      process.exit(1);
    }
    
    console.log('搜索内容...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
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
        const isNotFound = pathPermission.reason === 'not_found' || 
                           (pathPermission.error && pathPermission.error.includes('不存在'));
        return {
          success: false,
          error: isNotFound ? '资源不存在' : '权限不足',
          message: pathPermission.error || `无权访问路径 ${path}`,
          reason: isNotFound ? 'not_found' : 'permission_denied'
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
