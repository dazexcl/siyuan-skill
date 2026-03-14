/**
 * NLP 管理器
 * 提供文本分词、实体识别、关键词提取等功能
 * 中文使用双向最大匹配分词，英文使用基础分词，无外部依赖
 */

const ChineseTokenizer = require('./chinese-tokenizer');

/**
 * NLPManager 类
 * 提供文本分词、实体识别、关键词提取等功能
 */
class NLPManager {
  /**
   * 构造函数
   * @param {Object} config - 配置对象
   */
  constructor(config = {}) {
    this.config = {
      language: config.language || 'zh',
      extractEntities: config.extractEntities !== false,
      extractKeywords: config.extractKeywords !== false
    };
    this.initialized = false;
    
    this.chineseTokenizer = null;
    
    this.chineseStopwords = new Set([
      '的', '了', '和', '是', '就', '都', '而', '及', '与', '着',
      '或', '一个', '没有', '我们', '你们', '他们', '它们', '这个',
      '那个', '这些', '那些', '什么', '怎么', '如何', '为什么',
      '可以', '可能', '应该', '需要', '能够', '已经', '正在',
      '将', '会', '要', '得', '地', '着', '过', '啊', '呢', '吧'
    ]);
    
    this.englishStopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to',
      'for', 'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were',
      'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can',
      'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them',
      'their', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his',
      'she', 'her', 'i', 'me', 'my', 'what', 'which', 'who', 'whom',
      'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not'
    ]);
  }

  /**
   * 初始化 NLP 模型
   * @returns {Promise<boolean>}
   */
  async initialize() {
    try {
      this.chineseTokenizer = new ChineseTokenizer({
        useBidirectional: true,
        mergeUnknown: true
      });
      this.initialized = true;
      console.log('NLP 功能已启用（双向最大匹配分词，支持中英文）');
      return true;
    } catch (error) {
      console.error('NLP 初始化失败:', error);
      this.initialized = false;
      return false;
    }
  }

  /**
   * 检查是否已初始化
   * @returns {boolean}
   */
  isReady() {
    return this.initialized && this.chineseTokenizer !== null;
  }

  /**
   * 分词（混合中英文分词）
   * @param {string} text - 输入文本
   * @param {Object} options - 选项
   * @returns {Array} 词元数组
   */
  tokenize(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const { removeStopwords = false, minLength = 1, deduplicate = true } = options;
    const tokens = [];

    const segments = text.split(/([\u4e00-\u9fa5]+)/g);
    
    segments.forEach(segment => {
      if (!segment) return;
      
      if (/[\u4e00-\u9fa5]/.test(segment)) {
        if (this.chineseTokenizer) {
          const chineseTokens = this.chineseTokenizer.segment(segment);
          tokens.push(...chineseTokens);
        } else {
          for (let i = 0; i < segment.length; i++) {
            tokens.push(segment[i]);
          }
        }
      } else {
        const englishTokens = segment.match(/[a-zA-Z]+/g) || [];
        tokens.push(...englishTokens);
        
        const numbers = segment.match(/[0-9]+/g) || [];
        tokens.push(...numbers);
      }
    });

    let allTokens = deduplicate ? [...new Set(tokens)] : tokens;

    if (removeStopwords) {
      allTokens = allTokens.filter(token => 
        !this.chineseStopwords.has(token) && 
        !this.englishStopwords.has(token.toLowerCase()) &&
        !(this.chineseTokenizer && this.chineseTokenizer.isStopword(token))
      );
    }

    if (minLength > 1) {
      allTokens = allTokens.filter(token => token.length >= minLength);
    }

    return allTokens;
  }

  /**
   * 中文分词（仅返回中文词）
   * @param {string} text - 输入文本
   * @param {Object} options - 选项
   * @returns {Array} 中文词数组
   */
  tokenizeChinese(text, options = {}) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const { removeStopwords = false } = options;
    
    if (!this.chineseTokenizer) {
      return [];
    }

    let tokens = this.chineseTokenizer.segment(text);
    
    if (removeStopwords) {
      tokens = this.chineseTokenizer.filterStopwords(tokens);
    }

    return tokens;
  }

  /**
   * 提取实体
   * @param {string} text - 输入文本
   * @returns {Array} 实体数组
   */
  extractEntities(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const entities = [];

    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex) || [];
    emails.forEach(email => {
      entities.push({ text: email, type: 'EMAIL', confidence: 0.95 });
    });

    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g;
    const urls = text.match(urlRegex) || [];
    urls.forEach(url => {
      entities.push({ text: url, type: 'URL', confidence: 0.95 });
    });

    const phoneRegex = /(?:\+?86)?1[3-9]\d{9}|(?:\d{3,4}-)?\d{7,8}/g;
    const phones = text.match(phoneRegex) || [];
    phones.forEach(phone => {
      entities.push({ text: phone, type: 'PHONE', confidence: 0.8 });
    });

    const dateRegex = /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日]?|\d{1,2}[-/]\d{1,2}[-/]\d{4}/g;
    const dates = text.match(dateRegex) || [];
    dates.forEach(date => {
      entities.push({ text: date, type: 'DATE', confidence: 0.85 });
    });

    const timeRegex = /\d{1,2}:\d{2}(?::\d{2})?|\d{1,2}[点时]\d{1,2}分?/g;
    const times = text.match(timeRegex) || [];
    times.forEach(time => {
      entities.push({ text: time, type: 'TIME', confidence: 0.8 });
    });

    const ipRegex = /(?:\d{1,3}\.){3}\d{1,3}/g;
    const ips = text.match(ipRegex) || [];
    ips.forEach(ip => {
      entities.push({ text: ip, type: 'IP', confidence: 0.9 });
    });

    const moneyRegex = /[¥$€£]\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*[元美元欧元英镑]/g;
    const moneys = text.match(moneyRegex) || [];
    moneys.forEach(money => {
      entities.push({ text: money, type: 'MONEY', confidence: 0.85 });
    });

    return entities;
  }

  /**
   * 提取关键词
   * @param {string} text - 输入文本
   * @param {number} topN - 返回前 N 个关键词
   * @returns {Array} 关键词数组
   */
  extractKeywords(text, topN = 10) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const tokens = this.tokenize(text, { removeStopwords: true, minLength: 2 });
    
    const tf = new Map();
    tokens.forEach(token => {
      const lowerToken = token.toLowerCase();
      tf.set(lowerToken, (tf.get(lowerToken) || 0) + 1);
    });

    const keywords = Array.from(tf.entries())
      .map(([word, freq]) => ({
        word,
        frequency: freq,
        score: this.calculateKeywordScore(word, freq, tokens.length)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);

    return keywords;
  }

  /**
   * 计算关键词得分
   * @param {string} word - 词
   * @param {number} freq - 频率
   * @param {number} totalTokens - 总词数
   * @returns {number} 得分
   */
  calculateKeywordScore(word, freq, totalTokens) {
    let score = freq;
    
    if (/[\u4e00-\u9fa5]/.test(word)) {
      score *= 1.5;
      
      if (word.length >= 2 && word.length <= 4) {
        score *= 1.2;
      }
    } else {
      if (word.length >= 2 && word.length <= 4) {
        score *= 1.1;
      }
    }
    
    if (/^[A-Z]/.test(word)) {
      score *= 1.15;
    }
    
    const tf = freq / totalTokens;
    score *= (1 + tf);
    
    return score;
  }

  /**
   * 综合分析文本
   * @param {string} text - 输入文本
   * @returns {Object} 分析结果
   */
  analyze(text) {
    if (!text || typeof text !== 'string') {
      return {
        text: '',
        tokens: [],
        entities: [],
        keywords: [],
        stats: {
          length: 0,
          tokenCount: 0,
          uniqueTokenCount: 0
        }
      };
    }

    const tokens = this.tokenize(text);
    const entities = this.config.extractEntities ? this.extractEntities(text) : [];
    const keywords = this.config.extractKeywords ? this.extractKeywords(text) : [];

    return {
      text: text.substring(0, 1000),
      tokens: tokens.slice(0, 100),
      entities,
      keywords,
      stats: {
        length: text.length,
        tokenCount: tokens.length,
        uniqueTokenCount: new Set(tokens.map(t => t.toLowerCase())).size,
        entityCount: entities.length,
        keywordCount: keywords.length
      }
    };
  }

  /**
   * 提取文本摘要
   * @param {string} text - 输入文本
   * @param {number} maxSentences - 最大句子数
   * @returns {string} 摘要
   */
  extractSummary(text, maxSentences = 3) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= maxSentences) {
      return text;
    }

    const keywords = this.extractKeywords(text, 20);
    const keywordSet = new Set(keywords.map(k => k.word.toLowerCase()));

    const sentenceScores = sentences.map(sentence => {
      const sentenceTokens = this.tokenize(sentence);
      let score = 0;
      
      sentenceTokens.forEach(token => {
        if (keywordSet.has(token.toLowerCase())) {
          score += 1;
        }
      });
      
      const position = sentences.indexOf(sentence);
      if (position === 0) score *= 1.5;
      if (position === sentences.length - 1) score *= 0.8;
      
      return { sentence, score };
    });

    const topSentences = sentenceScores
      .sort((a, b) => b.score - a.score)
      .slice(0, maxSentences)
      .map(s => s.sentence.trim());

    return topSentences.join('。') + '。';
  }

  /**
   * 检测语言
   * @param {string} text - 输入文本
   * @returns {string} 语言代码
   */
  detectLanguage(text) {
    if (!text || typeof text !== 'string') {
      return 'unknown';
    }

    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
    const totalChars = chineseChars + englishChars;

    if (totalChars === 0) {
      return 'unknown';
    }

    const chineseRatio = chineseChars / totalChars;

    if (chineseRatio > 0.3) {
      return 'zh';
    } else {
      return 'en';
    }
  }

  /**
   * 添加自定义词到词典
   * @param {string} word - 词
   * @param {number} frequency - 词频
   */
  addWord(word, frequency = 1000) {
    if (this.chineseTokenizer) {
      this.chineseTokenizer.addWord(word, frequency);
    }
  }

  /**
   * 批量添加词到词典
   * @param {Array} words - 词数组
   * @param {number} frequency - 词频
   */
  addWords(words, frequency = 1000) {
    if (this.chineseTokenizer) {
      this.chineseTokenizer.addWords(words, frequency);
    }
  }

  /**
   * 获取词典统计信息
   * @returns {Object|null}
   */
  getDictionaryStats() {
    if (this.chineseTokenizer) {
      return this.chineseTokenizer.getStats();
    }
    return null;
  }

  /**
   * 获取配置
   * @returns {Object}
   */
  getConfig() {
    return { ...this.config };
  }
}

module.exports = NLPManager;
