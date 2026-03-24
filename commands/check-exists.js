/**
 * 检查文档是否存在命令
 * 检查指定位置是否存在同名文档
 */

const Permission = require('../utils/permission');

/**
 * 检查文档是否存在
 * @param {Object} skill - SiyuanSkill 实例
 * @param {Object} args - 命令参数
 * @param {string} [args.title] - 文档标题（与 path 二选一）
 * @param {string} [args.parentId] - 父文档ID（可选，配合 title 使用）
 * @param {string} [args.notebookId] - 笔记本ID（可选，不指定则使用默认笔记本）
 * @param {string} [args.path] - 文档路径（与 title 二选一）
 * @returns {Promise<Object>} 检查结果
 */
async function checkExists(skill, args) {
  const { title, parentId, notebookId, path } = args;
  
  console.log('检查文档是否存在...');
  
  if (title && path) {
    return {
      success: false,
      error: '参数冲突',
      message: '--title 和 --path 参数只能二选一，不能同时使用'
    };
  }
  
  if (!title && !path) {
    return {
      success: false,
      error: '缺少必要参数',
      message: '必须提供 --title 或 --path 参数'
    };
  }
  
  // 确定笔记本ID
  let targetNotebookId = notebookId;
  if (!targetNotebookId) {
    if (parentId) {
      // 尝试从父文档获取笔记本ID
      try {
        const pathInfo = await skill.connector.request('/api/filetree/getPathByID', { id: parentId });
        if (pathInfo && pathInfo.notebook) {
          targetNotebookId = pathInfo.notebook;
        }
      } catch (e) {
        console.warn(`无法从父文档 ${parentId} 获取笔记本信息: ${e.message}`);
      }
    }

    // 如果仍未获取到笔记本ID，尝试使用默认配置
    if (!targetNotebookId) {
      targetNotebookId = skill.config?.defaultNotebook || null;
    }
  }

  // 最终验证：确保有有效的笔记本ID
  if (!targetNotebookId || typeof targetNotebookId !== 'string' || targetNotebookId.trim() === '') {
    return {
      success: false,
      error: '缺少笔记本ID',
      message: '请提供 --notebook-id 参数，或设置 SIYUAN_DEFAULT_NOTEBOOK 环境变量，或确保父文档ID有效'
    };
  }
  
  // 方式1：通过路径检查
  if (path) {
    try {
      const existingDocs = await skill.connector.request('/api/filetree/getIDsByHPath', {
        path: path,
        notebook: targetNotebookId
      });
      
      if (existingDocs && existingDocs.length > 0) {
        return {
          success: true,
          exists: true,
          data: {
            id: existingDocs[0],
            path: path,
            notebookId: targetNotebookId
          },
          message: `文档存在，ID: ${existingDocs[0]}`
        };
      }
      
      return {
        success: true,
        exists: false,
        data: {
          path: path,
          notebookId: targetNotebookId
        },
        message: '文档不存在'
      };
    } catch (error) {
      return {
        success: false,
        error: '检查失败',
        message: error.message
      };
    }
  }
  
  // 方式2：通过标题和父ID检查
  const result = await skill.documentManager.checkDocumentExists(
    targetNotebookId,
    parentId || targetNotebookId,
    title
  );
  
  if (result) {
    return {
      success: true,
      exists: true,
      data: result,
      message: `文档存在，ID: ${result.id}，路径: ${result.path}`
    };
  }
  
  return {
    success: true,
    exists: false,
    data: {
      title: title,
      parentId: parentId || null,
      notebookId: targetNotebookId
    },
    message: '文档不存在'
  };
}

/**
 * 命令定义
 */
const command = {
  name: 'exists',
  aliases: ['check', 'check-exists'],
  description: '检查文档是否存在',
  usage: 'siyuan exists (--title <title> [--parent-id <parentId>] | --path <path>) [--notebook-id <notebookId>]',
  examples: [
    'siyuan exists --title "我的文档"',
    'siyuan exists --title "子文档" --parent-id 20260313203048-cjem96v',
    'siyuan exists --path "/测试目录/子文档A"',
    'siyuan check "文档标题"'
  ],
  options: [
    { name: 'title', alias: 't', description: '文档标题', required: false },
    { name: 'parent-id', alias: 'p', description: '父文档ID', required: false },
    { name: 'notebook-id', alias: 'n', description: '笔记本ID', required: false },
    { name: 'path', description: '文档完整路径（如 /目录/子文档）', required: false }
  ],
  execute: checkExists
};

module.exports = command;
