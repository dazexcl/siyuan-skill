/**
 * 删除保护工具
 * 提供多层删除保护机制，防止 Agent 无故删除重要文档
 * 
 * 保护层级：
 * 1. 全局安全模式 - 禁止所有删除操作
 * 2. 文档保护标记 - 通过属性标记重要文档
 * 3. 删除确认机制 - 需要传入文档标题确认
 */

class DeleteProtection {
  /**
   * 检查全局安全模式
   * 默认启用安全模式，需要明确设置 safeMode: false 才允许删除
   * @param {Object} config - 配置对象
   * @returns {{allowed: boolean, reason: string|null}}
   */
  static checkSafeMode(config) {
    const { deleteProtection } = config;
    
    const safeMode = deleteProtection?.safeMode !== false;
    
    if (safeMode) {
      return {
        allowed: false,
        reason: '全局安全模式已启用（默认），禁止所有删除操作。如需删除，请在配置中设置 deleteProtection.safeMode = false。'
      };
    }
    
    return { allowed: true, reason: null };
  }

  /**
   * 检查文档保护标记
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {string} docId - 文档ID
   * @returns {Promise<{protected: boolean, reason: string|null}>}
   */
  static async checkDocumentProtection(skill, docId) {
    try {
      const attrs = await skill.connector.request('/api/attr/getBlockAttrs', {
        id: docId
      });
      
      if (attrs && attrs['custom-protected'] === 'true') {
        return {
          protected: true,
          reason: '文档已被标记为保护状态（custom-protected=true），禁止删除。如需删除，请先移除保护标记。'
        };
      }
      
      if (attrs && attrs['custom-protected'] === 'permanent') {
        return {
          protected: true,
          reason: '文档已被标记为永久保护状态（custom-protected=permanent），禁止删除。'
        };
      }
      
      return { protected: false, reason: null };
    } catch (error) {
      console.warn('检查文档保护状态失败:', error.message);
      return { protected: false, reason: null };
    }
  }

  /**
   * 验证删除确认
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {string} docId - 文档ID
   * @param {string} confirmTitle - 用户提供的确认标题
   * @param {Object} config - 配置对象
   * @returns {Promise<{confirmed: boolean, actualTitle: string|null, reason: string|null}>}
   */
  static async verifyDeleteConfirmation(skill, docId, confirmTitle, config) {
    const { deleteProtection } = config;
    
    if (!deleteProtection?.requireConfirmation) {
      return { confirmed: true, actualTitle: null, reason: null };
    }
    
    if (!confirmTitle) {
      return {
        confirmed: false,
        actualTitle: null,
        reason: '删除确认机制已启用，必须提供 --confirm-title 参数以确认删除操作。'
      };
    }
    
    try {
      const docInfo = await skill.connector.request('/api/block/getBlockInfo', {
        id: docId
      });
      
      const actualTitle = docInfo?.rootTitle || docInfo?.content || '';
      
      if (actualTitle.toLowerCase().trim() !== confirmTitle.toLowerCase().trim()) {
        return {
          confirmed: false,
          actualTitle,
          reason: `标题确认失败。文档标题: "${actualTitle}"，提供的确认标题: "${confirmTitle}"。请确保标题完全匹配。`
        };
      }
      
      return { confirmed: true, actualTitle, reason: null };
    } catch (error) {
      console.warn('获取文档标题失败:', error.message);
      return {
        confirmed: false,
        actualTitle: null,
        reason: '无法获取文档标题进行确认验证'
      };
    }
  }

  /**
   * 执行完整的删除保护检查
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {string} docId - 文档ID
   * @param {Object} options - 选项
   * @param {string} [options.confirmTitle] - 确认标题
   * @returns {Promise<{allowed: boolean, reason: string|null, level: string|null}>}
   */
  static async checkDeletePermission(skill, docId, options = {}) {
    const config = skill.config;
    const { confirmTitle } = options;
    
    const safeModeResult = this.checkSafeMode(config);
    if (!safeModeResult.allowed) {
      return {
        allowed: false,
        reason: safeModeResult.reason,
        level: 'safe_mode'
      };
    }
    
    const protectionResult = await this.checkDocumentProtection(skill, docId);
    if (protectionResult.protected) {
      return {
        allowed: false,
        reason: protectionResult.reason,
        level: 'document_protected'
      };
    }
    
    const confirmResult = await this.verifyDeleteConfirmation(skill, docId, confirmTitle, config);
    if (!confirmResult.confirmed) {
      return {
        allowed: false,
        reason: confirmResult.reason,
        level: 'confirmation_failed'
      };
    }
    
    return {
      allowed: true,
      reason: null,
      level: null,
      actualTitle: confirmResult.actualTitle
    };
  }

  /**
   * 设置文档保护标记
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {string} docId - 文档ID
   * @param {boolean|string} protected - 保护状态：true/false/'permanent'
   * @returns {Promise<{success: boolean, message: string}>}
   */
  static async setDocumentProtection(skill, docId, protected_status) {
    try {
      const value = protected_status === true ? 'true' : 
                    protected_status === 'permanent' ? 'permanent' : 
                    protected_status === false ? '' : String(protected_status);
      
      await skill.connector.request('/api/attr/setBlockAttrs', {
        id: docId,
        attrs: {
          'custom-protected': value
        }
      });
      
      return {
        success: true,
        message: value ? `文档保护已设置: ${value}` : '文档保护已移除'
      };
    } catch (error) {
      return {
        success: false,
        message: `设置文档保护失败: ${error.message}`
      };
    }
  }

  /**
   * 获取删除保护配置说明
   * @returns {string}
   */
  static getConfigDescription() {
    return `
删除保护配置说明 (deleteProtection):

  safeMode: boolean
    - true: 启用全局安全模式，禁止所有删除操作
    - false: 允许删除操作（默认）
    
  requireConfirmation: boolean
    - true: 删除时需要传入 --confirm-title 参数确认
    - false: 不需要确认（默认）
    
  示例配置:
  {
    "deleteProtection": {
      "safeMode": false,
      "requireConfirmation": true
    }
  }

文档保护标记:
  通过设置文档属性 custom-protected 来保护单个文档:
  - "true": 保护状态，可手动移除
  - "permanent": 永久保护，不可通过命令移除
  - "" 或未设置: 无保护

CLI 命令:
  siyuan protect <docId>           # 设置保护
  siyuan protect <docId> --remove  # 移除保护
  siyuan rm <docId> --confirm-title "文档标题"  # 确认删除
`;
  }
}

module.exports = DeleteProtection;
