#!/usr/bin/env node
/**
 * content.js - 获取文档内容
 * 
 * 支持多种格式：kramdown、markdown、text、html
 * 支持 docId 或 path 参数
 * 支持 raw 模式直接输出
 */
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: content [<docId>] [选项]

获取指定文档的内容，支持多种输出格式

位置参数:
  docId                文档ID（与 --path 二选一）

选项:
  --path <path>        文档路径（与位置参数二选一）
  --format <fmt>       输出格式：kramdown、markdown、text、html（默认：kramdown）
  --raw                纯文本格式返回（移除JSON外部结构）
  -h, --help           显示帮助信息

示例:
  content 20231030-doc-id
  content --path "/笔记本名/文档名"
  content <id> --format markdown
  content <id> --format text --raw`;

/**
 * Markdown 转纯文本
 * @param {string} markdown - Markdown 文本
 * @returns {string} 纯文本
 */
function markdownToText(markdown) {
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
function markdownToHtml(markdown) {
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
 * 获取笔记本列表
 * @param {SiyuanConnector} connector - 连接器实例
 * @returns {Promise<Array>} 笔记本列表
 */
async function getNotebooks(connector) {
  const result = await connector.request('/api/notebook/lsNotebooks');
  return result && result.notebooks ? result.notebooks : [];
}

/**
 * 通过路径解析文档ID
 * @param {SiyuanConnector} connector - 连接器实例
 * @param {string} path - 文档路径
 * @param {string} defaultNotebook - 默认笔记本ID
 * @returns {Promise<Object>} 解析结果
 */
async function pathToDocId(connector, path, defaultNotebook) {
  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length === 0) {
    return { success: false, error: '无效的路径格式' };
  }

  const notebooks = await getNotebooks(connector);
  let notebookId = defaultNotebook;
  let docPath = '/';

  // 第一部分是笔记本名
  const notebook = notebooks.find(nb => nb.name === pathParts[0]);
  if (notebook) {
    notebookId = notebook.id;
    if (pathParts.length > 1) {
      docPath = '/' + pathParts.slice(1).join('/');
    }
  } else if (pathParts[0].length === 20 && pathParts[0].match(/^\d{4}-\d{8}-\d{4}-[a-z0-9]{4}$/)) {
    // 可能是笔记本ID格式
    notebookId = pathParts[0];
    if (pathParts.length > 1) {
      docPath = '/' + pathParts.slice(1).join('/');
    }
  } else {
    // 使用默认笔记本，路径从第一部分开始
    if (!defaultNotebook) {
      return { success: false, error: '未指定默认笔记本' };
    }
    docPath = '/' + pathParts.join('/');
  }

  // 通过路径获取文档ID
  try {
    const result = await connector.request('/api/filetree/getIDsByHPath', {
      path: docPath,
      notebook: notebookId
    });

    let docId = null;
    if (result && result.rootID) {
      docId = result.rootID;
    } else if (Array.isArray(result) && result.length > 0) {
      docId = result[0];
    }

    if (docId) {
      return {
        success: true,
        data: {
          id: docId,
          notebookId: notebookId,
          path: docPath
        }
      };
    }

    return { success: false, error: '找不到指定路径的文档' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 主入口函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['path', 'format']
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  
  const params = options;
  let docId = null;
  let format = params.format || 'kramdown';
  const raw = params.raw || false;

  if (positionalArgs.length > 0) {
    docId = positionalArgs[0];
  }

  // 参数验证
  if (docId && params.path) {
    console.error('错误: docId 和 --path 参数只能二选一');
    process.exit(1);
  }

  if (!docId && !params.path) {
    console.error('错误: 必须提供 docId 或 --path 参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const validFormats = ['kramdown', 'markdown', 'text', 'html'];
  if (!validFormats.includes(format)) {
    console.error(`错误: format 必须是以下之一: ${validFormats.join(', ')}`);
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    // 处理路径参数
    if (params.path) {
      const pathResult = await pathToDocId(connector, params.path, config.defaultNotebook);
      if (!pathResult.success) {
        console.error('错误:', pathResult.error);
        process.exit(1);
      }
      docId = pathResult.data.id;
    }

    // 获取笔记本ID（用于元数据和权限检查）
    let notebookId = null;
    try {
      const pathInfo = await connector.request('/api/filetree/getPathByID', { id: docId });
      notebookId = pathInfo?.box || pathInfo?.notebook;
    } catch (e) {
      // 忽略错误
    }

    // 权限检查
    if (notebookId) {
      checkPermission(config, notebookId);
    }

    // 根据格式获取内容
    if (format === 'kramdown') {
      const kramdownResult = await connector.request('/api/block/getBlockKramdown', { id: docId });

      if (!kramdownResult || !kramdownResult.kramdown) {
        console.error(`错误: 未找到文档 ${docId} 的 kramdown 内容`);
        process.exit(1);
      }

      const content = kramdownResult.kramdown;

      if (raw) {
        console.log(content);
      } else {
        console.log(JSON.stringify({
          success: true,
          data: {
            id: docId,
            format: 'kramdown',
            content: content,
            length: content.length,
            metadata: {
              notebookId,
              blockId: kramdownResult.id
            }
          },
          timestamp: Date.now()
        }, null, 2));
      }
    } else {
      // markdown, text, html 格式
      const result = await connector.request('/api/export/exportMdContent', { id: docId });

      if (!result || !result.content) {
        console.error(`错误: 未找到文档 ${docId} 的内容`);
        process.exit(1);
      }

      let content = result.content;
      let formattedContent = content;

      if (format === 'text') {
        formattedContent = markdownToText(content);
      } else if (format === 'html') {
        formattedContent = markdownToHtml(content);
      }

      if (raw) {
        console.log(formattedContent);
      } else {
        console.log(JSON.stringify({
          success: true,
          data: {
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
          },
          timestamp: Date.now()
        }, null, 2));
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
