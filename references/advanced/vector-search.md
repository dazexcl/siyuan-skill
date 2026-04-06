# 向量搜索配置

配置和使用思源笔记的向量搜索功能。

## 概述

向量搜索功能基于 Qdrant 向量数据库和 Ollama Embedding 服务，提供语义搜索和关键词搜索能力。

## 前置要求

### 1. Qdrant 服务

**Docker 部署**：
```bash
docker run -p 6333:6333 qdrant/qdrant
```

### 2. Ollama 服务

```bash
# 下载模型（推荐 nomic-embed-text）
ollama pull nomic-embed-text
```

## 配置

向量搜索需要在 `config.json` 中配置以下部分：

```json
{
  "qdrant": {
    "url": "http://localhost:6333",
    "apiKey": "",
    "collectionName": "siyuan_notes"
  },
  "embedding": {
    "baseUrl": "http://localhost:11434",
    "model": "nomic-embed-text",
    "dimension": 768
  }
}
```

> 📋 完整配置说明参见：[配置文档](../config/advanced.md)

## 搜索模式

### Legacy 模式（默认）

```bash
node scripts/search.js "关键词"
```

### Keyword 模式（稀疏向量）

```bash
node scripts/search.js "Kubernetes" --mode keyword
```

### Semantic 模式（稠密向量）

```bash
node scripts/search.js "人工智能" --mode semantic
node scripts/search.js "AI" --mode semantic --threshold 0.5
```

### Hybrid 模式（混合搜索）

```bash
node scripts/search.js "机器学习" --mode hybrid
node scripts/search.js "AI" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2
```

## 使用方式

### 1. 索引文档

```bash
# 增量索引所有笔记本
node scripts/index.js

# 索引指定笔记本
node scripts/index.js --notebook <notebook-id>

# 强制重建索引
node scripts/index.js --notebook <notebook-id> --force
```

### 2. 搜索文档

```bash
# 默认 Legacy 模式
node scripts/search.js "关键词"

# 关键词搜索
node scripts/search.js "长颈鹿" --mode keyword

# 语义搜索
node scripts/search.js "机器学习技术" --mode semantic

# 混合搜索
node scripts/search.js "人工智能应用" --mode hybrid
```

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| Qdrant 连接失败 | 检查 Qdrant 服务是否运行 |
| Ollama 连接失败 | 检查 Ollama 服务地址是否正确 |
| 向量维度不匹配 | 检查模型配置的维度是否正确 |

## 注意事项

1. **默认使用 Legacy 模式**：无需配置向量服务，精确匹配
2. **服务依赖**：keyword/semantic/hybrid 模式需要 Qdrant 和 Ollama 服务
3. **索引时间**：首次索引可能需要较长时间
4. **模型选择**：推荐使用 nomic-embed-text 模型（768 维）
