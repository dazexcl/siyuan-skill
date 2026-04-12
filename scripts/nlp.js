#!/usr/bin/env node
/**
 * nlp.js - 对文本进行 NLP 分析
 */
const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: nlp <text> [选项]

对文本进行自然语言处理分析

位置参数:
  text                  待分析的文本

选项:
  --tasks <tasks>       指定分析任务（逗号分隔）: tokenize,entities,keywords,summary,all
  --top-n <number>      关键词数量限制
  -h, --help            显示帮助信息

示例:
  nlp "这是一段待分析的文本"
  nlp "文本内容" --tasks entities,keywords
  nlp "文本内容" --tasks keywords --top-n 3`;

/**
 * 将短横线命名转为驼峰命名（保留此函数，因为公共解析器不提供）
 * @param {string} str - 输入字符串
 * @returns {string} 驼峰命名字符串
 */
function camelCase(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * 中文词典模块
 */
class ChineseDictionary {
  constructor() {
    this.wordSet = new Set();
    this.maxWordLength = 1;
    this.wordFrequency = new Map();
    this.loadWords();
  }

  loadWords() {
    const CHINESE_DICTIONARY = {
      tech: [
        '人工智能', '机器学习', '深度学习', '神经网络', '自然语言处理', '计算机视觉',
        '知识图谱', '数据挖掘', '大数据', '云计算', '物联网', '区块链', '量子计算',
        '算法', '模型', '训练', '推理', '特征', '向量', '嵌入', '维度', '矩阵',
        '分类', '聚类', '回归', '预测', '识别', '检测', '分割', '生成', '优化',
        '编程', '代码', '程序', '软件', '硬件', '系统', '架构', '框架', '组件',
        '接口', '协议', '服务', '容器', '微服务', '分布式', '并发', '异步', '同步',
        '数据库', '缓存', '消息', '队列', '日志', '监控', '部署', '测试', '调试',
        '前端', '后端', '全栈', '移动端', '客户端', '服务器', '浏览器', '应用程序',
        '开源', '版本', '分支', '合并', '提交', '回滚', '发布', '迭代', '敏捷',
        '开发', '运维', '测试', '产品', '设计', '需求', '功能', '性能', '安全',
        '接口', '文档', '注释', '规范', '标准', '模式', '方法', '函数', '变量',
        '对象', '类', '实例', '继承', '封装', '多态', '抽象', '接口', '实现',
        '模块', '包', '依赖', '库', '工具', '插件', '扩展', '配置', '环境',
        'GPT', 'Transformer', 'BERT', 'CNN', 'RNN', 'LSTM', 'GAN', 'VAE',
        'API', 'SDK', 'HTTP', 'HTTPS', 'REST', 'GraphQL', 'WebSocket',
        'JSON', 'XML', 'YAML', 'CSV', 'SQL', 'NoSQL', 'Redis', 'MongoDB',
        'Docker', 'Kubernetes', 'Jenkins', 'Git', 'GitHub', 'GitLab',
        '分词', '停用词', '词性', '标注', '命名实体', '实体识别', '句法分析', '语义',
        '词频', '文本', '语料', '语料库', '词典', '词库', '词表', '词条', '词汇',
        '中文', '英文', '语言', '翻译', '国际化', '本地化', '编码', '解码', '字符',
        '过滤', '筛选', '排序', '分组', '聚合', '统计', '分析', '处理', '转换'
      ],
      common: [
        '我们', '你们', '他们', '它们', '自己', '大家', '什么', '怎么', '如何', '为什么',
        '这个', '那个', '这些', '那些', '这里', '那里', '哪里', '某', '每', '各',
        '可以', '可能', '应该', '需要', '必须', '能够', '已经', '正在', '将要', '曾经',
        '因为', '所以', '但是', '然而', '不过', '而且', '或者', '以及', '如果', '虽然',
        '时候', '地方', '方面', '问题', '原因', '结果', '方法', '过程', '情况', '状态',
        '东西', '事情', '人物', '动物', '植物', '食物', '物品', '产品', '商品', '作品',
        '时间', '空间', '世界', '国家', '城市', '地区', '社区', '家庭', '公司', '组织',
        '工作', '学习', '生活', '休息', '运动', '娱乐', '旅游', '购物', '餐饮', '交通',
        '学校', '医院', '银行', '商店', '市场', '公园', '广场', '街道', '建筑', '设施',
        '手机', '电脑', '电视', '相机', '音响', '冰箱', '空调', '洗衣机', '微波炉',
        '今天', '明天', '昨天', '上午', '下午', '晚上', '现在', '以前', '以后', '最近',
        '一年', '一月', '一日', '小时', '分钟', '秒钟', '星期', '周末', '假期', '节日',
        '春天', '夏天', '秋天', '冬天', '天气', '晴天', '雨天', '雪天', '温度', '气候',
        '开始', '结束', '继续', '停止', '暂停', '恢复', '完成', '取消', '确认', '提交',
        '增加', '减少', '提高', '降低', '扩大', '缩小', '加强', '削弱', '优化', '改进',
        '分析', '研究', '调查', '统计', '计算', '测量', '评估', '预测', '规划', '设计',
        '管理', '组织', '协调', '沟通', '合作', '竞争', '发展', '创新', '变革', '转型',
        '思想', '观念', '理念', '理论', '实践', '经验', '知识', '技能', '能力', '素质',
        '重要', '主要', '关键', '核心', '基本', '一般', '特殊', '具体', '抽象', '简单',
        '复杂', '容易', '困难', '快速', '缓慢', '稳定', '变化', '动态', '静态', '持续'
      ],
      ai: [
        '人工智能', '智能', '自动化', '机器人', '自动驾驶', '智能家居', '智慧城市',
        '语音识别', '图像识别', '人脸识别', '文字识别', '语音合成', '机器翻译',
        '对话系统', '问答系统', '推荐系统', '搜索引擎', '信息检索', '知识图谱',
        '情感分析', '文本分类', '命名实体识别', '关键词提取', '自动摘要', '机器写作',
        '强化学习', '监督学习', '无监督学习', '半监督学习', '迁移学习', '联邦学习',
        '卷积神经网络', '循环神经网络', '生成对抗网络', '注意力机制', '自注意力',
        '预训练', '微调', '提示工程', '上下文学习', '思维链', '多模态', '跨模态',
        'ChatGPT', 'Claude', 'Gemini', 'LLaMA', '通义千问', '文心一言', '讯飞星火',
        '大语言模型', '语言模型', '生成模型', '判别模型', '基础模型', '垂类模型'
      ]
    };

    let frequency = 1;
    const categories = Object.keys(CHINESE_DICTIONARY);
    const totalCategories = categories.length;
    
    categories.forEach((category, catIndex) => {
      const words = CHINESE_DICTIONARY[category];
      const baseFreq = (totalCategories - catIndex) * 1000;
      
      words.forEach((word, wordIndex) => {
        if (word && word.length > 0) {
          this.wordSet.add(word);
          
          if (word.length > this.maxWordLength) {
            this.maxWordLength = word.length;
          }
          
          const wordFreq = baseFreq + (words.length - wordIndex);
          this.wordFrequency.set(word, wordFreq);
        }
      });
    });
    
    this.maxWordLength = Math.min(this.maxWordLength, 8);
  }

  has(word) {
    return this.wordSet.has(word);
  }

  getFrequency(word) {
    return this.wordFrequency.get(word) || 0;
  }

  getMaxWordLength() {
    return this.maxWordLength;
  }

  isStopword(word) {
    const STOPWORDS = new Set([
      '的', '了', '和', '是', '就', '都', '而', '及', '与', '着', '或', '把', '被', '让',
      '给', '向', '从', '到', '在', '有', '这', '那', '之', '以', '为', '于', '上', '下',
      '不', '也', '很', '最', '更', '还', '又', '再', '才', '只', '刚', '已', '正', '将',
      '要', '能', '会', '可', '得', '地', '过', '啊', '呢', '吧', '吗', '呀', '哦', '嗯',
      '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万', '亿',
      '个', '些', '次', '位', '名', '只', '条', '件', '种', '类', '样', '回', '遍', '番',
      '里', '外', '前', '后', '左', '右', '中', '东', '西', '南', '北', '旁', '侧', '邻'
    ]);
    return STOPWORDS.has(word);
  }
}

/**
 * 中文分词器（双向最大匹配算法）
 */
class ChineseTokenizer {
  constructor(options = {}) {
    this.dictionary = new ChineseDictionary();
    this.maxWordLength = this.dictionary.getMaxWordLength();
    this.options = {
      useBidirectional: options.useBidirectional !== false,
      mergeUnknown: options.mergeUnknown !== false
    };
  }

  forwardMaxMatch(text) {
    const result = [];
    let i = 0;
    const len = text.length;

    while (i < len) {
      let matched = false;
      const maxLen = Math.min(this.maxWordLength, len - i);

      for (let j = maxLen; j >= 2; j--) {
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

  filterStopwords(tokens) {
    return tokens.filter(token => !this.dictionary.isStopword(token));
  }
}

/**
 * 初始化分词器
 */
const tokenizer = new ChineseTokenizer();

/**
 * 中文分词
 */
function tokenize(text) {
  if (!text) return [];
  
  const chineseTokens = tokenizer.segment(text);
  
  const englishPattern = /[a-zA-Z]{2,}/g;
  const numberPattern = /\d+/g;
  
  const english = text.match(englishPattern) || [];
  const numbers = text.match(numberPattern) || [];
  
  return [...chineseTokens, ...english, ...numbers];
}

/**
 * 提取关键词
 */
function extractKeywords(text, topN = 10) {
  if (!text) return [];
  
  const tokens = tokenize(text);
  const filteredTokens = tokenizer.filterStopwords(tokens);
  const keywords = filteredTokens.filter(t => t && t.length >= 2);
  const uniqueKeywords = [...new Set(keywords)];
  
  return uniqueKeywords.slice(0, topN);
}

/**
 * 实体识别
 */
function extractEntities(text) {
  if (!text) return [];
  const entities = [];
  
  const locationPattern = /(北京|上海|广州|深圳|杭州|南京|成都|武汉|西安|重庆|天津|苏州|长沙|青岛|沈阳|大连|哈尔滨|济南|郑州|昆明|福州|厦门|南宁|贵阳|兰州|乌鲁木齐|呼和浩特|银川|西宁|拉萨|台北|香港|澳门)/;
  const orgPattern = /(公司|集团|大学|学院|研究院|医院|银行|政府|部门)/;
  const personPattern = /[张王李赵刘陈杨黄吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾萧田董袁潘于蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦付方白邹孟熊秦邱江尹薛闫段雷侯龙史陶黎贺顾毛郝龚邵万钱严覃武戴莫孔向汤]/;
  
  const names = text.match(new RegExp(personPattern.source + '[\\u4e00-\\u9fa5]{1,2}', 'g')) || [];
  const locations = text.match(locationPattern) || [];
  const orgs = text.split(/，,。！？、；：\s+/).filter(word => orgPattern.test(word));
  
  names.forEach(name => entities.push({ text: name, type: 'PERSON' }));
  locations.forEach(loc => entities.push({ text: loc, type: 'LOCATION' }));
  orgs.forEach(org => entities.push({ text: org, type: 'ORGANIZATION' }));
  
  return entities;
}

/**
 * 生成摘要
 */
function generateSummary(text) {
  if (!text) return '';
  const maxLength = 100;
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * 检测语言
 */
function detectLanguage(text) {
  if (!text) return 'unknown';
  const chineseCount = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishCount = (text.match(/[a-zA-Z]/g) || []).length;
  
  if (chineseCount > englishCount) return 'zh';
  if (englishCount > chineseCount) return 'en';
  return 'mixed';
}

/**
 * 生成统计信息
 */
function generateStats(text, tokens, keywords, entities) {
  if (!text) return null;
  return {
    charCount: text.length,
    wordCount: tokens.length,
    keywordCount: keywords.length,
    entityCount: entities.length,
    sentenceCount: (text.match(/[。！？.!?]/g) || []).length
  };
}

async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['tasks', 'top-n']
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  if (positionalArgs.length === 0) {
    console.error('错误: 请提供待分析的文本');
    process.exit(1);
  }

  const text = positionalArgs[0];
  
  if (!text || text.trim() === '') {
    console.error('错误: 请提供待分析的文本');
    process.exit(1);
  }

  let tasks = options.tasks ? options.tasks.split(',') : ['tokenize', 'entities', 'keywords'];
  const topN = options['top-n'] ? parseInt(options['top-n'], 10) || 10 : 10;

  if (tasks.includes('all')) {
    tasks = ['tokenize', 'entities', 'keywords', 'summary'];
  }

  try {
    const result = {
      success: true,
      text: text
    };

    if (tasks.includes('tokenize')) {
      const tokens = tokenize(text);
      result.tokens = tokens;
      result.tokenCount = tokens.length;
    }

    if (tasks.includes('keywords')) {
      const keywords = extractKeywords(text, topN);
      result.keywords = keywords;
      result.keywordCount = keywords.length;
    }

    if (tasks.includes('entities')) {
      const entities = extractEntities(text);
      result.entities = entities;
      result.entityCount = entities.length;
    }

    if (tasks.includes('summary')) {
      result.summary = generateSummary(text);
    }

    result.language = detectLanguage(text);

    const allTokens = tokenize(text);
    const allKeywords = extractKeywords(text, topN);
    const allEntities = extractEntities(text);
    result.stats = generateStats(text, allTokens, allKeywords, allEntities);

    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({
      success: false,
      error: error.message
    }, null, 2));
    process.exit(1);
  }
}

main();
