/**
 * 获取文档结构指令
 * 获取指定笔记本的文档和文件夹结构
 */

const Permission = require('../utils/permission');

/**
 * 指令配置
 */
const command = {
  name: 'get-doc-structure',
  description: '获取指定笔记本的文档和文件夹结构，支持笔记本ID和文档ID',
  usage: 'get-doc-structure --notebook-id <notebookId>',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.notebookId - 笔记本ID或文档ID
   * @returns {Promise<Object>} 文档结构
   */
  async execute(skill, args = {}) {
    const { notebookId } = args;
    
    if (!notebookId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 notebookId 参数'
      };
    }
    
    let actualNotebookId = notebookId;
    let isDocumentId = false;
    let documentId = null;
    
    console.log('获取文档结构...');
    
    try {
      const pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: notebookId });
      
      if (pathInfo) {
        isDocumentId = true;
        documentId = notebookId;
        actualNotebookId = pathInfo.box || pathInfo.notebook;
        console.log(`检测到文档ID ${notebookId}，使用笔记本ID ${actualNotebookId}`);
      } else {
        console.log(`假设 ${notebookId} 是笔记本ID`);
      }
    } catch (error) {
      if (error.message && error.message.includes('tree not found')) {
        console.log(`无法获取文档路径信息，假设 ${notebookId} 是笔记本ID`);
        
        const notebooks = await skill.getNotebooks();
        const notebookExists = notebooks && notebooks.data && 
          notebooks.data.some(nb => nb.id === notebookId);
        
        if (!notebookExists) {
          return {
            success: false,
            error: '笔记本不存在',
            message: `笔记本 ${notebookId} 不存在或无法访问`
          };
        }
      } else {
        console.warn('获取文档路径信息失败:', error.message);
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
      // 如果是文档ID，返回该文档的子文档结构
      if (isDocumentId) {
        return await this.getDocumentStructure(skill, documentId, actualNotebookId);
      }
      
      // 如果是笔记本ID，返回整个笔记本的文档结构
      return await this.getNotebookStructure(skill, actualNotebookId);
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
   * 获取文档的子文档结构
   * @param {Object} skill - 技能实例
   * @param {string} documentId - 文档ID
   * @param {string} notebookId - 笔记本ID
   * @returns {Promise<Object>} 文档结构
   */
  async getDocumentStructure(skill, documentId, notebookId) {
    console.log(`获取文档 ${documentId} 的子文档结构`);
    
    // 获取文档的基本信息
    let docTitle = documentId;
    let docPath = '';
    try {
      const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id: documentId });
      if (attrs && attrs.title) {
        docTitle = attrs.title;
      }
    } catch (error) {
      console.warn('获取文档标题失败:', error.message);
    }
    
    try {
      const pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: documentId });
      if (pathInfo) {
        docPath = pathInfo;
      }
    } catch (error) {
      console.warn('获取文档路径失败:', error.message);
    }
    
    // 获取文档的子块
    const childBlocks = await skill.connector.request('/api/block/getChildBlocks', { id: documentId });
    
    const structure = {
      id: documentId,
      name: docTitle,
      title: docTitle,
      path: docPath,
      notebookId: notebookId,
      type: 'document',
      documents: [],
      folders: []
    };
    
    if (childBlocks && Array.isArray(childBlocks)) {
      for (const block of childBlocks) {
        // 获取块属性
        let blockName = '';
        try {
          const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id: block.id });
          if (attrs && attrs.title) {
            blockName = attrs.title;
          } else {
            blockName = `文档 ${block.id.substring(0, 8)}`;
          }
        } catch (error) {
          console.warn('获取块属性失败:', error.message);
          blockName = `文档 ${block.id.substring(0, 8)}`;
        }
        
        if (block.type === 'd') {
          // 子文档（作为文件夹）
          const subDocStructure = await this.getDocumentStructure(skill, block.id, notebookId);
          structure.folders.push(subDocStructure);
        } else if (block.type === 'p' || block.type === 'h') {
          // 段落或标题（作为文档）
          let docSize = 0;
          try {
            const content = await skill.connector.request('/api/export/exportMdContent', { id: block.id });
            if (content && content.content) {
              docSize = content.content.length;
            }
          } catch (error) {
            console.warn('获取文档大小失败:', error.message);
          }
          
          structure.documents.push({
            id: block.id,
            name: blockName,
            title: blockName,
            path: docPath ? `${docPath}/${blockName}` : blockName,
            updated: block.updated,
            size: docSize
          });
        }
      }
    }
    
    return {
      success: true,
      data: structure,
      timestamp: Date.now(),
      documentCount: structure.documents.length,
      folderCount: structure.folders.length,
      type: 'document'
    };
  },
  
  /**
   * 获取笔记本的文档结构
   * @param {Object} skill - 技能实例
   * @param {string} notebookId - 笔记本ID
   * @returns {Promise<Object>} 文档结构
   */
  async getNotebookStructure(skill, notebookId) {
    // 构建文档结构
    const structure = {
      notebookId: notebookId,
      documents: [],
      folders: []
    };
    
    try {
      // 先尝试打开笔记本
      await skill.connector.request('/api/notebook/openNotebook', { notebook: notebookId });
      
      // 使用 /api/file/readDir 接口列出笔记本目录下的文件
      try {
        const notebookPath = `/data/${notebookId}`;
        const files = await skill.connector.request('/api/file/readDir', { path: notebookPath });
        
        if (files && Array.isArray(files)) {
          for (const file of files) {
            if (file.isDir && file.name !== '.siyuan') {
              // 处理目录
              const folderPath = file.name;
              const folderId = folderPath;
              
              // 递归处理子目录
              const childFiles = await skill.connector.request('/api/file/readDir', { 
                path: `${notebookPath}/${file.name}` 
              });
              const childDocs = [];
              
              if (childFiles && Array.isArray(childFiles)) {
                for (const childFile of childFiles) {
                  if (!childFile.isDir && childFile.name.endsWith('.sy')) {
                    // 处理文档文件
                    const docName = childFile.name.replace('.sy', '');
                    
                    // 尝试获取文档 ID
                    let docId = docName;
                    try {
                      const pathInfo = await skill.connector.request('/api/filetree/getIDsByHPath', {
                        path: `/${file.name}/${docName}`,
                        notebook: notebookId
                      });
                      if (pathInfo && pathInfo.length > 0) {
                        docId = pathInfo[0];
                      }
                    } catch (error) {
                      console.warn('获取文档 ID 失败:', error.message);
                    }
                    
                    // 尝试获取文档标题
                    let docTitle = docName;
                    try {
                      const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id: docId });
                      if (attrs && attrs.title) {
                        docTitle = attrs.title;
                      }
                    } catch (error) {
                      console.warn('获取文档标题失败:', error.message);
                    }
                    
                    // 尝试获取文档大小
                    let docSize = 0;
                    try {
                      const content = await skill.connector.request('/api/export/exportMdContent', { id: docId });
                      if (content && content.content) {
                        docSize = content.content.length;
                      }
                    } catch (error) {
                      console.warn('获取文档大小失败:', error.message);
                    }
                    
                    childDocs.push({
                      id: docId,
                      name: docName,
                      title: docTitle,
                      path: `${folderPath}/${docName}`,
                      updated: childFile.updated,
                      size: docSize
                    });
                  }
                }
              }
              
              structure.folders.push({
                id: folderId,
                name: file.name,
                path: folderPath,
                documents: childDocs,
                folders: []
              });
            } else if (!file.isDir && file.name.endsWith('.sy')) {
              // 处理根目录下的文档
              const docName = file.name.replace('.sy', '');
              
              // 尝试获取文档 ID
              let docId = docName;
              try {
                const pathInfo = await skill.connector.request('/api/filetree/getIDsByHPath', {
                  path: `/${docName}`,
                  notebook: notebookId
                });
                if (pathInfo && pathInfo.length > 0) {
                  docId = pathInfo[0];
                }
              } catch (error) {
                console.warn('获取文档 ID 失败:', error.message);
              }
              
              // 尝试获取文档标题
              let docTitle = docName;
              try {
                const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id: docId });
                if (attrs && attrs.title) {
                  docTitle = attrs.title;
                }
              } catch (error) {
                console.warn('获取文档标题失败:', error.message);
              }
              
              // 尝试获取文档大小
              let docSize = 0;
              try {
                const content = await skill.connector.request('/api/export/exportMdContent', { id: docId });
                if (content && content.content) {
                  docSize = content.content.length;
                }
              } catch (error) {
                console.warn('获取文档大小失败:', error.message);
              }
              
              structure.documents.push({
                id: docId,
                name: docName,
                title: docTitle,
                path: docName,
                updated: file.updated,
                size: docSize
              });
            }
          }
        }
      } catch (error) {
        console.warn('使用 /api/file/readDir 失败，尝试其他方法:', error.message);
        
        // 回退到使用 /api/block/getChildBlocks 接口
        const rootBlocks = await skill.connector.request('/api/block/getChildBlocks', { id: notebookId });
        
        if (rootBlocks && rootBlocks.length > 0) {
          // 递归构建文档结构
          async function buildStructure(blocks, parentPath = '') {
            const docs = [];
            const folders = [];
            
            for (const block of blocks) {
              // 获取块属性，以获取文档标题
              let blockName = '';
              try {
                const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id: block.id });
                if (attrs && attrs.title) {
                  blockName = attrs.title;
                } else {
                  blockName = `文档 ${block.id.substring(0, 8)}`;
                }
              } catch (error) {
                console.warn('获取块属性失败:', error.message);
                blockName = `文档 ${block.id.substring(0, 8)}`;
              }
              
              if (block.type === 'd') {
                // 目录
                const folderPath = parentPath ? `${parentPath}/${blockName}` : blockName;
                const childBlocks = await skill.connector.request('/api/block/getChildBlocks', { id: block.id });
                const childStructure = await buildStructure(childBlocks, folderPath);
                
                folders.push({
                  id: block.id,
                  name: blockName,
                  path: folderPath,
                  documents: childStructure.docs,
                  folders: childStructure.folders
                });
              } else if (block.type === 'p') {
                // 文档
                const docPath = parentPath ? `${parentPath}/${blockName}` : blockName;
                
                // 尝试获取文档大小
                let docSize = 0;
                try {
                  const content = await skill.connector.request('/api/export/exportMdContent', { id: block.id });
                  if (content && content.content) {
                    docSize = content.content.length;
                  }
                } catch (error) {
                  console.warn('获取文档大小失败:', error.message);
                }
                
                docs.push({
                  id: block.id,
                  name: blockName,
                  title: blockName,
                  path: docPath,
                  updated: block.updated,
                  size: docSize
                });
              }
            }
            
            return { docs, folders };
          }
          
          const rootStructure = await buildStructure(rootBlocks);
          structure.documents = rootStructure.docs;
          structure.folders = rootStructure.folders;
        }
      }
      
      return {
        success: true,
        data: structure,
        timestamp: Date.now(),
        documentCount: structure.documents.length,
        folderCount: structure.folders.length,
        type: 'notebook'
      };
    } catch (error) {
      console.error('获取笔记本结构失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取笔记本结构失败'
      };
    }
  }
};

module.exports = command;
