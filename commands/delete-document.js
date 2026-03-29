/**
 * 删除文档指令
 * 删除 Siyuan Notes 中的文档
 * 
 * 多层保护机制：
 * 1. 全局安全模式 - 禁止所有删除操作
 * 2. 文档保护标记 - 通过属性标记重要文档
 * 3. 删除确认机制 - 需要传入文档标题确认
 */

const Permission = require('../utils/permission');
const DeleteProtection = require('../utils/delete-protection');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 检查ID是否为文档块
 */
async function checkIfDocumentBlock(skill, id) {
  try {
    const blockInfo = await skill.connector.request('/api/block/getBlockInfo', { id });
    
    if (!blockInfo || typeof blockInfo !== 'object') {
      return { isDocument: false, blockInfo: null };
    }
    
    const rootId = blockInfo.rootID || blockInfo.root_id || blockInfo.rootChildID;
    const isDocument = rootId === id;
    
    return { isDocument, blockInfo };
  } catch (error) {
    console.warn('获取块信息失败:', error.message);
    return { isDocument: false, blockInfo: null };
  }
}

/**
 * 指令配置
 */
const command = {
  name: 'delete',
  aliases: ['del', 'rm'],
  description: '删除文档（受多层保护机制约束）',
  usage: 'siyuan delete <docId> [--confirm-title <title>]',
  sortOrder: 80,
  
  initOptions: {},
  options: {
    '--confirm-title': { hasValue: true, description: '确认标题（当启用删除确认时需要）' }
  },
  positionalCount: 1,
  
  notes: [
    '仅限删除文档，不能删除普通块',
    '删除块请使用 block-delete 命令',
    '受多层保护机制约束：全局安全模式、文档保护标记、删除确认'
  ],
  examples: [
    'siyuan delete <doc-id>',
    'siyuan delete <doc-id> --confirm-title "文档标题"',
    'siyuan rm <doc-id>',
    'siyuan del <doc-id>'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.docId = parsed.positional[0];
    }
    if (parsed.options.confirmTitle) args.confirmTitle = parsed.options.confirmTitle;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.docId) {
      console.error('错误: 请提供文档ID');
      console.log('用法: siyuan delete <docId> [--confirm-title <title>]');
      process.exit(1);
    }
    
    console.log('删除文档...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, confirmTitle } = args;
    
    try {
      console.log('开始删除文档，文档ID:', docId);
      
      const { isDocument, blockInfo } = await checkIfDocumentBlock(skill, docId);
      
      if (!isDocument && blockInfo) {
        const rootTitle = blockInfo.rootTitle || blockInfo.rootID || docId;
        return {
          success: false,
          error: '无效操作',
          message: `传入的 ID "${docId}" 是普通块而非文档。删除块请使用 block-delete 命令：siyuan bd --id ${docId}`,
          hint: `所属文档: "${rootTitle}"`,
          blockType: 'block'
        };
      }
      
      const protectionResult = await DeleteProtection.checkDeletePermission(skill, docId, {
        confirmTitle
      });
      
      if (!protectionResult.allowed) {
        console.warn('删除操作被阻止:', protectionResult.reason);
        return {
          success: false,
          error: '删除保护',
          message: protectionResult.reason,
          protectionLevel: protectionResult.level
        };
      }
      
      if (protectionResult.actualTitle) {
        console.log('删除确认通过，文档标题:', protectionResult.actualTitle);
      }
      
      console.log('调用删除文档API:', '/api/filetree/removeDocByID', { id: docId });
      
      const result = await skill.connector.request('/api/filetree/removeDocByID', {
        id: docId
      });
      console.log('删除文档API返回结果:', result);
      
      if (skill.isVectorSearchReady && skill.isVectorSearchReady()) {
        try {
          console.log('同步删除向量库索引...');
          await skill.vectorManager.deleteDocumentsWithChunks([docId]);
          console.log('向量库索引已删除');
        } catch (vecError) {
          console.warn('删除向量库索引失败（不影响文档删除）:', vecError.message);
        }
      }
      
      return {
        success: true,
        data: {
          id: docId,
          deleted: true,
          notebookId,
          title: protectionResult.actualTitle,
          timestamp: Date.now()
        },
        message: '文档删除成功',
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('删除文档过程中出错:', error);
      return {
        success: false,
        error: error.message,
        message: '删除文档失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

module.exports = command;
