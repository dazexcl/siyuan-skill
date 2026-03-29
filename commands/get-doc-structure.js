/**
 * 获取文档结构指令
 * 获取指定笔记本的文档和文件夹结构
 */

const Permission = require('../utils/permission');
const { pathToId } = require('./convert-path');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 指令配置
 */
const command = {
  name: 'structure',
  aliases: ['ls'],
  description: '获取笔记本/文档结构（目录树）',
  usage: 'siyuan structure [<id>] [--path <path>] [--depth <n>]',
  sortOrder: 20,
  
  initOptions: {},
  options: {
    '--path': { hasValue: true, aliases: ['-P'], description: '文档路径' },
    '--depth': { hasValue: true, aliases: ['-d'], description: '递归深度（默认1，-1无限）' }
  },
  positionalCount: 1,
  
  notes: [
    '位置参数为笔记本ID或文档ID',
    'path 与位置参数二选一'
  ],
  
  examples: [
    'siyuan structure <notebook-id>',
    'siyuan ls --path "/笔记本名"',
    'siyuan ls --depth 2 <id>'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.notebookId = parsed.positional[0];
    }
    if (parsed.options.path) args.path = parsed.options.path;
    if (parsed.options.depth) args.depth = parseInt(parsed.options.depth, 10);
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.notebookId && !executeArgs.path) {
      console.error('错误: 请提供笔记本ID/文档ID 或 --path 参数');
      console.log('用法: siyuan structure [<notebookId|docId>] [--path <path>]');
      process.exit(1);
    }
    if (executeArgs.notebookId && executeArgs.path) {
      console.error('错误: 位置参数和 --path 不能同时使用');
      console.log('用法: siyuan structure [<notebookId|docId>] 或 siyuan structure --path <path>');
      process.exit(1);
    }
    
    console.log('获取文档结构...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  async execute(skill, args = {}) {
    const { notebookId, path, depth = 1 } = args;
    
    if (!notebookId && !path) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 notebookId 或 path 参数'
      };
    }
    
    if (notebookId && path) {
      return {
        success: false,
        error: '参数冲突',
        message: 'notebookId 和 path 参数只能提供一个'
      };
    }
    
    let actualNotebookId = notebookId;
    let isDocumentId = false;
    let documentId = null;
    let startPath = '/';
    
    console.log('获取文档结构...');
    
    if (path) {
      console.log('解析路径:', path);
      const defaultNb = skill.config.defaultNotebook;
      const pathResult = await pathToId(skill.connector, path, true, defaultNb);
      
      if (!pathResult.success) {
        return {
          success: false,
          error: pathResult.error,
          message: pathResult.message
        };
      }
      
      const pathData = pathResult.data;
      if (pathData.type === 'notebook') {
        actualNotebookId = pathData.id;
        console.log(`路径 "${path}" 解析为笔记本ID: ${actualNotebookId}`);
      } else {
        actualNotebookId = pathData.notebook || pathData.parentId;
        documentId = pathData.id;
        isDocumentId = true;
        startPath = pathData.path || '/';
        console.log(`路径 "${path}" 解析为文档ID: ${documentId}, 笔记本ID: ${actualNotebookId}`);
      }
    }
    
    if (!path && notebookId) {
      try {
        const pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: notebookId });
        
        if (pathInfo) {
          isDocumentId = true;
          documentId = notebookId;
          actualNotebookId = pathInfo.box || pathInfo.notebook;
          startPath = pathInfo.path || '/';
          console.log(`检测到文档ID ${notebookId}，使用笔记本ID ${actualNotebookId}`);
        } else {
          const notebooks = await skill.getNotebooks();
          const notebookExists = notebooks && notebooks.data && 
            notebooks.data.some(nb => nb.id === notebookId);
          
          if (notebookExists) {
            console.log(`检测到笔记本ID ${notebookId}`);
          } else {
            return {
              success: false,
              error: '资源不存在',
              message: `文档或笔记本不存在: ${notebookId}`,
              reason: 'not_found'
            };
          }
        }
      } catch (error) {
        if (error.message && error.message.includes('tree not found')) {
          console.log(`无法获取文档路径信息，验证是否为笔记本ID`);
          
          const notebooks = await skill.getNotebooks();
          const notebookExists = notebooks && notebooks.data && 
            notebooks.data.some(nb => nb.id === notebookId);
          
          if (notebookExists) {
            console.log(`检测到笔记本ID ${notebookId}`);
          } else {
            return {
              success: false,
              error: '资源不存在',
              message: `文档或笔记本不存在: ${notebookId}`,
              reason: 'not_found'
            };
          }
        } else {
          console.warn('获取文档路径信息失败:', error.message);
        }
      }
    }
    
    const notebookPermission = Permission.checkNotebookPermission(skill, actualNotebookId);
    if (!notebookPermission.hasPermission) {
      return {
        success: false,
        error: '权限不足',
        message: notebookPermission.error
      };
    }
    
    try {
      await skill.connector.request('/api/notebook/openNotebook', { notebook: actualNotebookId });
      
      const structure = await this.buildDocStructure(skill, actualNotebookId, startPath, depth);
      
      return {
        success: true,
        data: structure,
        timestamp: Date.now(),
        documentCount: this.countDocuments(structure),
        folderCount: this.countFolders(structure),
        type: isDocumentId ? 'doc' : 'notebook'
      };
    } catch (error) {
      console.error('获取文档结构失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取文档结构失败'
      };
    }
  },
  
  /**
   * 构建文档结构
   */
  async buildDocStructure(skill, notebookId, startPath = '/', depth = 1, parentHPath = '') {
    const structure = {
      notebookId: notebookId,
      path: startPath,
      hpath: parentHPath || '/',
      documents: [],
      folders: []
    };
    
    if (depth === 0) {
      return structure;
    }
    
    try {
      const result = await skill.connector.request('/api/filetree/listDocsByPath', {
        notebook: notebookId,
        path: startPath
      });
      
      if (!result || !result.files || !Array.isArray(result.files)) {
        console.log(`路径 ${startPath} 下没有文档`);
        return structure;
      }
      
      for (const file of result.files) {
        const docName = file.name.replace(/\.sy$/, '');
        const docPath = file.path;
        const docId = file.id;
        const hasChildren = file.subFileCount > 0;
        const docHPath = parentHPath ? `${parentHPath}/${docName}` : `/${docName}`;
        
        const docInfo = {
          id: docId,
          title: docName,
          path: docPath,
          hpath: docHPath,
          updated: file.mtime ? new Date(file.mtime * 1000).toISOString() : null,
          created: file.ctime ? new Date(file.ctime * 1000).toISOString() : null,
          size: file.size || 0
        };
        
        if (hasChildren && depth !== 1) {
          console.log(`获取子文档: ${docPath}`);
          const childStructure = await this.buildDocStructure(
            skill, 
            notebookId, 
            docPath, 
            depth === -1 ? -1 : depth - 1,
            docHPath
          );
          
          structure.folders.push({
            ...docInfo,
            type: 'folder',
            documents: childStructure.documents,
            folders: childStructure.folders,
            subFileCount: file.subFileCount
          });
        } else {
          structure.documents.push({
            ...docInfo,
            type: 'doc',
            hasChildren: hasChildren,
            subFileCount: file.subFileCount || 0
          });
        }
      }
      
      return structure;
    } catch (error) {
      console.error(`获取路径 ${startPath} 的文档结构失败:`, error.message);
      return structure;
    }
  },
  
  /**
   * 统计文档数量
   */
  countDocuments(structure) {
    let count = structure.documents ? structure.documents.length : 0;
    if (structure.folders) {
      for (const folder of structure.folders) {
        count += this.countDocuments(folder);
      }
    }
    return count;
  },
  
  /**
   * 统计文件夹数量
   */
  countFolders(structure) {
    let count = structure.folders ? structure.folders.length : 0;
    if (structure.folders) {
      for (const folder of structure.folders) {
        count += this.countFolders(folder);
      }
    }
    return count;
  },
  
  /**
   * 获取文档的子文档结构（兼容旧接口）
   */
  async getDocumentStructure(skill, documentId, notebookId) {
    let docPath = '/';
    let docTitle = documentId;
    
    try {
      const pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: documentId });
      if (pathInfo) {
        docPath = pathInfo.path || '/';
        docTitle = pathInfo.title || documentId;
      }
    } catch (error) {
      console.warn('获取文档路径失败:', error.message);
    }
    
    const structure = await this.buildDocStructure(skill, notebookId, docPath, 2);
    
    return {
      success: true,
      data: {
        id: documentId,
        title: docTitle,
        path: docPath,
        notebookId: notebookId,
        type: 'doc',
        documents: structure.documents,
        folders: structure.folders
      },
      timestamp: Date.now(),
      documentCount: structure.documents.length,
      folderCount: structure.folders.length,
      type: 'doc'
    };
  },
  
  /**
   * 获取笔记本的文档结构（兼容旧接口）
   */
  async getNotebookStructure(skill, notebookId) {
    const structure = await this.buildDocStructure(skill, notebookId, '/', 2);
    
    return {
      success: true,
      data: structure,
      timestamp: Date.now(),
      documentCount: this.countDocuments(structure),
      folderCount: this.countFolders(structure),
      type: 'notebook'
    };
  }
};

module.exports = command;
