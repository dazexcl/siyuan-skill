# 向量搜索配置

配置和使用思源笔记的向量搜索功能。

## 概述

向量搜索功能基于 Qdrant 向量数据库和 Ollama Embedding 服务，提供语义搜索能力。

## 前置要求

### 1. Qdrant 服务
需要部署 Qdrant 向量数据库服务。

**Docker 部署**：
```bash
docker run -p 6333:6333 qdrant/qdrant
```

**配置地址**：
- 默认地址：`http://127.0.0.1:6333`
- 可通过环境变量 `QDRANT_URL` 配置

### 2. Ollama 服务
需要部署 Ollama 服务用于生成向量嵌入。

**安装 Ollama**：
```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# 下载模型
ollama pull nomic-embed-text
```

**配置地址**：
- 默认地址：`http://127.0.0.1:11434`
- 可通过环境变量 `OLLAMA_BASE_URL` 配置

## 配置方式

### 环境变量配置

```bash
# Qdrant 配置
export QDRANT_URL="http://127.0.0.1:6333"
export QDRANT_API_KEY=""
export QDRANT_COLLECTION_NAME="siyuan_notes"

# Ollama 配置
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export OLLAMA_EMBED_MODEL="nomic-embed-text"

# 混合搜索权重
export HYBRID_DENSE_WEIGHT=0.7
export HYBRID_SPARSE_WEIGHT=0.3
```

### 配置文件配置

在 `config.json` 中添加：

```json
{
  "qdrant": {
    "url": "http://127.0.0.1:6333",
    "apiKey": "",
    "collectionName": "siyuan_notes"
  },
  "embedding": {
    "model": "nomic-embed-text",
    "dimension": 768,
    "batchSize": 8,
    "baseUrl": "http://127.0.0.1:11434"
  },
  "hybridSearch": {
    "denseWeight": 0.7,
    "sparseWeight": 0.3,
    "limit": 20
  }
}
```

## 使用方式

### 1. 索引文档

首先需要将文档索引到向量数据库：

```bash
# 索引所有笔记本的文档
siyuan index

# 索引指定笔记本
siyuan index --notebook <notebook-id>

# 强制重建索引
siyuan index --force
```

### 2. 搜索文档

使用向量搜索：

```bash
# 语义搜索
siyuan search "机器学习技术" --mode semantic

# 混合搜索（推荐）
siyuan search "人工智能应用" --mode hybrid

# 调整权重
siyuan search "AI" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2
```

## 自动分块处理

当文档内容超过 4000 字符时，系统会自动使用思源笔记 API 的块列表功能将文档分块索引。

### 分块策略
- 基于文档的块结构（标题、段落、列表等）进行分块
- 每个块最大 3000 字符
- 保留原始文档 ID，搜索时可以追溯到原始文档

### 递归处理
支持递归处理子文档，确保所有内容都被正确索引。

## 性能优化

### 1. 批处理大小
调整批处理大小以提高索引速度：

```json
{
  "embedding": {
    "batchSize": 16
  }
}
```

### 2. 向量维度
根据模型调整向量维度：

```json
{
  "embedding": {
    "dimension": 768
  }
}
```

### 3. 混合搜索权重
根据使用场景调整权重：

```json
{
  "hybridSearch": {
    "denseWeight": 0.7,
    "sparseWeight": 0.3
  }
}
```

## 故障排除

### Qdrant 连接失败
```
错误: Qdrant API 错误: 409 Conflict
解决: 集合已存在，系统会继续使用现有集合
```

### Ollama 连接失败
```
错误: 无法连接到 Ollama 服务
解决: 检查 Ollama 服务是否运行，地址是否正确
```

### 向量维度不匹配
```
错误: 向量维度不匹配
解决: 检查模型配置的维度是否正确
```

## 注意事项

1. **服务依赖**：向量搜索功能需要 Qdrant 和 Ollama 服务
2. **自动回退**：如果服务不可用，系统会自动回退到 SQL 搜索
3. **索引时间**：首次索引可能需要较长时间，取决于文档数量
4. **存储空间**：向量数据库需要足够的存储空间
5. **模型选择**：推荐使用 nomic-embed-text 模型

## 相关文档
- [搜索命令](../commands/search.md)
- [索引命令](../commands/index.md)
- [最佳实践](best-practices.md)
