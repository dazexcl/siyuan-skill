/**
 * 命令索引文件
 * 导出所有可用的单指令脚本
 */

const getNotebooks = require('./get-notebooks');
const getDocStructure = require('./get-doc-structure');
const getDocContent = require('./get-doc-content');
const searchContent = require('./search-content');
const createDocument = require('./create-document');
const updateDocument = require('./update-document');
const deleteDocument = require('./delete-document');
const moveDocument = require('./move-document');
const convertPath = require('./convert-path');
const indexDocuments = require('./index-documents');
const nlpAnalyze = require('./nlp-analyze');
const insertBlock = require('./insert-block');
const updateBlock = require('./update-block');
const deleteBlock = require('./delete-block');
const moveBlock = require('./move-block');
const getBlock = require('./get-block');
const blockAttributes = require('./block-attributes');
const blockFold = require('./block-fold');
const transferBlockRef = require('./transfer-block-ref');

/**
 * 所有可用命令的映射
 */
const commands = {
  'get-notebooks': getNotebooks,
  'get-doc-structure': getDocStructure,
  'get-doc-content': getDocContent,
  'search-content': searchContent,
  'create-document': createDocument,
  'update-document': updateDocument,
  'delete-document': deleteDocument,
  'move-document': moveDocument,
  'convert-path': convertPath,
  'index-documents': indexDocuments,
  'nlp-analyze': nlpAnalyze,
  'insert-block': insertBlock,
  'update-block': updateBlock,
  'delete-block': deleteBlock,
  'move-block': moveBlock,
  'get-block': getBlock,
  'block-attributes': blockAttributes,
  'block-fold': blockFold,
  'fold-block': blockFold,
  'unfold-block': blockFold,
  'transfer-block-ref': transferBlockRef
};

module.exports = commands;