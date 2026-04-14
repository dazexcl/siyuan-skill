#!/usr/bin/env node
/**
 * refs.js - 引用搜索（反链检索）
 *
 * 查询引用了指定文档/块的所有笔记
 */

const SiyuanConnector = require('./lib/connector');
const { checkPermission } = require('./lib/permission');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: refs <docId> [选项]

查询引用了指定文档/块的所有笔记（反链检索）

位置参数:
  docId                 目标文档/块的ID

选项:
  -l, --limit <num>           返回结果数量限制 (默认: 20)
  -n, --notebook-id <id>      限定笔记本ID
  -h, --help                  显示帮助信息

示例:
  refs "20200812220555-lj3enxa"
  refs "20200812220555-lj3enxa" --limit 10
  refs "20200812220555-lj3enxa" -l 50
  refs "20200812220555-lj3enxa" --notebook-id "20260227231831-yq1lxq2"

💡 提示: 使用 search 命令搜索关键词，使用 refs 命令查询引用关系`;

/**
 * 验证ID格式
 * @param {string} id - 待验证的ID
 * @returns {string|null} 验证通过返回ID，否则返回null
 */
function validateId(id) {
  if (!id || typeof id !== 'string') {
    return null;
  }

  const trimmed = id.trim();
  const idRegex = /^\d{14}-[a-z0-9]{7}$/;

  if (idRegex.test(trimmed)) {
    return trimmed;
  }

  return null;
}

/**
 * 处理引用搜索结果
 * @param {Array} results - 原始引用搜索结果
 * @returns {Array} 处理后的结果
 */
function processReferenceResults(results) {
  if (!results || !Array.isArray(results)) {
    return [];
  }

  return results
    .map(result => ({
      id: result.id || result.block_id,
      content: result.content || '',
      type: result.type || '',
      rootId: result.root_id || '',
      hpath: result.hpath || '',
      notebookId: result.box || '',
      refMarkdown: result.ref_markdown || '',
      defBlockId: result.def_block_id || '',
      updated: result.updated || Date.now()
    }))
    .sort((a, b) => new Date(b.updated) - new Date(a.updated));
}

/**
 * 搜索引用了指定文档/块的笔记列表
 * @param {Object} connector - 连接器实例
 * @param {string} targetId - 目标文档/块的ID
 * @param {Object} options - 搜索选项
 * @returns {Promise<Object>} 搜索结果
 */
async function searchReferences(connector, targetId, options = {}) {
  const {
    limit = 20,
    notebookId,
    checkPermissionFn
  } = options;

  const validTargetId = validateId(targetId);
  if (!validTargetId) {
    return {
      targetId,
      mode: 'references',
      results: [],
      total: 0,
      error: '无效的目标ID'
    };
  }

  let results = [];

  try {
    const config = connector.getConfig();
    const permissionMode = config.permissionMode || 'all';
    const notebookList = Array.isArray(config.notebookList) ? config.notebookList : [];

    let sqlQuery = `
      SELECT 
        r.id as ref_id,
        r.block_id,
        r.root_id,
        r.box,
        r.path,
        r.content as ref_content,
        r.markdown as ref_markdown,
        r.type as ref_type,
        r.def_block_id,
        r.def_block_parent_id,
        r.def_block_root_id,
        r.def_block_path,
        b.id,
        b.content,
        b.type,
        b.subtype,
        b.updated,
        b.created,
        b.hpath,
        b.name
      FROM refs r
      LEFT JOIN blocks b ON r.block_id = b.id
      WHERE (r.def_block_id = '${validTargetId}' OR r.def_block_root_id = '${validTargetId}')
    `;

    if (notebookId) {
      const validNotebookId = validateId(notebookId);
      if (validNotebookId) {
        sqlQuery += ` AND r.box = '${validNotebookId}'`;
      }
    }

    if (permissionMode === 'whitelist' && notebookList.length > 0) {
      const validNotebooks = notebookList
        .map(id => validateId(id))
        .filter(id => id !== null);
      if (validNotebooks.length > 0) {
        sqlQuery += ` AND r.box IN ('${validNotebooks.join("','")}')`;
      }
    } else if (permissionMode === 'blacklist' && notebookList.length > 0) {
      const validNotebooks = notebookList
        .map(id => validateId(id))
        .filter(id => id !== null);
      if (validNotebooks.length > 0) {
        sqlQuery += ` AND r.box NOT IN ('${validNotebooks.join("','")}')`;
      }
    }

    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    sqlQuery += ` LIMIT ${safeLimit}`;

    const sqlResults = await connector.request('/api/query/sql', { stmt: sqlQuery });
    results = sqlResults || [];
  } catch (error) {
    results = [];
  }

  let filteredResults = results;
  if (checkPermissionFn && typeof checkPermissionFn === 'function') {
    filteredResults = results.filter(result => {
      return !result.box || checkPermissionFn(result.box);
    });
  }

  const processedResults = processReferenceResults(filteredResults);

  return {
    targetId: validTargetId,
    mode: 'references',
    results: processedResults,
    total: processedResults.length,
    limit,
    notebookId
  };
}

/**
 * 主函数 - 执行引用搜索
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['limit', 'notebook-id'],
    shortOpts: { l: 'limit', n: 'notebookId' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (positionalArgs.length === 0) {
    process.stdout.write('错误: 请提供目标文档/块的ID\n');
    process.exit(1);
  }

  const docId = positionalArgs[0];
  if (!docId || docId.trim() === '') {
    process.stdout.write('错误: 文档ID不能为空\n');
    process.exit(1);
  }

  const limit = parseInt(options.limit) || 20;
  const notebookId = options.notebookId || options.notebook || null;

  try {
    const connector = SiyuanConnector.get();
    const config = connector.getConfig();

    const refOptions = {
      limit: limit,
      notebookId: notebookId,
      checkPermissionFn: (notebookId) => {
        try {
          checkPermission(config, notebookId);
          return true;
        } catch (e) {
          return false;
        }
      }
    };

    const result = await searchReferences(connector, docId, refOptions);

    const blocks = result.results.map(r => {
      return {
        id: r.id,
        content: r.content || r.excerpt || '',
        type: r.type || '',
        rootId: r.rootId || '',
        hpath: r.hpath || '',
        notebookId: r.notebookId || r.box || '',
        refMarkdown: r.refMarkdown || '',
        defBlockId: r.defBlockId || '',
        updated: r.updated
      };
    });

    const outputData = {
      success: true,
      data: {
        blocks
      },
      query: {
        docId: docId,
        mode: 'references',
        limit: limit
      },
      total: result.total
    };

    if (result.error) {
      outputData.error = result.error;
    }

    console.log(JSON.stringify(outputData, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
