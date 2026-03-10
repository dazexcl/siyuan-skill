/**
 * 文档管理器
 * 提供文档相关的核心功能
 */

/**
 * DocumentManager 类
 * 管理文档的获取、创建、更新、删除等操作
 */
class DocumentManager {
  /**
   * 构造函数
   * @param {Object} connector - Siyuan 连接器实例
   * @param {Object} cacheManager - 缓存管理器实例
   */
  constructor(connector, cacheManager) {
    this.connector = connector;
    this.cacheManager = cacheManager;
  }

  /**
   * 获取文档结构
   * @param {string} notebookId - 笔记本ID
   * @param {boolean} [forceRefresh=false - 是否强制刷新缓存
   * @returns {Promise<Object>} 文档结构
   */
  async getDocStructure(notebookId, forceRefresh = false) {
    const cacheKey = `doc_structure_${notebookId}`;

    if (!forceRefresh && this.cacheManager.has(cacheKey)) {
      return {
        success: true,
        data: this.cacheManager.get(cacheKey),
        cached: true
      };
    }

    await this.connector.request('/api/notebook/openNotebook', { notebook: notebookId });

    const structure = await this.buildDocStructure(notebookId);

    this.cacheManager.set(cacheKey, structure);

    return {
      success: true,
      data: structure,
      cached: false
    };
  }

  /**
   * 构建文档结构
   * @param {string} notebookId - 笔记本ID
   * @returns {Promise<Object>} 文档结构
   */
  async buildDocStructure(notebookId) {
    const structure = {
      notebookId,
      documents: [],
      folders: []
    };

    try {
      const notebookPath = `/data/${notebookId}`;
      const files = await this.connector.request('/api/file/readDir', { path: notebookPath });

      if (files && Array.isArray(files)) {
        for (const file of files) {
          if (file.isDir && file.name !== '.siyuan') {
            const folder = await this.processFolder(notebookId, file, notebookPath);
            structure.folders.push(folder);
          } else if (!file.isDir && file.name.endsWith('.sy')) {
            const doc = await this.processDocument(notebookId, file, '');
            structure.documents.push(doc);
          }
        }
      }
    } catch (error) {
      const rootBlocks = await this.connector.request('/api/block/getChildBlocks', { id: notebookId });
      if (rootBlocks && rootBlocks.length > 0) {
        const rootStructure = await this.buildStructureFromBlocks(rootBlocks, '');
        structure.documents = rootStructure.docs;
        structure.folders = rootStructure.folders;
      }
    }

    return structure;
  }

  /**
   * 处理文件夹
   * @param {string} notebookId - 笔记本ID
   * @param {Object} file - 文件对象
   * @param {string} notebookPath - 笔记本路径
   * @returns {Promise<Object>} 文件夹对象
   */
  async processFolder(notebookId, file, notebookPath) {
    const folderPath = file.name;
    const childFiles = await this.connector.request('/api/file/readDir', { 
      path: `${notebookPath}/${file.name}` 
    });
    const childDocs = [];

    if (childFiles && Array.isArray(childFiles)) {
      for (const childFile of childFiles) {
        if (!childFile.isDir && childFile.name.endsWith('.sy')) {
          const doc = await this.processDocument(notebookId, childFile, folderPath);
          childDocs.push(doc);
        }
      }
    }

    return {
      id: folderPath,
      name: file.name,
      path: folderPath,
      documents: childDocs,
      folders: []
    };
  }

  /**
   * 处理文档
   * @param {string} notebookId - 笔记本ID
   * @param {Object} file - 文件对象
   * @param {string} parentPath - 父路径
   * @returns {Promise<Object>} 文档对象
   */
  async processDocument(notebookId, file, parentPath) {
    const docName = file.name.replace('.sy', '');
    const docPath = parentPath ? `${parentPath}/${docName}` : docName;

    let docId = docName;
    let docTitle = docName;
    let docSize = 0;

    try {
      const pathInfo = await this.connector.request('/api/filetree/getIDsByHPath', {
        path: `/${docPath}`,
        notebook: notebookId
      });
      if (pathInfo && pathInfo.length > 0) {
        docId = pathInfo[0];
      }
    } catch (e) {
      // 忽略错误
    }

    try {
      const attrs = await this.connector.request('/api/attr/getBlockAttrs', { id: docId });
      if (attrs && attrs.title) {
        docTitle = attrs.title;
      }
    } catch (e) {
      // 忽略错误
    }

    try {
      const content = await this.connector.request('/api/export/exportMdContent', { id: docId });
      if (content && content.content) {
        docSize = content.content.length;
      }
    } catch (e) {
      // 忽略错误
    }

    return {
      id: docId,
      name: docName,
      title: docTitle,
      path: docPath,
      updated: file.updated,
      size: docSize
    };
  }

