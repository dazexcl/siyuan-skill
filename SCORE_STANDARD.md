# 搜索分数统一标准

## 核心原则
- **分数越高，表示相似度/相关性越高**
- **所有分数范围统一为 0-1**
- **分数字段语义明确，避免歧义**

## 分数字段定义

### 1. score (主分数)
- **用途**: 最终排序使用的分数
- **范围**: 0-1
- **语义**: 分数越高，表示结果与查询越相关
- **优先级**:
  - 如果启用了 rerank，使用 rerankScore
  - 否则使用 finalScore
  - 最后使用 relevanceScore

### 2. relevanceScore (原始相关性分数)
- **用途**: 搜索引擎返回的原始相关性分数
- **范围**: 0-1
- **语义**:
  - legacy 模式: 基于 SQL 搜索的相关性计算分数
  - semantic 模式: 语义向量相似度 (余弦相似度)
  - keyword 模式: 关键词向量相似度
  - hybrid 模式: 加权融合后的分数

### 3. finalScore (最终分数)
- **用途**: 经过处理后的最终分数
- **范围**: 0-1
- **语义**:
  - 无 rerank 时: 等于 relevanceScore
  - 有 rerank 时: 等于原始分数和重排分数的加权平均

### 4. rerankScore (重排分数)
- **用途**: 基于嵌入的重排分数
- **范围**: 0-1
- **语义**: 基于查询和内容的嵌入相似度计算的重排分数
- **条件**: 仅在启用 rerank 时存在

### 5. originalVectorScore (原始向量分数)
- **用途**: 向量搜索的原始分数
- **范围**: 0-1
- **语义**: 来自 Qdrant 的原始向量搜索分数
- **条件**: 仅在向量搜索模式中存在

### 6. originalSqlScore (原始 SQL 分数)
- **用途**: SQL 搜索的原始分数
- **范围**: 0-1
- **语义**: 来自 SQL 搜索的相关性分数
- **条件**: 仅在混合搜索中存在

### 7. denseScore (密集向量分数)
- **用途**: 语义搜索的分数
- **范围**: 0-1
- **语义**: 密集向量 (Dense Vector) 的相似度分数
- **条件**: 仅在 semantic 或 hybrid 模式中存在

### 8. sparseScore (稀疏向量分数)
- **用途**: 关键词搜索的分数
- **范围**: 0-1
- **语义**: 稀疏向量 (Sparse Vector) 的相似度分数
- **条件**: 仅在 keyword 或 hybrid 模式中存在

## 各搜索模式的分数设置

### Legacy 模式 (SQL 搜索)
```javascript
{
  score: relevanceScore,           // = relevanceScore
  relevanceScore: 0.0-1.0,         // 基于 SQL 搜索计算
  finalScore: relevanceScore,      // = relevanceScore
  rerankScore: null,               // 不启用 rerank 时为 null
  originalVectorScore: null,       // 不使用向量搜索
  originalSqlScore: null,          // 不使用混合搜索
  denseScore: undefined,           // 不使用密集向量
  sparseScore: undefined           // 不使用稀疏向量
}
```

### Semantic 模式 (语义搜索)
```javascript
{
  score: rerankScore || relevanceScore,  // 优先使用 rerankScore
  relevanceScore: 0.0-1.0,              // 来自向量搜索的相似度
  finalScore: relevanceScore,           // = relevanceScore
  rerankScore: 0.0-1.0 | null,          // 启用 rerank 时存在
  originalVectorScore: 0.0-1.0,         // 来自 Qdrant 的原始分数
  originalSqlScore: null,               // 不使用 SQL 搜索
  denseScore: 0.0-1.0,                  // 密集向量分数
  sparseScore: undefined                // 不使用稀疏向量
}
```

### Keyword 模式 (关键词搜索)
```javascript
{
  score: rerankScore || relevanceScore,  // 优先使用 rerankScore
  relevanceScore: 0.0-1.0,              // 来自向量搜索的相似度
  finalScore: relevanceScore,           // = relevanceScore
  rerankScore: 0.0-1.0 | null,          // 启用 rerank 时存在
  originalVectorScore: 0.0-1.0,         // 来自 Qdrant 的原始分数
  originalSqlScore: null,               // 不使用 SQL 搜索
  denseScore: undefined,                // 不使用密集向量
  sparseScore: 0.0-1.0                  // 稀疏向量分数
}
```

