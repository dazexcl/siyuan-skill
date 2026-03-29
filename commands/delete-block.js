/**
 * 块删除命令
 * 在 Siyuan Notes 中删除块
 * 
 * 注意：此命令仅用于删除普通块，不能删除文档
 * 如需删除文档，请使用 delete 命令（delete-document）
 */

const Permission = require('../utils/permission');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 检查块是否为文档块
 */
async function checkIfDocumentBlock(skill, blockId) {
  try {
    const blockInfo = await skill.connector.request('/api/block/getBlockInfo', { id: blockId });
    
    console.log('getBlockInfo API 响应:', JSON.stringify(blockInfo, null, 2));
    
    if (!blockInfo || typeof blockInfo !== 'object') {
      return { isDocument: false, blockInfo: null, error: '无法获取块信息' };
    }
    
    const rootId = blockInfo.rootID || blockInfo.root_id || blockInfo.rootChildID;
    const type = blockInfo.type;
    
    if (type === 'd' || (rootId && rootId === blockId)) {
      console.log('检测到文档块:', { blockId, rootId, type });
      return { isDocument: true, blockInfo };
    }
    
    return { isDocument: false, blockInfo };
  } catch (error) {
    console.error('获取块信息失败:', error.message);
    return { isDocument: false, blockInfo: null, error: error.message };
  }
}

/**
 * 命令配置
 */
const command = {
  name: 'block-delete',
  aliases: ['bd'],
  description: '删除块（仅限普通块，文档请用 delete 命令）',
  usage: 'siyuan bd <blockId>',
  sortOrder: 230,
  
  initOptions: {},
  options: {},
  positionalCount: 1,
  
  notes: [
    '仅限删除普通块，文档请使用 delete 命令'
  ],
  examples: [
    'siyuan bd <block-id>',
    'siyuan block-delete <block-id>'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.id = parsed.positional[0];
    }
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.id) {
      console.error('错误: 请提供块ID');
      console.log('用法: siyuan bd <blockId>');
      process.exit(1);
    }
    
    console.log('删除块...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行命令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { id } = args;
    
    if (!id) {
      return {
        success: false,
        error: '缺少必要参数',
        message: '必须提供 id 参数'
      };
    }
    
    try {
      const { isDocument, blockInfo, error: checkError } = await checkIfDocumentBlock(skill, id);
      
      if (checkError && !blockInfo) {
        return {
          success: false,
          error: '获取块信息失败',
          message: `无法获取块信息: ${checkError}。请确认块ID是否正确。`
        };
      }
      
      if (isDocument) {
        const docTitle = blockInfo?.rootTitle || blockInfo?.content || id;
        return {
          success: false,
          error: '无效操作',
          message: `传入的 ID "${id}" 是文档而非普通块。删除文档请使用 delete 命令：siyuan delete --doc-id ${id}`,
          hint: `文档标题: "${docTitle}"`,
          blockType: 'document'
        };
      }
      
      console.log('检测到普通块，使用 deleteBlock API');
      const result = await skill.connector.request('/api/block/deleteBlock', { id });
      console.log('deleteBlock API 响应:', JSON.stringify(result, null, 2));
      
      const verifyResult = await skill.connector.request('/api/block/getBlockInfo', { id }).catch(() => null);
      if (verifyResult && verifyResult.rootID) {
        console.warn('块删除后仍存在，验证失败');
        return {
          success: false,
          error: '删除验证失败',
          message: '块删除命令已执行，但块仍然存在。可能是权限问题或 API 异常。'
        };
      }
      
      return {
        success: true,
        data: {
          id,
          operation: 'delete',
          timestamp: Date.now(),
          notebookId
        },
        message: '块删除成功'
      };
    } catch (error) {
      console.error('删除块失败:', error);
      return {
        success: false,
        error: error.message,
        message: '删除块失败'
      };
    }
  }, {
    type: 'block',
    idParam: 'id'
  })
};

module.exports = command;
