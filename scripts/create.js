#!/usr/bin/env node
/**
 * create.js - 创建新文档
 * 
 * 支持两种创建方式：
 * - 通过 parentId 在指定父文档下创建
 * - 通过 path 在指定路径创建（自动创建中间目录）
 */
const ConfigManager = require('./lib/config');
const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const fs = require('fs');

const HELP_TEXT = `用法: create <title> [选项]

在 Siyuan Notes 中创建新文档

位置参数:
  title                   文档标题

选项:
  -p, --parent-id <id>   父文档/笔记本ID（不能是内容块ID）
  -P, --path <path>      文档路径（与 --parent-id 二选一，路径首位支持笔记本名称或ID）
  -c, --content <text>   文档内容
  -f, --file <path>      从文件读取内容
  --force                强制创建（忽略重名检测）
  -h, --help             显示帮助信息

示例:
  create "我的文档" -p <notebook-id>
  create "标题" --parent-id <doc-id> --content "内容"
  create "标题" --path "/笔记本名/目录/文档名"
  create "子文档" --path "/笔记本名/目录/" --force
  create "文档" --file content.md --parent-id <id>

注意:
  - 使用 --parent-id 时，参数可以是笔记本ID或文档ID，但不能是内容块ID
  - 使用 --path 时，路径首位支持笔记本名称或笔记本ID`;

/** 短选项到长选项的映射 */
const SHORT_OPTS = { p: 'parentId', P: 'path', c: 'content', f: 'file' };

/**
 * 将短横线命名转为驼峰命名
 * @param {string} str - 输入字符串
 * @returns {string} 驼峰命名字符串
 */
function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 解析命令行参数
 * @param {string[]} argv - 命令行参数数组
 * @returns {Object} 解析后的参数对象
 */
