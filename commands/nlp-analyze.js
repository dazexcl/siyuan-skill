/**
 * NLP 分析命令
 * 对文本进行 NLP 分析（分词、实体识别、关键词提取）
 */

const { parseCommandArgs, showHelp } = require('../lib/cli-base');

/**
 * 命令配置
 */
const command = {
  name: 'nlp',
  description: '对文本进行 NLP 分析',
  usage: 'siyuan nlp <text> [--tasks <tasks>]',
  sortOrder: 310,
  
  initOptions: { initNLP: true },
  options: {
    '--text': { hasValue: true, aliases: ['-t'], description: '要分析的文本' },
    '--tasks': { hasValue: true, description: '分析任务：tokenize,entities,keywords,all' },
    '--top-n': { hasValue: true, aliases: ['-n'], description: '返回前N个关键词（默认10）' }
  },
  positionalCount: 1,
  
  notes: [
    'tasks: tokenize(分词), entities(实体), keywords(关键词), all(全部)'
  ],
  
  examples: [
    'siyuan nlp "要分析的文本"',
    'siyuan nlp "文本" --tasks tokenize,keywords'
  ],
  
  /**
   * 参数转换
   */
  toExecuteArgs(parsed) {
    const args = {};
    if (parsed.positional.length > 0) {
      args.text = parsed.positional[0];
    }
    if (parsed.options.text) args.text = parsed.options.text;
    if (parsed.options.tasks) args.tasks = parsed.options.tasks;
    if (parsed.options.topN) args.topN = parseInt(parsed.options.topN, 10);
    return args;
  },
  
  /**
   * CLI 执行入口
   */
  async runCLI(skill, parsed, args) {
    const executeArgs = this.toExecuteArgs(parsed);
    
    if (!executeArgs.text) {
      console.error('错误: 请提供要分析的文本');
      console.log('用法: siyuan nlp --text <text>');
      process.exit(1);
    }
    
    console.log('NLP 分析...');
    const result = await this.execute(skill, executeArgs);
    console.log(JSON.stringify(result, null, 2));
  },
  
  /**
   * 执行指令
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
