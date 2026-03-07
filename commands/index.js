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
  'nlp-analyze': nlpAnalyze
};

module.exports = commands;