/**
 * Reranker - 嵌入重排器
 * 负责对搜索结果进行基于嵌入的重排，提高搜索结果的相关性
 */

/**
 * Reranker 类
 * 管理重排流程，包括批量嵌入生成、相似度计算和分数融合
 */
class Reranker {
  /**
   * 构造函数
   * @param {Object} embeddingManager - Embedding 管理器实例
   * @param {Object} options - 配置选项
   * @param {number} options.rerankTopK - 重排前K个结果
   * @param {number} options.rerankWeight - 重排分数权重 (0-1)
   * @param {boolean} options.enableCache - 是否启用缓存
   * @param {number} options.cacheSize - 缓存大小
   * @param {number} options.batchSize - 批量处理大小
   * @param {boolean} options.preserveOriginalScore - 是否保留原始分数
   */
  constructor(embeddingManager, options = {}) {
    this.embeddingManager = embeddingManager;
    this.rerankTopK = options.rerankTopK || 50;
    this.rerankWeight = options.rerankWeight || 0.5;
    this.enableCache = options.enableCache !== false;
    this.cacheSize = options.cacheSize || 1000;
    this.batchSize = options.batchSize || 10;
    this.preserveOriginalScore = options.preserveOriginalScore !== false;
    this.enableSegmentRerank = options.enableSegmentRerank !== false;
    this.segmentMaxLength = options.segmentMaxLength || 8000;
    this.segmentOverlap = options.segmentOverlap || 200;

    this.cache = new Map();
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalReranks: 0,
      totalRerankTime: 0,
      segmentRerankCount: 0
    };
    
