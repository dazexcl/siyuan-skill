/**
 * 移动文档指令
 * 将文档从一个目录迁移到另一个目录位置
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 根据人类可读路径获取文档 ID
 */
async function getDocIdByHPath(skill, hPath) {
  try {
    console.log('通过路径查找文档 ID:', hPath);
    
    const pathParts = hPath.split('/').filter(p => p.trim() !== '');
    if (pathParts.length === 0) {
      return null;
    }
    
    const notebooksResult = await skill.connector.request('/api/notebook/lsNotebooks', {});
    if (!notebooksResult || !notebooksResult.notebooks) {
      console.error('获取笔记本列表失败');
      return null;
    }
    
    let notebookId = null;
    for (const nb of notebooksResult.notebooks) {
      if (nb.name === pathParts[0] || nb.id === pathParts[0]) {
        notebookId = nb.id;
        break;
      }
    }
    
    if (!notebookId) {
      console.error('未找到笔记本:', pathParts[0]);
      return null;
    }
    
    if (pathParts.length === 1) {
      return notebookId;
    }
    
    const relativePath = '/' + pathParts.slice(1).join('/');
    
    const result = await skill.connector.request('/api/filetree/getIDsByHPath', {
      notebook: notebookId,
      path: relativePath
    });
    
    if (result && Array.isArray(result) && result.length > 0) {
      console.log('找到文档 ID:', result[0], '路径:', hPath);
      return result[0];
    }
    
    console.warn('未找到路径对应的文档 ID:', hPath);
    return null;
  } catch (error) {
    console.error('通过路径获取文档 ID 失败:', error.message);
    return null;
  }
}

/**
 * 判断是否为路径格式
 */
function isPathFormat(value) {
  return value && (value.startsWith('/') || value.includes('/'));
}

/**
 * 指令配置
 */
