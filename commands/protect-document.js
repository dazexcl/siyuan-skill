/**
 * 文档保护命令
 * 管理文档的保护标记，防止被误删除
 */

const Permission = require('../utils/permission');
const DeleteProtection = require('../utils/delete-protection');
const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 命令配置
 */
const command = {
  name: 'protect',
  aliases: [],
  description: '设置或移除文档保护标记，防止文档被删除',
  usage: 'siyuan protect <docId> [--remove] [--permanent]',
  sortOrder: 270,
  
  initOptions: {},
  options: {
    '--remove': { isFlag: true, aliases: ['-r'], description: '移除保护标记' },
    '--permanent': { isFlag: true, aliases: ['-p'], description: '设置为永久保护' }
  },
  positionalCount: 1,
  
  notes: [
    '永久保护的文档无法通过命令移除保护',
    '需要手动在思源笔记中修改属性'
  ],
  examples: [
    'siyuan protect <doc-id>',
    'siyuan protect <doc-id> --permanent',
    'siyuan protect <doc-id> --remove'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.docId = parsed.positional[0];
    }
    if (parsed.options.remove) args.remove = true;
    if (parsed.options.permanent) args.permanent = true;
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.docId) {
      console.error('错误: 请提供文档ID');
      console.log('用法: siyuan protect <docId> [--remove] [--permanent]');
      process.exit(1);
    }
    
    console.log('设置文档保护...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, remove, permanent } = args;
    
    try {
      let protectedStatus;
      
      if (remove) {
        const attrs = await skill.connector.request('/api/attr/getBlockAttrs', {
          id: docId
        });
        
        if (attrs && attrs['custom-protected'] === 'permanent') {
          return {
            success: false,
            error: '永久保护',
            message: '文档被标记为永久保护，无法通过命令移除保护。需要手动在思源笔记中修改属性。'
          };
        }
        
        protectedStatus = false;
      } else if (permanent) {
        protectedStatus = 'permanent';
      } else {
        protectedStatus = true;
      }
      
      const result = await DeleteProtection.setDocumentProtection(skill, docId, protectedStatus);
      
      if (result.success) {
        const verifyAttrs = await skill.connector.request('/api/attr/getBlockAttrs', { id: docId });
        const actualProtected = verifyAttrs ? verifyAttrs['custom-protected'] : null;
        
        return {
          success: true,
          data: {
            id: docId,
            protected: actualProtected ? true : false,
            protectionType: actualProtected || null,
            notebookId
          },
          message: result.message,
          timestamp: Date.now()
        };
      } else {
        return {
          success: false,
          error: '操作失败',
          message: result.message
        };
      }
    } catch (error) {
      console.error('设置文档保护失败:', error);
      return {
        success: false,
        error: error.message,
        message: '设置文档保护失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

module.exports = command;