function parseArgs(argv) {
  const positional = [];
  const options = {};
  const hasValueOpts = new Set(['parentId', 'path', 'content', 'file']);

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > -1) {
        options[camelCase(arg.slice(2, eqIndex))] = arg.slice(eqIndex + 1);
      } else {
        const key = camelCase(arg.slice(2));
        if (hasValueOpts.has(key) && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
          options[key] = argv[++i];
        } else {
          options[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const shortKey = SHORT_OPTS[arg[1]];
      if (shortKey && i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        options[shortKey] = argv[++i];
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, ...options };
}

/**
 * 处理内容中的换行符
 * @param {string} content - 原始内容
 * @returns {string} 处理后的内容
 */
function processContent(content) {
  return content ? content.replace(/\\n/g, '\n') : '';
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
 * @param {string} force - 是否强制返回第一个结果
 * @returns {Promise<Object>} 解析结果
 */
async function pathToId(connector, path, force = false) {
  const pathParts = path.split('/').filter(p => p);
  if (pathParts.length === 0) {
    return { success: false, error: '无效的路径格式' };
  }

  const notebooks = await getNotebooks(connector);
  const notebook = notebooks.find(nb => nb.name === pathParts[0]);
  if (!notebook) {
    return { success: false, error: `找不到笔记本 "${pathParts[0]}"` };
  }

  if (pathParts.length === 1) {
    return { success: true, data: { id: notebook.id, type: 'notebook', notebookId: notebook.id } };
  }

  const relativePath = '/' + pathParts.slice(1).join('/');
  try {
    const result = await connector.request('/api/filetree/getIDsByHPath', {
      notebook: notebook.id,
      path: relativePath
    });

    if (result && Array.isArray(result) && result.length > 0) {
      if (result.length > 1 && !force) {
        return { success: false, error: `找到 ${result.length} 个匹配的文档` };
      }
      return { success: true, data: { id: result[0], type: 'document', notebookId: notebook.id } };
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
  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const params = parseArgs(args);
  if (params.positional.length > 0) {
    params.title = params.positional[0];
    // 第二个位置参数作为内容（如果没有通过 --content 指定）
    if (params.positional.length > 1 && !params.content) {
      params.content = params.positional[1];
    }
  }
  delete params.positional;

  // 如果使用 --path 模式，可以不提供 title 参数（从路径中提取）
  if (!params.title && !params.path) {
    console.error('错误: 缺少必需的标题参数');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (params.parentId && params.path) {
    console.error('错误: --parent-id 和 --path 参数只能二选一');
    process.exit(1);
  }

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();
    const connector = new SiyuanConnector({
      baseURL: config.baseURL,
      token: config.token,
      timeout: config.timeout,
      tls: config.tls
    });

    let notebookId = null;
    let parentId = null;
    let fullPath = '';
    let displayTitle = params.title || null;

    // 处理路径模式
    if (params.path) {
      const pathEndsWithSlash = params.path.endsWith('/');
      const pathComponents = params.path.split('/').filter(c => c.trim());

      if (pathComponents.length === 0) {
        console.error('错误: 路径不能为空');
        process.exit(1);
      }

      // 获取笔记本列表
      const notebooks = await getNotebooks(connector);

      // 验证第一个组件是笔记本名称或ID
      const notebook = notebooks.find(nb => nb.name === pathComponents[0]);
      const notebookById = notebooks.find(nb => nb.id === pathComponents[0]);

      if (notebook) {
        // 使用笔记本名称
        notebookId = notebook.id;
        checkPermission(config, notebookId);
      } else if (notebookById) {
        // 使用笔记本ID
        notebookId = notebookById.id;
        checkPermission(config, notebookId);
      } else {
        // 既不是笔记本名称也不是ID
        console.error(`错误: 路径首部 "${pathComponents[0]}" 不是有效的笔记本名称或ID`);
        console.error(`\n可用的笔记本:`);
        notebooks.forEach(nb => {
          console.error(`  - 名称: ${nb.name}, ID: ${nb.id}`);
        });
        process.exit(1);
      }

      // 确定最终标题 - 优先使用 --title 参数
      const finalTitle = pathEndsWithSlash ? params.title : (params.title || pathComponents[pathComponents.length - 1]);
      
      // 保存最终标题，用于后续设置文档标题
      displayTitle = finalTitle;

      // 构建完整路径（去掉笔记本名称，保留 / 开头）
      if (pathEndsWithSlash) {
        // 目录模式：/笔记本名/目录/ + 标题
        const relativePath = '/' + pathComponents.slice(1).join('/');
        fullPath = relativePath + '/' + finalTitle;
      } else {
        // 完整路径模式：/笔记本名/目录/文档
        fullPath = '/' + pathComponents.slice(1).join('/');
      }
    } else {
      // parentId 模式
      parentId = params.parentId || config.defaultNotebook;

      if (!parentId) {
        console.error('错误: 必须提供 --parent-id 或配置默认笔记本');
        process.exit(1);
      }

      // 智能分层检查：优先使用不会被索引阻塞的API
      let isContentBlock = false;
      
      // 1️⃣ 首先检查是否是笔记本ID（不需要API调用，不会被索引阻塞）
      const notebooks = await getNotebooks(connector);
      const matchedNotebook = notebooks.find(nb => nb.id === parentId);
      
      if (matchedNotebook) {
        // 是笔记本ID
        notebookId = parentId;
        checkPermission(config, notebookId);
      } else {
        // 2️⃣ 不是笔记本，尝试使用 getPathByID（不会被索引阻塞）
        try {
          const pathInfo = await connector.request('/api/filetree/getPathByID', { id: parentId });
          if (pathInfo && pathInfo.notebook) {
            // 是文档ID，获取到笔记本ID
            notebookId = pathInfo.notebook;
            checkPermission(config, notebookId);
          } else {
            // 3️⃣ getPathByID 失败，使用 getBlockInfo（会被索引阻塞，但需要检查内容块）
            const parentInfo = await connector.request('/api/block/getBlockInfo', { id: parentId });
            if (parentInfo && parentInfo.box) {
              // 检查是否是内容块ID（通过比较 parentId 和 rootID）
              // 文档ID: parentId === rootID
              // 内容块ID: parentId !== rootID
              if (parentInfo.rootID && parentId !== parentInfo.rootID) {
                isContentBlock = true;
              } else {
                // 是文档ID，使用 box 字段获取笔记本ID
                notebookId = parentInfo.box;
                checkPermission(config, notebookId);
              }
            } else {
              // 无法识别的ID，假设是笔记本ID进行权限检查
              notebookId = parentId;
              checkPermission(config, notebookId);
            }
          }
        } catch (pathError) {
          // getPathByID 失败，使用 getBlockInfo（会被索引阻塞）
          try {
            const parentInfo = await connector.request('/api/block/getBlockInfo', { id: parentId });
            if (parentInfo && parentInfo.box) {
              // 检查是否是内容块ID
              if (parentInfo.rootID && parentId !== parentInfo.rootID) {
                isContentBlock = true;
              } else {
                notebookId = parentInfo.box;
                checkPermission(config, notebookId);
              }
            } else {
              // 无法识别的ID，尝试验证是否是笔记本ID
              const notebook = notebooks.find(nb => nb.id === parentId);
              if (notebook) {
                notebookId = parentId;
                checkPermission(config, notebookId);
              } else {
                console.error(`错误: 无法验证 parent-id "${parentId}"，请确认它是有效的笔记本ID或文档ID`);
                console.error(`详情: ${pathError.message}`);
                process.exit(1);
              }
            }
          } catch (blockError) {
            console.error(`错误: 无法验证 parent-id "${parentId}"，请确认它是有效的笔记本ID或文档ID`);
            console.error(`详情: ${blockError.message}`);
            process.exit(1);
          }
        }
      }
      
      // 如果检测到是内容块ID，报错
      if (isContentBlock) {
        console.error(`错误: --parent-id 不能是内容块ID。请使用文档ID或笔记本ID。`);
        console.error(`提供的ID: ${parentId}`);
        console.error(`提示: 内容块ID只能在文档内使用，不能作为父级创建文档`);
        process.exit(1);
      }

      // 构建完整路径
      if (parentId === notebookId) {
        fullPath = '/' + params.title;
      } else {
        try {
          const hPathInfo = await connector.request('/api/filetree/getHPathByID', { id: parentId });
          fullPath = hPathInfo ? `${hPathInfo}/${params.title}` : '/' + params.title;
        } catch (e) {
          fullPath = '/' + params.title;
        }
      }
    }

    // 重名检测和强制创建逻辑
    let existingDocId = null;
    if (!params.force) {
      try {
        const existResult = await connector.request('/api/filetree/getIDsByHPath', {
          notebook: notebookId,
          path: fullPath
        });

        if (existResult && existResult.length > 0) {
          console.error(`错误: 文档 "${fullPath}" 已存在 (ID: ${existResult[0]})，使用 --force 强制创建`);
          process.exit(1);
        }
      } catch (e) {
        // 检查失败时继续创建
      }
    } else {
      // force 模式：检查文档是否存在
      try {
        const existResult = await connector.request('/api/filetree/getIDsByHPath', {
          notebook: notebookId,
          path: fullPath
        });

        if (existResult && existResult.length > 0) {
          existingDocId = existResult[0];
        }
      } catch (e) {
        // 检查失败时继续创建
      }
    }

    let content = params.content;

    // 从文件读取内容
    if (params.file) {
      try {
        content = fs.readFileSync(params.file, 'utf8');
      } catch (fileError) {
        console.error('错误: 无法读取文件', params.file);
        console.error(fileError.message);
        process.exit(1);
      }
    }

    const processedContent = processContent(content || '');

    let createResult = null;

    if (existingDocId) {
      try {
        await connector.request('/api/block/updateBlock', {
          dataType: 'markdown',
          data: processedContent,
          id: existingDocId
        });
        createResult = existingDocId;

        if (params.title) {
          try {
            await connector.request('/api/attr/setBlockAttrs', {
              id: existingDocId,
              attrs: { title: params.title }
            });
            displayTitle = params.title;
          } catch (e) {
          }
        }
      } catch (e) {
        console.error('错误: 文档更新失败:', e.message);
        process.exit(1);
      }
    } else {
      createResult = await connector.request('/api/filetree/createDocWithMd', {
        notebook: notebookId,
        path: fullPath,
        markdown: processedContent
      });

      if (createResult) {
        if (params.path) {
          try {
            await connector.request('/api/filetree/renameDocByID', {
              id: createResult,
              title: displayTitle
            });
          } catch (e) {
          }
        }
      }
    }

    if (createResult) {
      let intermediateDirectories = [];
      let actualParentId = parentId;

      if (!existingDocId) {
        try {
          const pathInfo = await connector.request('/api/filetree/getPathByID', { id: createResult });
          if (pathInfo && pathInfo.path) {
            const pathParts = pathInfo.path.split('/').filter(p => p);
            const docFile = pathParts[pathParts.length - 1];
            const docId = docFile.replace('.sy', '');

            if (pathParts.length > 1) {
              const dirParts = pathParts.slice(0, -1);
              intermediateDirectories = dirParts.map(dir => dir.replace('.sy', ''));
              actualParentId = intermediateDirectories[intermediateDirectories.length - 1] || null;
            }
          }
        } catch (e) {
        }
      }

      console.log(JSON.stringify({
        success: true,
        data: {
          id: createResult,
          title: displayTitle,
          parentId: actualParentId,
          notebookId: notebookId,
          path: fullPath,
          contentLength: processedContent.length,
          overwritten: !!existingDocId,
          intermediateDirectories: intermediateDirectories
        },
        message: existingDocId ? '文档已更新' : '文档创建成功',
        timestamp: Date.now()
      }, null, 2));
    } else {
      console.error('错误: 文档创建失败，API 返回空结果');
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
