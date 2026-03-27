/**
 * 命令索引文件
 * 导出所有可用的单指令脚本
 */

const getNotebooks = require('./get-notebooks');
const getDocStructure = require('./get-doc-structure');
const getDocContent = require('./get-doc-content');
const getDocInfo = require('./get-doc-info');
const searchContent = require('./search-content');
const createDocument = require('./create-document');
const updateDocument = require('./update-document');
const deleteDocument = require('./delete-document');
const protectDocument = require('./protect-document');
const moveDocument = require('./move-document');
const renameDocument = require('./rename-document');
const convertPath = require('./convert-path');
const indexDocuments = require('./index-documents');
const nlpAnalyze = require('./nlp-analyze');
const insertBlock = require('./insert-block');
const updateBlock = require('./update-block');
const deleteBlock = require('./delete-block');
const moveBlock = require('./move-block');
const getBlock = require('./block-get');
const blockFold = require('./block-fold');
const transferBlockRef = require('./transfer-block-ref');
const blockAttrs = require('./block-attrs');
const tags = require('./tags');
const checkExists = require('./check-exists');

const commands = {
  'get-notebooks': getNotebooks,
  'get-doc-structure': getDocStructure,
  'get-doc-content': getDocContent,
  'get-doc-info': getDocInfo,
  'search-content': searchContent,
  'create-document': createDocument,
  'update-document': updateDocument,
  'delete-document': deleteDocument,
  'protect-document': protectDocument,
  'move-document': moveDocument,
  'rename-document': renameDocument,
  'convert-path': convertPath,
  'index-documents': indexDocuments,
  'nlp-analyze': nlpAnalyze,
  'block-insert': insertBlock,
  'block-update': updateBlock,
  'block-delete': deleteBlock,
  'block-move': moveBlock,
  'block-get': getBlock,
  'block-attributes': blockAttrs,
  'block-attrs': blockAttrs,
  'block-fold': blockFold,
  'fold-block': blockFold,
  'unfold-block': blockFold,
  'transfer-block-ref': transferBlockRef,
  'tags': tags,
  'check-exists': checkExists
};

module.exports = commands;