  /**
   * 从块构建结构
   * @param {Array} blocks - 块数组
   * @param {string} parentPath - 父路径
   * @returns {Promise<Object>} 结构对象
   */
  async buildStructureFromBlocks(blocks, parentPath) {
    const docs = [];
    const folders = [];

    for (const block of blocks) {
      let blockName = `文档 ${block.id.substring(0, 8)}`;
      try {
        const attrs = await this.connector.request('/api/attr/getBlockAttrs', { id: block.id });
        if (attrs && attrs.title) {
          blockName = attrs.title;
        }
      } catch (e) {
        // 忽略错误
      }

      if (block.type === 'd') {
        const folderPath = parentPath ? `${parentPath}/${blockName}` : blockName;
        const childBlocks = await this.connector.request('/api/block/getChildBlocks', { id: block.id });
        const childStructure = await this.buildStructureFromBlocks(childBlocks, folderPath);
        folders.push({
          id: block.id,
          name: blockName,
          path: folderPath,
          documents: childStructure.docs,
          folders: childStructure.folders
        });
      } else if (block.type === 'p') {
        const docPath = parentPath ? `${parentPath}/${blockName}` : blockName;
        let docSize = 0;
        try {
          const content = await this.connector.request('/api/export/exportMdContent', { id: block.id });
          if (content && content.content) {
            docSize = content.content.length;
          }
        } catch (e) {
          // 忽略错误
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

  /**
   * 获取文档内容
   * @param {string} docId - 文档ID
   * @param {string} [format='markdown'] - 格式
   * @returns {Promise<Object>} 文档内容
   */
  async getDocContent(docId, format = 'markdown') {
    const result = await this.connector.request('/api/export/exportMdContent', { id: docId });

    if (!result || !result.content) {
      throw new Error('文档内容为空');
    }

    let content = result.content;
    let formattedContent = content;

    if (format === 'text') {
      formattedContent = this.markdownToText(content);
    } else if (format === 'html') {
      formattedContent = this.markdownToHtml(content);
    }

    let notebookId = null;
    try {
      const pathInfo = await this.connector.request('/api/filetree/getPathByID', { id: docId });
      if (pathInfo && pathInfo.box) {
        notebookId = pathInfo.box;
      }
    } catch (e) {
      // 忽略错误
    }

    return {
      id: docId,
      hPath: result.hPath || '',
      format,
      content: formattedContent,
      originalLength: content.length,
      formattedLength: formattedContent.length,
      metadata: {
        notebookId,
        path: result.hPath
      }
    };
  }

  /**
   * Markdown 转纯文本
   * @param {string} markdown - Markdown 文本
   * @returns {string} 纯文本
   */
  markdownToText(markdown) {
    return markdown
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/`(.*?)`/g, '$1')
      .replace(/^-\s/gm, '')
      .replace(/^\d+\.\s/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Markdown 转 HTML
   * @param {string} markdown - Markdown 文本
   * @returns {string} HTML 文本
   */
  markdownToHtml(markdown) {
    return markdown
      .replace(/#{6}\s(.*?)$/gm, '<h6>$1</h6>')
      .replace(/#{5}\s(.*?)$/gm, '<h5>$1</h5>')
      .replace(/#{4}\s(.*?)$/gm, '<h4>$1</h4>')
      .replace(/#{3}\s(.*?)$/gm, '<h3>$1</h3>')
      .replace(/#{2}\s(.*?)$/gm, '<h2>$1</h2>')
      .replace(/#{1}\s(.*?)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/^-\s(.*?)$/gm, '<li>$1</li>')
      .replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>')
      .replace(/^\d+\.\s(.*?)$/gm, '<li>$1</li>')
      .replace(/(<li>.*?<\/li>)/s, '<ol>$1</ol>')
      .replace(/\n/g, '<br>');
  }

  /**
   * 创建文档
   * @param {string} parentId - 父ID
   * @param {string} title - 标题
   * @param {string} [content=''] - 内容
   * @returns {Promise<Object>} 创建结果
   */
  async createDocument(parentId, title, content = '') {
    // 根据parentId判断是笔记本ID还是文档ID
    // 笔记本ID格式：包含字母和数字的混合字符串（如：20260305223500-s269bt3）
    // 文档ID格式：类似，但需要检查是否为笔记本
    
    // 尝试获取parentId的信息，确定是否为笔记本
    let notebookId;
    let docPath = `/${title}`;
    
    try {
      // 尝试获取路径信息，判断parentId是文档还是笔记本
      const pathInfo = await this.connector.request('/api/filetree/getPathByID', { id: parentId });
      
      if (pathInfo && pathInfo.box) {
        // 如果是笔记本ID（直接有box字段）
        notebookId = parentId;
        docPath = `/${title}`;
      } else {
        // 如果是文档ID，获取其笔记本ID
        notebookId = pathInfo?.box || process.env.SIYUAN_DEFAULT_NOTEBOOK;
        // 获取父文档的路径，用于构建完整路径
        const parentDocPath = await this.connector.request('/api/export/exportMdContent', { id: parentId });
        if (parentDocPath && parentDocPath.hPath) {
          docPath = `${parentDocPath.hPath}/${title}`;
        } else {
          // 回退到默认路径
          docPath = `/${title}`;
        }
      }
    } catch (error) {
      // 如果无法获取路径信息，使用默认笔记本
      notebookId = process.env.SIYUAN_DEFAULT_NOTEBOOK || parentId;
    }
    
    // 如果没有有效的笔记本ID，使用默认配置
    if (!notebookId) {
      notebookId = '20260227231831-yq1lxq2'; // 使用项目规则中的默认笔记本
    }
    
    const result = await this.connector.request('/api/filetree/createDocWithMd', {
      notebook: notebookId,
      path: docPath,
      markdown: content
    });

    return {
      id: result
    };
  }

  /**
   * 更新文档
   * @param {string} docId - 文档ID
   * @param {string} content - 内容
   * @returns {Promise<Object>} 更新结果
   */
  async updateDocument(docId, content) {
    await this.connector.request('/api/filetree/updateBlock', {
      id: docId,
      dataType: 'markdown',
      data: content
    });

    return { success: true };
  }

  /**
   * 删除文档
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteDocument(docId) {
    const result = await this.connector.request('/api/filetree/removeDocByID', {
      id: docId
    });

    return { success: true, data: result };
  }

  /**
   * 插入块
   * @param {string} data - 块内容
   * @param {string} [dataType='markdown'] - 数据类型
   * @param {string} [parentId=''] - 父块ID
   * @param {string} [previousId=''] - 前一个块ID
   * @param {string} [nextId=''] - 后一个块ID
   * @returns {Promise<Object>} 插入结果
   */
  async insertBlock(data, dataType = 'markdown', parentId = '', previousId = '', nextId = '') {
    const result = await this.connector.request('/api/block/insertBlock', {
      dataType,
      data,
      parentID: parentId,
      previousID: previousId,
      nextID: nextId
    });
    
    return {
      success: result && result.code === 0,
      data: result?.data?.[0]?.doOperations?.[0],
      error: result?.msg
    };
  }

  /**
   * 更新块
   * @param {string} id - 块ID
   * @param {string} data - 新内容
   * @param {string} [dataType='markdown'] - 数据类型
   * @returns {Promise<Object>} 更新结果
   */
  async updateBlock(id, data, dataType = 'markdown') {
    const result = await this.connector.request('/api/block/updateBlock', {
      id,
      dataType,
      data
    });
    
    return {
      success: result && result.code === 0,
      error: result?.msg
    };
  }

  /**
   * 删除块
   * @param {string} id - 块ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteBlock(id) {
    const result = await this.connector.request('/api/block/deleteBlock', { id });
    
    return {
      success: result && result.code === 0,
      error: result?.msg
    };
  }

  /**
   * 移动块
   * @param {string} id - 块ID
   * @param {string} [parentId=''] - 目标父块ID
   * @param {string} [previousId=''] - 目标前一个块ID
   * @returns {Promise<Object>} 移动结果
   */
  async moveBlock(id, parentId = '', previousId = '') {
    const result = await this.connector.request('/api/block/moveBlock', {
      id,
      parentID: parentId,
      previousID: previousId
    });
    
    return {
      success: result && result.code === 0,
      error: result?.msg
    };
  }

  /**
   * 获取块 kramdown 源码
   * @param {string} id - 块ID
   * @returns {Promise<Object>} 块信息
   */
  async getBlockKramdown(id) {
    const result = await this.connector.request('/api/block/getBlockKramdown', { id });
    
    return {
      success: result && result.code === 0,
      data: result?.data,
      error: result?.msg
    };
  }

  /**
   * 获取子块列表
   * @param {string} id - 块ID
   * @returns {Promise<Object>} 子块列表
   */
  async getChildBlocks(id) {
    const result = await this.connector.request('/api/block/getChildBlocks', { id });
    
    return {
      success: result && result.code === 0,
      data: result?.data,
      error: result?.msg
    };
  }

  /**
   * 设置块属性
   * @param {string} id - 块ID
   * @param {Object} attrs - 属性对象
   * @returns {Promise<Object>} 设置结果
   */
  async setBlockAttrs(id, attrs) {
    const result = await this.connector.request('/api/attr/setBlockAttrs', {
      id,
      attrs
    });
    
    return {
      success: result && result.code === 0,
      error: result?.msg
    };
  }

  /**
   * 获取块属性
   * @param {string} id - 块ID
   * @returns {Promise<Object>} 块属性
   */
  async getBlockAttrs(id) {
    const result = await this.connector.request('/api/attr/getBlockAttrs', { id });
    
    return {
      success: result && result.code === 0,
      data: result?.data,
      error: result?.msg
    };
  }
}

module.exports = DocumentManager;
