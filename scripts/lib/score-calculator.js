/**
 * ScoreCalculator - 分数计算器
 * 统一管理各种分数的计算和组合，包括相关性分数、向量分数、重排分数等
 */

/**
 * ScoreCalculator 类
 * 提供统一的分数计算接口
 */
class ScoreCalculator {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.defaultDenseWeight - 默认密集向量权重 (默认 0.7)
   * @param {number} options.defaultSparseWeight - 默认稀疏向量权重 (默认 0.3)
   * @param {number} options.defaultSqlWeight - 默认SQL搜索权重 (默认 0)
   * @param {number} options.defaultRerankWeight - 默认重排权重 (默认 0.5)
   */
  constructor(options = {}) {
    this.defaultDenseWeight = options.defaultDenseWeight ?? 0.7;
    this.defaultSparseWeight = options.defaultSparseWeight ?? 0.3;
    this.defaultSqlWeight = options.defaultSqlWeight ?? 0;
    this.defaultRerankWeight = options.defaultRerankWeight ?? 0.5;
  }

  /**
   * 计算最终综合分数
   * @param {Object} params - 分数参数
   * @param {number} params.relevanceScore - 相关性分数（可选）
   * @param {number} params.denseScore - 密集向量分数（可选）
   * @param {number} params.sparseScore - 稀疏向量分数（可选）
   * @param {number} params.sqlScore - SQL搜索分数（可选）
   * @param {number} params.rerankScore - 重排分数（可选）
   * @param {Object} params.weights - 权重配置（可选）
   * @param {number} params.weights.dense - 密集向量权重
   * @param {number} params.weights.sparse - 稀疏向量权重
   * @param {number} params.weights.sql - SQL搜索权重
   * @param {number} params.weights.rerank - 重排权重
   * @returns {number} 最终综合分数 (0-1)
   */
  calculateFinalScore(params = {}) {
    const {
      relevanceScore = 0,
      denseScore = null,
      sparseScore = null,
      sqlScore = null,
      rerankScore = null,
      weights = {}
    } = params;

    const mergedWeights = {
      dense: weights.dense ?? this.defaultDenseWeight,
      sparse: weights.sparse ?? this.defaultSparseWeight,
      sql: weights.sql ?? this.defaultSqlWeight,
      rerank: weights.rerank ?? this.defaultRerankWeight
    };

    let baseScore;

    if (denseScore !== null || sparseScore !== null) {
      baseScore = this.calculateVectorScore(denseScore, sparseScore, mergedWeights);
    } else if (sqlScore !== null) {
      baseScore = sqlScore;
    } else {
      baseScore = relevanceScore;
    }

    if (sqlScore !== null && (denseScore !== null || sparseScore !== null)) {
      const totalWeight = mergedWeights.dense + mergedWeights.sparse + mergedWeights.sql;
      if (totalWeight > 0) {
        const vectorWeight = mergedWeights.dense + mergedWeights.sparse;
        baseScore = (baseScore * vectorWeight + sqlScore * mergedWeights.sql) / totalWeight;
      }
    }

    if (rerankScore !== null) {
      baseScore = baseScore * (1 - mergedWeights.rerank) + rerankScore * mergedWeights.rerank;
    }

    return Math.max(0, Math.min(1, baseScore));
  }

  /**
   * 计算向量分数
   * @param {number|null} denseScore - 密集向量分数
   * @param {number|null} sparseScore - 稀疏向量分数
   * @param {Object} weights - 权重配置
   * @param {number} weights.dense - 密集向量权重
   * @param {number} weights.sparse - 稀疏向量权重
   * @returns {number} 向量分数 (0-1)
   */
  calculateVectorScore(denseScore, sparseScore, weights = {}) {
    const denseWeight = weights.dense ?? this.defaultDenseWeight;
    const sparseWeight = weights.sparse ?? this.defaultSparseWeight;

    if (denseScore === null && sparseScore === null) {
      return 0;
    }

    const totalWeight = denseWeight + sparseWeight;
    if (totalWeight === 0) return 0;

    let score = 0;
    let weightSum = 0;

    if (denseScore !== null) {
      score += denseScore * denseWeight;
      weightSum += denseWeight;
    }

    if (sparseScore !== null) {
      score += sparseScore * sparseWeight;
      weightSum += sparseWeight;
    }

    return weightSum > 0 ? score / weightSum : 0;
  }

  /**
   * 归一化分数到指定范围
   * @param {number} score - 原始分数
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 归一化后的分数
   */
  normalize(score, min = 0, max = 1) {
    if (typeof score !== 'number' || isNaN(score)) {
      return 0;
    }
    if (max === min) {
      return 0.5;
    }
    return Math.max(0, Math.min(1, (score - min) / (max - min)));
  }

  /**
   * 计算相关性分数（归一化到 0-1 范围）
   * @param {string} content - 内容文本
   * @param {string} query - 搜索查询
   * @param {Array<string>} tags - 标签数组
   * @returns {number} 相关性分数 (0-1)
   */
  calculateRelevanceScore(content, query, tags = []) {
    if (!content || !query) {
      return 0;
    }

    let score = 0;
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();

    if (contentLower.includes(queryLower)) {
      score += 0.4;
    }

    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 2);
    const matchedWords = queryWords.filter(word => contentLower.includes(word));
    if (queryWords.length > 0) {
      score += 0.3 * (matchedWords.length / queryWords.length);
    }

    const contentLengthBonus = Math.min(content.length / 5000, 0.1);
    score += contentLengthBonus;

    const tagBonus = Math.min(tags.length * 0.02, 0.1);
    score += tagBonus;

    if (content.startsWith('#')) {
      const headingMatch = content.match(/^#{1,6}/);
      if (headingMatch) {
        const headingLevel = headingMatch[0].length;
        score += (7 - headingLevel) * 0.02;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 创建标准化的分数对象
   * @param {Object} params - 分数参数
   * @returns {Object} 标准化的分数对象
   */
  createScoreObject(params = {}) {
    const {
      relevanceScore = 0,
      denseScore = null,
      sparseScore = null,
      sqlScore = null,
      rerankScore = null,
      weights = {}
    } = params;

    const finalScore = this.calculateFinalScore(params);
    const vectorScore = this.calculateVectorScore(denseScore, sparseScore, weights);

    return {
      relevance: relevanceScore,
      vector: {
        dense: denseScore,
        sparse: sparseScore,
        combined: vectorScore
      },
      sql: sqlScore,
      rerank: rerankScore,
      final: finalScore
    };
  }

  /**
   * 批量计算分数
   * @param {Array<Object>} items - 需要计算分数的项目数组
   * @param {string} query - 搜索查询
   * @param {Object} options - 选项
   * @returns {Array<Object>} 添加了分数的项目数组
   */
  batchCalculateScores(items, query, options = {}) {
    if (!Array.isArray(items)) {
      return [];
    }

    return items.map(item => {
      const content = item.content || '';
      const tags = item.tags || [];
      const relevanceScore = this.calculateRelevanceScore(content, query, tags);

      return {
        ...item,
        scores: this.createScoreObject({
          relevanceScore,
          denseScore: item.denseScore || null,
          sparseScore: item.sparseScore || null,
          sqlScore: item.sqlScore || null,
          rerankScore: item.rerankScore || null,
          weights: options.weights
        })
      };
    });
  }
}

module.exports = ScoreCalculator;