const command = {
  name: 'move',
  aliases: ['mv'],
  description: '移动文档到另一个目录',
  usage: 'siyuan move <docId> <targetParentId>',
  sortOrder: 95,
  
  initOptions: {},
  options: {
    '--target': { hasValue: true, aliases: ['--to', '-T'], description: '目标父目录ID' },
    '--new-title': { hasValue: true, aliases: ['-t'], description: '新标题（可选）' }
  },
  positionalCount: 2,
  
  notes: [
    '目标位置可以是笔记本ID或文档ID'
  ],
  
  examples: [
    'siyuan move <id> <parentId>',
    'siyuan move <id> <parentId> --new-title "新标题"'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.docId = parsed.positional[0];
    }
    if (parsed.positional.length > 1) {
      args.targetParentId = parsed.positional[1];
    }
    if (parsed.options.target) args.targetParentId = parsed.options.target;
    if (parsed.options.newTitle) args.newTitle = parsed.options.newTitle;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.docId) {
      console.error('错误: 请提供文档ID');
      console.log('用法: siyuan move <docId> <targetParentId>');
      process.exit(1);
    }
    
    if (!executeArgs.targetParentId) {
      console.error('错误: 请提供目标位置');
      console.log('用法: siyuan move <docId> <targetParentId>');
      process.exit(1);
    }
    
    console.log('移动文档...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  async execute(skill, args = {}) {
    let { docId, targetParentId, newTitle } = args;
    
    if (!docId || !targetParentId) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 docId 和 targetParentId 参数'
      };
    }
    
    try {
      let originalDocPath = null;
      let originalTargetPath = null;
      
      if (isPathFormat(docId)) {
        originalDocPath = docId;
        docId = await getDocIdByHPath(skill, docId);
        if (!docId) {
          return {
            success: false,
            error: '未找到源文档',
            message: `无法通过路径找到源文档：${originalDocPath}`
          };
        }
      }
      
      if (isPathFormat(targetParentId)) {
        originalTargetPath = targetParentId;
        targetParentId = await getDocIdByHPath(skill, targetParentId);
        if (!targetParentId) {
          return {
            success: false,
            error: '未找到目标位置',
            message: `无法通过路径找到目标位置：${originalTargetPath}`
          };
        }
      }
      
      const sourcePermission = await Permission.checkDocumentPermission(skill, docId);
      if (!sourcePermission.hasPermission) {
        const isNotFound = sourcePermission.reason === 'not_found' || 
                           (sourcePermission.error && sourcePermission.error.includes('不存在'));
        return {
          success: false,
          error: isNotFound ? '资源不存在' : '权限不足',
          message: sourcePermission.error || `无权访问文档 ${docId}`,
          reason: isNotFound ? 'not_found' : 'permission_denied'
        };
      }
      
      const targetPermission = await Permission.checkParentPermission(skill, targetParentId, skill.config.defaultNotebook);
      if (!targetPermission.hasPermission) {
        const isNotFound = targetPermission.reason === 'not_found' || 
                           (targetPermission.error && targetPermission.error.includes('不存在'));
        return {
          success: false,
          error: isNotFound ? '资源不存在' : '权限不足',
          message: targetPermission.error || `无权访问目标位置 ${targetParentId}`,
          reason: isNotFound ? 'not_found' : 'permission_denied'
        };
      }
      
      let titleToUse = newTitle;
      if (!titleToUse) {
        try {
          const attrs = await skill.connector.request('/api/attr/getBlockAttrs', { id: docId });
          if (attrs && attrs.title) {
            titleToUse = attrs.title;
          }
        } catch (error) {
          console.warn('获取文档标题失败:', error.message);
        }
      }
      
      const existingDoc = await skill.documentManager.checkDocumentExists(
        targetPermission.notebookId,
        targetParentId,
        titleToUse,
        docId
      );
      
      if (existingDoc) {
        return {
          success: false,
          error: '目标位置已存在同名文档',
          message: `在目标位置已存在标题为"${titleToUse}"的文档（ID: ${existingDoc.id}），无法移动。请使用 --new-title 参数指定新标题`
        };
      }
      
      console.log('移动文档:', {
        docId: docId,
        from: originalDocPath || docId,
        to: originalTargetPath || targetParentId,
        newTitle: titleToUse || '(保持原样)'
      });
      
      console.log('调用 moveDocsByID API:', { fromIDs: [docId], toID: targetParentId });
      const moveResult = await skill.connector.request('/api/filetree/moveDocsByID', {
        fromIDs: [docId],
        toID: targetParentId
      });
      
      console.log('移动文档 API 返回结果:', moveResult);
      
      if (moveResult && moveResult.code === 0) {
        console.log('移动成功！');
      } else if (moveResult === null || (moveResult && moveResult.code === 0)) {
        console.log('API 返回 null 或 code=0，移动操作已执行');
      } else {
        console.error('移动失败:', moveResult);
      }
      
      if (newTitle) {
        console.log('重命名文档为:', newTitle);
        try {
          const renameResult = await skill.connector.request('/api/filetree/renameDocByID', {
            id: docId,
            title: newTitle
          });
          console.log('重命名结果:', renameResult);
        } catch (error) {
          console.warn('重命名文档失败:', error.message);
        }
      }
      
      let newPath = null;
      try {
        const newPathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: docId });
        if (newPathInfo) {
          newPath = newPathInfo;
        }
      } catch (error) {
        console.warn('获取新路径信息失败:', error.message);
      }
      
      return {
        success: true,
        data: {
          id: docId,
          from: originalDocPath || null,
          to: newPath?.path || null,
          targetParentId,
          originalTargetPath: originalTargetPath,
          newTitle: newTitle || null,
          moved: true
        },
        message: '文档迁移成功',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('迁移文档失败:', error);
      return {
        success: false,
        error: error.message,
        message: '迁移文档失败'
      };
    }
  }
};

module.exports = command;
