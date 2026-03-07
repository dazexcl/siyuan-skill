/**
 * NLP 分析命令
 * 对文本进行 NLP 分析
 * 指令配置
 */
const command = {
  name: 'nlp-analyze',
  description: '对文本进行 NLP 分析（分词、实体识别、关键词提取）',
  usage: 'nlp-analyze --text <text> [--tasks <tasks>] [--top-n <topN>]',
  
  /**
   * 执行指令
   * @param {SiyuanNotesSkill} skill - 技能实例
   * @param {Object} args - 指令参数
   * @param {string} args.text - 要分析的文本
   * @param {string} args.tasks - 分析任务列表（逗号分隔）
   * @param {number} args.topN - 返回前 N 个关键词
   * @returns {Promise<Object>} 执行结果
   */
  execute: async (skill, args = {}) => {
    const {
      text,
      tasks = ['tokenize', 'entities', 'keywords'],
      topN = 10
    } = args;

    if (!text || typeof text !== 'string') {
      return {
        success: false,
        error: '请提供要分析的文本'
      };
    }

    if (!skill.isNLPReady()) {
      await skill.initNLP();
    }

    if (!skill.isNLPReady()) {
      return {
        success: false,
        error: 'NLP 功能不可用'
      };
    }

    try {
      const nlpManager = skill.nlpManager;
      const result = {
        success: true,
        text: text.substring(0, 500),
        timestamp: Date.now()
      };

      const taskList = Array.isArray(tasks) ? tasks : tasks.split(',').map(t => t.trim());

      if (taskList.includes('tokenize')) {
        result.tokens = nlpManager.tokenize(text, { removeStopwords: true, minLength: 2 });
        result.tokenCount = result.tokens.length;
      }

      if (taskList.includes('entities')) {
        result.entities = nlpManager.extractEntities(text);
        result.entityCount = result.entities.length;
      }

      if (taskList.includes('keywords')) {
        result.keywords = nlpManager.extractKeywords(text, topN);
        result.keywordCount = result.keywords.length;
      }

      if (taskList.includes('summary')) {
        result.summary = nlpManager.extractSummary(text);
      }

      if (taskList.includes('language')) {
        result.language = nlpManager.detectLanguage(text);
      }

      if (taskList.includes('analyze') || taskList.includes('all')) {
        const fullAnalysis = nlpManager.analyze(text);
        result.tokens = fullAnalysis.tokens;
        result.entities = fullAnalysis.entities;
        result.keywords = fullAnalysis.keywords;
        result.stats = fullAnalysis.stats;
      }

      return result;
    } catch (error) {
      console.error('NLP 分析失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};

module.exports = command;
