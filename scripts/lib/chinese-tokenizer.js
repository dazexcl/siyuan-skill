/**
 * 中文分词器
 * 使用双向最大匹配算法实现中文分词
 */

const { ChineseDictionary, STOPWORDS } = require('./chinese-dictionary');

class ChineseTokenizer {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    this.dictionary = new ChineseDictionary();
    this.maxWordLength = this.dictionary.getMaxWordLength();
    this.options = {
      useBidirectional: options.useBidirectional !== false,
      mergeUnknown: options.mergeUnknown !== false,
      minWordLength: options.minWordLength || 1
    };
  }

  /**
   * 正向最大匹配
   * @param {string} text - 输入文本
   * @returns {Array} 分词结果
   */
  forwardMaxMatch(text) {
    const result = [];
    let i = 0;
    const len = text.length;

    while (i < len) {
      let matched = false;
      const maxLen = Math.min(this.maxWordLength, len - i);

      for (let j = maxLen; j >= 1; j--) {
        const word = text.substring(i, i + j);
        
        if (this.dictionary.has(word)) {
          result.push(word);
          i += j;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result.push(text[i]);
        i++;
      }
    }

    return result;
  }

  /**
   * 逆向最大匹配
   * @param {string} text - 输入文本
   * @returns {Array} 分词结果
   */
  backwardMaxMatch(text) {
    const result = [];
    let i = text.length;

    while (i > 0) {
      let matched = false;
      const maxLen = Math.min(this.maxWordLength, i);

      for (let j = maxLen; j >= 1; j--) {
        const word = text.substring(i - j, i);
        
        if (this.dictionary.has(word)) {
          result.unshift(word);
          i -= j;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result.unshift(text[i - 1]);
        i--;
      }
    }

    return result;
  }

  /**
   * 计算分词结果得分
   * @param {Array} tokens - 分词结果
   * @returns {number} 得分
   */
  calculateScore(tokens) {
    let score = 0;
    
    tokens.forEach(token => {
      const freq = this.dictionary.getFrequency(token);
      if (freq > 0) {
        score += Math.log(freq + 1);
      }
      
      if (token.length >= 2 && token.length <= 4) {
        score += token.length * 2;
      } else if (token.length === 1) {
        score -= 1;
      }
    });
    
    const avgLength = tokens.reduce((sum, t) => sum + t.length, 0) / tokens.length;
    score += avgLength * 3;
    
    return score;
  }

  /**
   * 合并连续的单字（未识别字符）
   * 策略：只合并连续2-3个未识别单字，超过则保持单字切分
   * @param {Array} tokens - 分词结果
   * @returns {Array} 处理后的结果
   */
  mergeUnknownTokens(tokens) {
    if (!this.options.mergeUnknown) {
      return tokens;
    }

    const knownCount = tokens.filter(t => this.dictionary.has(t)).length;
    if (knownCount === 0) {
      return tokens;
    }

    const result = [];
    let unknown = '';

    tokens.forEach(token => {
      if (token.length === 1 && !this.dictionary.has(token)) {
        unknown += token;
      } else {
        if (unknown.length > 0) {
          if (unknown.length <= 3) {
            result.push(unknown);
          } else {
            for (const ch of unknown) {
              result.push(ch);
            }
          }
          unknown = '';
        }
        result.push(token);
      }
    });

    if (unknown.length > 0) {
      if (unknown.length <= 3) {
        result.push(unknown);
      } else {
        for (const ch of unknown) {
          result.push(ch);
        }
      }
    }

    return result;
  }

  /**
   * 双向最大匹配分词
   * @param {string} text - 输入文本
   * @returns {Array} 分词结果
   */
  segment(text) {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const chineseText = text.match(/[\u4e00-\u9fa5]+/g);
    if (!chineseText || chineseText.length === 0) {
      return [];
    }

    const fullChinese = chineseText.join('');
    
    if (this.dictionary.has(fullChinese)) {
      return [fullChinese];
    }

    if (!this.options.useBidirectional) {
      const forward = this.forwardMaxMatch(fullChinese);
      return this.mergeUnknownTokens(forward);
    }

    const forward = this.forwardMaxMatch(fullChinese);
    const backward = this.backwardMaxMatch(fullChinese);

    const forwardScore = this.calculateScore(forward);
    const backwardScore = this.calculateScore(backward);

    let result;
    if (forwardScore >= backwardScore) {
      result = forward;
    } else {
      result = backward;
    }

    return this.mergeUnknownTokens(result);
  }

  /**
   * 判断是否为停用词
   * @param {string} word - 词
   * @returns {boolean}
   */
  isStopword(word) {
    return STOPWORDS.has(word);
  }

  /**
   * 过滤停用词
   * @param {Array} tokens - 词元数组
   * @returns {Array} 过滤后的数组
   */
  filterStopwords(tokens) {
    return tokens.filter(token => !this.isStopword(token));
  }

  /**
   * 添加自定义词
   * @param {string} word - 词
   * @param {number} frequency - 词频
   */
  addWord(word, frequency = 1000) {
    this.dictionary.addWord(word, frequency);
    if (word.length > this.maxWordLength) {
      this.maxWordLength = Math.min(word.length, 8);
    }
  }

  /**
   * 批量添加词
   * @param {Array} words - 词数组
   * @param {number} frequency - 词频
   */
  addWords(words, frequency = 1000) {
    this.dictionary.addWords(words, frequency);
  }

  /**
   * 获取词典统计信息
   * @returns {Object}
   */
  getStats() {
    return this.dictionary.getStats();
  }
}

module.exports = ChineseTokenizer;