    this.maxCandidates = 100;
    this.maxContentLength = options.maxContentLength || 4000;
    this.embeddingTimeout = 30000;
  }

  /**
   * 对搜索结果进行重排
   * @param {string} query - 搜索查询
   * @param {Array} candidates - 候选结果数组
   * @param {Object} options - 重排选项
   * @returns {Promise<Array>} 重排后的结果数组
   */
  async rerank(query, candidates, options = {}) {
    const startTime = Date.now();

    if (!candidates || candidates.length === 0) {
      console.warn('重排器收到空候选结果');
      return [];
    }

    const limitedCandidates = candidates.slice(0, Math.min(this.rerankTopK, this.maxCandidates));
    const preserveOriginalScore = options.preserveOriginalScore ?? this.preserveOriginalScore;

    console.error(`重排器准备处理 ${limitedCandidates.length} 个候选结果 (TopK: ${this.rerankTopK}, 限制: ${this.maxCandidates})`);

    try {
      console.error('生成查询嵌入...');
      const queryEmbedding = await this.generateEmbeddingWithTimeout(query);
      if (!queryEmbedding || queryEmbedding.length === 0) {
        console.error('查询嵌入生成失败，返回原始结果');
        return candidates;
      }
      console.error('查询嵌入生成完成，维度:', queryEmbedding?.length);

      console.error('批量生成候选结果嵌入...');
      const candidateEmbeddingPairs = await this.batchGenerateEmbeddings(limitedCandidates);
      console.error('候选结果嵌入生成完成，数量:', candidateEmbeddingPairs.length);

      if (candidateEmbeddingPairs.length === 0) {
        console.error('候选嵌入生成失败，返回原始结果');
        return candidates;
      }

      const validEmbeddings = candidateEmbeddingPairs
        .filter(pair => pair.embedding !== null)
        .map(pair => pair.embedding);
      
      const rerankScoresMap = new Map();
      
      if (validEmbeddings.length > 0) {
        const rerankScores = this.calculateSimilarities(queryEmbedding, validEmbeddings);
        console.error('相似度计算完成，分数样例:', rerankScores.slice(0, 3));
        
        let scoreIndex = 0;
        candidateEmbeddingPairs.forEach(pair => {
          if (pair.embedding !== null) {
            rerankScoresMap.set(pair.candidate.id, rerankScores[scoreIndex++] || 0);
          } else {
            rerankScoresMap.set(pair.candidate.id, 0);
          }
        });
      } else {
        candidateEmbeddingPairs.forEach(pair => {
          rerankScoresMap.set(pair.candidate.id, 0);
        });
      }

      const finalScores = limitedCandidates.map((candidate) => {
        const originalScore = candidate.relevanceScore || 0;
        const rerankScore = rerankScoresMap.get(candidate.id) || 0;

        if (preserveOriginalScore) {
          const finalScore = originalScore * (1 - this.rerankWeight) + rerankScore * this.rerankWeight;
          return {
            ...candidate,
            rerankScore,
            finalScore,
            relevanceScore: originalScore,
            originalScore
          };
        } else {
          return {
            ...candidate,
            rerankScore,
            finalScore: rerankScore,
            relevanceScore: rerankScore,
            originalScore
          };
        }
      });

      const sortedResults = finalScores.sort((a, b) => b.finalScore - a.finalScore);

      const rerankTime = Date.now() - startTime;
      this.stats.totalReranks++;
      this.stats.totalRerankTime += rerankTime;

      console.error(`重排完成，耗时 ${rerankTime}ms`);
      return sortedResults;
    } catch (error) {
      console.error('重排失败:', error.message);
      console.error('错误堆栈:', error.stack);
      console.error('错误详情:', error);
      return candidates;
    }
  }

  /**
   * 带超时的嵌入生成
   * @param {string} text - 输入文本
   * @returns {Promise<Array>} 嵌入向量
   */
  async generateEmbeddingWithTimeout(text) {
    const truncatedText = text.length > this.maxContentLength 
      ? text.substring(0, this.maxContentLength) 
      : text;
    
    return Promise.race([
      this.embeddingManager.generateEmbedding(truncatedText),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('嵌入生成超时')), this.embeddingTimeout)
      )
    ]);
  }

  /**
   * 批量生成候选结果的嵌入向量
   * @param {Array} candidates - 候选结果数组
   * @returns {Promise<Array>} 包含候选和嵌入的数组 [{ candidate, embedding }]
   */
  async batchGenerateEmbeddings(candidates) {
    if (!candidates || candidates.length === 0) {
      console.warn('batchGenerateEmbeddings 收到空候选数组');
      return [];
    }

    console.error(`开始批量生成 ${candidates.length} 个候选结果的嵌入...`);
    const results = [];
    const maxBatchTime = 120000;
    
    for (let i = 0; i < candidates.length; i += this.batchSize) {
      const batchStartTime = Date.now();
      const batch = candidates.slice(i, i + this.batchSize);
      console.error(`处理批次 ${Math.floor(i / this.batchSize) + 1}, 包含 ${batch.length} 个候选`);
      
      try {
        const batchResults = await Promise.all(
          batch.map(async (candidate, idx) => {
            try {
              const embedding = await this.generateCandidateEmbedding(candidate);
              return { candidate, embedding };
            } catch (error) {
              console.error(`候选 ${idx + 1}/${batch.length} 嵌入生成失败:`, error.message);
              return { candidate, embedding: null };
            }
          })
        );
        
        results.push(...batchResults);
        
        const batchTime = Date.now() - batchStartTime;
        console.error(`批次 ${Math.floor(i / this.batchSize) + 1} 完成，耗时 ${batchTime}ms`);
        
        if (batchTime > maxBatchTime) {
          console.warn(`批次处理时间过长 (${batchTime}ms)，跳过剩余批次`);
          break;
        }
      } catch (error) {
        console.error(`批次 ${Math.floor(i / this.batchSize) + 1} 生成嵌入失败:`, error.message);
        console.error('错误堆栈:', error.stack);
        batch.forEach(candidate => {
          results.push({ candidate, embedding: null });
        });
      }
    }

    console.error(`批量生成完成，总共处理 ${results.length} 个候选`);
    return results;
  }

  /**
   * 生成单个候选结果的嵌入向量
   * @param {Object} candidate - 候选结果
   * @returns {Promise<Array>} 嵌入向量
   */
  async generateCandidateEmbedding(candidate) {
    const cacheKey = this.getCacheKey(candidate);
    console.error(`检查缓存，key: ${cacheKey.substring(0, 20)}...，缓存启用: ${this.enableCache}`);

    if (this.enableCache && this.cache.has(cacheKey)) {
      console.error(`缓存命中！跳过生成`);
      this.stats.cacheHits++;
      return this.cache.get(cacheKey);
    }

    console.error(`缓存未命中，开始生成嵌入`);
    this.stats.cacheMisses++;

    const content = this.extractContent(candidate);
    console.error(`提取内容类型: ${Array.isArray(content) ? `分段(${content.length}段)` : `单段(${content.length}字符)`}`);

    let embedding;
    if (Array.isArray(content)) {
      // 多段内容，生成多个嵌入并融合
      this.stats.segmentRerankCount++;
      embedding = await this.generateMultiSegmentEmbedding(content);
    } else {
      // 单段内容，使用带超时和截断的嵌入生成
      embedding = await this.generateEmbeddingWithTimeout(content);
    }

    console.error(`嵌入生成完成，维度: ${embedding.length}`);

    if (this.enableCache) {
      this.cache.set(cacheKey, embedding);
      if (this.cache.size > this.cacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
    }

    return embedding;
  }

  /**
   * 为多段内容生成融合的嵌入向量
   * @param {Array<string>} segments - 分段内容数组
   * @returns {Promise<Array>} 融合后的嵌入向量
   */
  async generateMultiSegmentEmbedding(segments) {
    if (!segments || segments.length === 0) {
      return null;
    }

    const maxSegments = 20;
    const limitedSegments = segments.slice(0, maxSegments);

    const embeddings = await Promise.all(
      limitedSegments.map((segment, idx) => {
        return this.generateEmbeddingWithTimeout(segment);
      })
    );

    const validEmbeddings = embeddings.filter(e => e !== null && e.length > 0);

    if (validEmbeddings.length === 0) {
      return null;
    }

    const fusedEmbedding = this.averageEmbeddings(validEmbeddings);
    return fusedEmbedding;
  }

  /**
   * 计算多个嵌入向量的平均值
   * @param {Array<Array<number>>} embeddings - 嵌入向量数组
   * @returns {Array<number>} 平均嵌入向量
   */
  averageEmbeddings(embeddings) {
    if (!embeddings || embeddings.length === 0) {
      return [];
    }

    const dimension = embeddings[0].length;
    const averaged = new Array(dimension).fill(0);

    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        averaged[i] += embedding[i];
      }
    }

    for (let i = 0; i < dimension; i++) {
      averaged[i] /= embeddings.length;
    }

    return averaged;
  }

  /**
   * 计算查询嵌入与候选结果嵌入之间的相似度
   * @param {Array} queryEmbedding - 查询嵌入向量
   * @param {Array} candidateEmbeddings - 候选结果嵌入向量数组
   * @returns {Array} 相似度分数数组
   */
  calculateSimilarities(queryEmbedding, candidateEmbeddings) {
    if (!queryEmbedding || !candidateEmbeddings || candidateEmbeddings.length === 0) {
      return [];
    }

    return candidateEmbeddings.map(candidateEmbedding => {
      return this.cosineSimilarity(queryEmbedding, candidateEmbedding);
    });
  }

  /**
   * 计算余弦相似度
   * @param {Array} vec1 - 向量1
   * @param {Array} vec2 - 向量2
   * @returns {number} 余弦相似度 (0-1)
   */
  cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * 归一化重排分数到 0-1 范围
   * @param {Array} results - 重排结果数组
   * @returns {Array} 归一化后的结果数组
   */
  normalizeScores(results) {
    if (!results || results.length === 0) {
      return results;
    }

    const finalScores = results.map(r => r.finalScore || 0);
    const rerankScores = results.map(r => r.rerankScore || 0);
    
    const minFinalScore = Math.min(...finalScores);
    const maxFinalScore = Math.max(...finalScores);
    const minRerankScore = Math.min(...rerankScores);
    const maxRerankScore = Math.max(...rerankScores);

    return results.map(result => {
      let normalizedFinalScore = result.finalScore || 0;
      let normalizedRerankScore = result.rerankScore || 0;

      if (maxFinalScore - minFinalScore > 0) {
        normalizedFinalScore = (result.finalScore - minFinalScore) / (maxFinalScore - minFinalScore);
      }

      if (maxRerankScore - minRerankScore > 0) {
        normalizedRerankScore = (result.rerankScore - minRerankScore) / (maxRerankScore - minRerankScore);
      }

      return {
        ...result,
        finalScore: normalizedFinalScore,
        rerankScore: normalizedRerankScore
      };
    });
  }

  /**
   * 从候选结果中提取内容用于生成嵌入
   * @param {Object} candidate - 候选结果
   * @returns {string|Array} 提取的内容，支持分段重排时返回数组
   */
  extractContent(candidate) {
    if (!candidate) {
      return '';
    }

    const content = candidate.content || candidate.contentPreview || candidate.excerpt || '';
    const title = candidate.title || '';

    let extractedContent = '';
    if (title && content) {
      extractedContent = `${title}\n\n${content}`;
    } else if (title) {
      extractedContent = title;
    } else {
      extractedContent = content;
    }

    // 如果启用分段重排且内容超过最大长度，则进行分段
    if (this.enableSegmentRerank && extractedContent.length > this.segmentMaxLength) {
      return this.segmentContent(extractedContent);
    }

    // 单段内容，直接返回字符串
    return extractedContent;
  }

  /**
   * 将长内容分段
   * @param {string} content - 原始内容
   * @returns {Array<string>} 分段后的内容数组
   */
  segmentContent(content) {
    const segments = [];
    let startIndex = 0;
    const maxIterations = Math.ceil(content.length / (this.segmentMaxLength - this.segmentOverlap)) + 10;
    let iterations = 0;

    while (startIndex < content.length) {
      iterations++;
      if (iterations > maxIterations) {
        console.warn(`分段循环超过最大迭代次数 ${maxIterations}，强制退出`);
        break;
      }

      const endIndex = Math.min(startIndex + this.segmentMaxLength, content.length);
      let segment = content.substring(startIndex, endIndex);
      let actualEndIndex = endIndex;

      if (endIndex < content.length) {
        const lastParagraphEnd = Math.max(
          segment.lastIndexOf('\n\n'),
          segment.lastIndexOf('\n'),
          segment.lastIndexOf('。'),
          segment.lastIndexOf('.')
        );

        if (lastParagraphEnd > this.segmentMaxLength - this.segmentOverlap && lastParagraphEnd > 0) {
          segment = content.substring(startIndex, startIndex + lastParagraphEnd + 1);
          actualEndIndex = startIndex + lastParagraphEnd + 1;
        }
      }

      const trimmedSegment = segment.trim();
      
      if (trimmedSegment.length > 10) {
        segments.push(trimmedSegment);
      }
      
      const segmentLength = segment.length;
      
      if (segmentLength === 0) {
        break;
      }

      const minProgress = Math.max(Math.floor(this.segmentMaxLength * 0.5), 100);
      const progress = Math.max(segmentLength - this.segmentOverlap, minProgress);
      
      startIndex = Math.max(startIndex + progress, actualEndIndex);
      
      if (startIndex >= content.length) {
        break;
      }
    }

    if (segments.length === 0) {
      return [content.substring(0, Math.min(content.length, this.segmentMaxLength))];
    }

    return segments;
  }

  /**
   * 生成缓存键
   * @param {Object} candidate - 候选结果
   * @returns {string} 缓存键
   */
  getCacheKey(candidate) {
    if (!candidate) {
      return '';
    }

    const id = candidate.id || candidate.originalId || '';
    const content = this.extractContent(candidate);

    // 处理分段内容的情况
    let contentStr = '';
    if (Array.isArray(content)) {
      contentStr = content.join('');
    } else {
      contentStr = content;
    }

    const hash = this.simpleHash(id + contentStr.substring(0, 200));
    return `${id}_${hash}`;
  }

  /**
   * 简单的哈希函数
   * @param {string} str - 输入字符串
   * @returns {string} 哈希值
   */
  simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计信息
   */
  getCacheStats() {
    const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.stats.cacheHits / totalRequests * 100).toFixed(2) : 0;
    const avgRerankTime = this.stats.totalReranks > 0 
      ? (this.stats.totalRerankTime / this.stats.totalReranks).toFixed(2) 
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.cacheSize,
      hits: this.stats.cacheHits,
      misses: this.stats.cacheMisses,
      hitRate: `${hitRate}%`,
      totalReranks: this.stats.totalReranks,
      avgRerankTime: `${avgRerankTime}ms`
    };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalReranks: 0,
      totalRerankTime: 0
    };
  }
}

module.exports = Reranker;