### Hybrid 模式 (混合搜索)
```javascript
{
  score: rerankScore || relevanceScore,  // 优先使用 rerankScore
  relevanceScore: 0.0-1.0,              // 加权融合后的分数
  finalScore: relevanceScore,           // = relevanceScore
  rerankScore: 0.0-1.0 | null,          // 启用 rerank 时存在
  originalVectorScore: 0.0-1.0,         // 来自向量搜索的原始分数
  originalSqlScore: 0.0-1.0,            // 来自 SQL 搜索的原始分数
  denseScore: 0.0-1.0,                  // 密集向量分数
  sparseScore: 0.0-1.0                  // 稀疏向量分数
}
```

### 带 Rerank 的模式
```javascript
{
  score: rerankScore,                   // = rerankScore
  relevanceScore: 0.0-1.0,              // 原始相关性分数
  finalScore: relevanceScore,           // = relevanceScore
  rerankScore: 0.0-1.0,                 // 重排分数 (嵌入相似度)
  originalVectorScore: 0.0-1.0 | null,  // 来自向量搜索的原始分数
  originalSqlScore: 0.0-1.0 | null,     // 来自 SQL 搜索的原始分数
  denseScore: 0.0-1.0 | undefined,      // 密集向量分数
  sparseScore: 0.0-1.0 | undefined      // 稀疏向量分数
}
```

## Rerank 分数计算

### preserveOriginalScore = true (默认)
```javascript
finalScore = originalScore * (1 - rerankWeight) + rerankScore * rerankWeight
```

### preserveOriginalScore = false
```javascript
finalScore = rerankScore
relevanceScore = rerankScore
```

## 分数归一化

所有分数都确保在 0-1 范围内：
- 向量搜索: Qdrant 返回的距离分数转换为相似度 (1 - distance)
- SQL 搜索: calculateRelevanceScore 计算的分数已经是 0-1
- 混合搜索: 通过归一化函数 normalizeScore 确保在 0-1
- Rerank: 余弦相似度计算结果已经在 0-1

## 输出示例

### Legacy 模式输出
```json
{
  "success": true,
  "data": {
    "blocks": [
      {
        "id": "20240101120000-abc123",
        "score": 0.85,
        "relevanceScore": 0.85,
        "rerankScore": null,
        "originalVectorScore": null,
        "originalSqlScore": null,
        "content": "...",
        "title": "文档标题",
        "notebookId": "20240101120000-xxx",
        "path": "/path/to/doc",
        "type": "d",
        "blockId": "20240101120000-abc123",
        "isChunk": false,
        "chunkIndex": null,
        "totalChunks": null,
        "source": "sql"
      }
    ]
  }
}
```

### Semantic 模式输出
```json
{
  "success": true,
  "data": {
    "blocks": [
      {
        "id": "20240101120000-abc123",
        "score": 0.92,
        "relevanceScore": 0.85,
        "rerankScore": 0.92,
        "originalVectorScore": 0.85,
        "originalSqlScore": null,
        "content": "...",
        "title": "文档标题",
        "notebookId": "20240101120000-xxx",
        "path": "/path/to/doc",
        "type": "d",
        "blockId": "20240101120000-abc123",
        "isChunk": false,
        "chunkIndex": null,
        "totalChunks": null,
        "source": "vector"
      }
    ]
  },
  "rerank": {
    "enabled": true,
    "rerankCount": 10,
    "cacheStats": {
      "hits": 5,
      "misses": 5,
      "hitRate": "50.00%"
    }
  }
}
```

## 验证检查清单

- [ ] 所有模式的 score 字段都在 0-1 范围内
- [ ] 所有模式的 relevanceScore 都在 0-1 范围内
- [ ] 分数越高表示相似度/相关性越高
- [ ] 不同模式的分数具有可比性
- [ ] rerankScore 存在时，score = rerankScore
- [ ] rerankScore 不存在时，score = finalScore = relevanceScore
- [ ] 原始分数字段 (originalVectorScore, originalSqlScore) 保留用于调试
- [ ] 向量搜索模式有 denseScore 或 sparseScore
- [ ] 混合搜索模式同时有 denseScore 和 sparseScore
