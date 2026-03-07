/**
 * 获取文档内容指令
 * 获取指定文档的内容，支持多种格式
 */

const Permission = require('../utils/permission');

/**
 * 指令配置
 */
const command = {
  name: 'get-doc-content',
  description: '获取指定文档的内容，支持 markdown、text、html 格式',
  usage: 'get-doc-content --doc-id <docId> [--format <format>] [--raw]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.docId - 文档ID
   * @param {string} args.format - 输出格式：markdown、text、html
   * @param {boolean} args.raw - 是否以纯文本格式返回（移除JSON外部结构）
   * @returns {Promise<Object|string>} 文档内容
   */
  execute: Permission.createPermissionWrapper(async (skill, args, notebookId) => {
    const { docId, format = 'markdown', raw = false } = args;
    
    // 验证格式参数
    const validFormats = ['markdown', 'text', 'html'];
    if (!validFormats.includes(format)) {
      return {
        success: false,
        error: '无效的格式参数',
        message: `format 必须是以下之一: ${validFormats.join(', ')}`
      };
    }
    
    try {
      
      // 获取原始文档内容
      const result = await skill.connector.request('/api/export/exportMdContent', { id: docId });
      
      if (!result || !result.content) {
        return {
          success: false,
          error: '文档内容为空',
          message: '未找到文档内容'
        };
      }
      
      let content = result.content;
      let formattedContent = content;
      
      // 根据格式处理内容
      if (format === 'text') {
        formattedContent = markdownToText(content);
      } else if (format === 'html') {
        formattedContent = markdownToHtml(content);
      }
      
      // 如果指定了raw参数，直接返回纯文本内容
      if (raw) {
        return formattedContent;
      }
      
      return {
        success: true,
        data: {
          id: docId,
          hPath: result.hPath || '',
          format,
          content: formattedContent,
          originalLength: content.length,
          formattedLength: formattedContent.length,
          metadata: {
            notebookId,
            path: result.hPath
          }
        },
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('获取文档内容失败:', error);
      return {
        success: false,
        error: error.message,
        message: '获取文档内容失败'
      };
    }
  }, {
    type: 'document',
    idParam: 'docId'
  })
};

/**
 * Markdown 转纯文本
 * @param {string} markdown - Markdown 文本
 * @returns {string} 纯文本
 */
function markdownToText(markdown) {
  return markdown
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/^-\s/gm, '')
    .replace(/^\d+\.\s/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Markdown 转 HTML
 * @param {string} markdown - Markdown 文本
 * @returns {string} HTML 文本
 */
function markdownToHtml(markdown) {
  return markdown
    .replace(/#{6}\s(.*?)$/gm, '<h6>$1</h6>')
    .replace(/#{5}\s(.*?)$/gm, '<h5>$1</h5>')
    .replace(/#{4}\s(.*?)$/gm, '<h4>$1</h4>')
    .replace(/#{3}\s(.*?)$/gm, '<h3>$1</h3>')
    .replace(/#{2}\s(.*?)$/gm, '<h2>$1</h2>')
    .replace(/#{1}\s(.*?)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/^-\s(.*?)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>)/s, '<ul>$1</ul>')
    .replace(/^\d+\.\s(.*?)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>)/s, '<ol>$1</ol>')
    .replace(/\n/g, '<br>');
}

module.exports = command;