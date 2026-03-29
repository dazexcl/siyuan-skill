/**
 * 命令索引文件
 * 导出所有可用的命令模块
 * 每个命令模块包含：name, aliases, description, usage, options, help, runCLI, execute
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
const setIcon = require('./icon');

const commandModules = [
  getNotebooks,
  getDocStructure,
  getDocContent,
  getDocInfo,
  searchContent,
  createDocument,
  updateDocument,
  deleteDocument,
  protectDocument,
  moveDocument,
  renameDocument,
  convertPath,
  indexDocuments,
  nlpAnalyze,
  insertBlock,
  updateBlock,
  deleteBlock,
  moveBlock,
  getBlock,
  blockFold,
  transferBlockRef,
  blockAttrs,
  tags,
  checkExists,
  setIcon
];

const commands = {};
const commandList = [];

for (const cmd of commandModules) {
  if (!cmd || !cmd.name) continue;
  
  commands[cmd.name] = cmd;
  
  if (cmd.aliases && Array.isArray(cmd.aliases)) {
    for (const alias of cmd.aliases) {
      commands[alias] = cmd;
    }
  }
  
  commandList.push({
    name: cmd.name,
    aliases: cmd.aliases || [],
    description: cmd.description || '',
    usage: cmd.usage || '',
    sortOrder: cmd.sortOrder || 999
  });
}

commandList.sort((a, b) => (a.sortOrder || 999) - (b.sortOrder || 999));

function getCommand(name) {
  return commands[name] || null;
}

function getAllCommands() {
  return commandList;
}

function getCommandNames() {
  return commandList.map(cmd => cmd.name);
}

module.exports = commands;
module.exports.commands = commands;
module.exports.commandList = commandList;
module.exports.getCommand = getCommand;
module.exports.getAllCommands = getAllCommands;
module.exports.getCommandNames = getCommandNames;
