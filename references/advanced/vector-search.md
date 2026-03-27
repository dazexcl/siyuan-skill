# 向量搜索配置

配置和使用思源笔记的向量搜索功能。

## 概述

向量搜索功能基于 Qdrant 向量数据库和 Ollama Embedding 服务，提供语义搜索和关键词搜索能力。

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

# 下载模型（推荐 nomic-embed-text）
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
    "baseUrl": "http://127.0.0.1:11434",
    "model": "nomic-embed-text",
    "dimension": 768,
    "maxContentLength": 4000,
    "maxChunkLength": 4000,
    "minChunkLength": 200,
    "batchSize": 5,
    "skipIndexAttrs": ["custom-skip-index", "custom-draft"]
  },
  "hybridSearch": {
    "denseWeight": 0.7,
    "sparseWeight": 0.3,
    "limit": 20
  }
}
```

### 配置参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `embedding.baseUrl` | `http://127.0.0.1:11434` | Ollama 服务地址 |
| `embedding.model` | `nomic-embed-text` | Embedding 模型名称 |
| `embedding.dimension` | `768` | 向量维度（需与模型匹配） |
| `embedding.maxContentLength` | `4000` | 触发分块的内容长度阈值 |
| `embedding.maxChunkLength` | `4000` | 单个分块最大长度 |
| `embedding.minChunkLength` | `200` | 单个分块最小长度 |
| `embedding.batchSize` | `5` | 批处理大小 |
| `embedding.skipIndexAttrs` | `[]` | 跳过索引的属性名列表 |
| `hybridSearch.denseWeight` | `0.7` | 稠密向量权重 |
| `hybridSearch.sparseWeight` | `0.3` | 稀疏向量权重 |
| `hybridSearch.limit` | `20` | 搜索结果数量限制 |

## 搜索模式

### Legacy 模式（默认）
- 使用 SQL LIKE 查询
- 精确匹配关键词
- 无需配置向量服务

```bash
siyuan search "关键词"
siyuan search "长颈鹿"
```

### Keyword 模式（稀疏向量）
- 基于 BM25 算法
- 支持中文分词 + N-gram
- 对未登录词效果好

```bash
siyuan search "Kubernetes" --mode keyword
siyuan search "长颈鹿" --mode keyword
```

### Semantic 模式（稠密向量）
- 基于向量相似度
- 能找到语义相关的内容
- 适合同义词、概念关联搜索

```bash
siyuan search "人工智能" --mode semantic
siyuan search "AI" --mode semantic --threshold 0.5
```

### Hybrid 模式（混合搜索）
- 结合稠密向量 + 稀疏向量
- 默认权重：denseWeight=0.7, sparseWeight=0.3, sqlWeight=0
- 可通过参数调整权重

```bash
siyuan search "机器学习" --mode hybrid
siyuan search "AI" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2

# 如需包含 SQL 精确匹配
siyuan search "长颈鹿" --mode hybrid --sql-weight 0.3
```

## 使用方式

### 1. 索引文档

首先需要将文档索引到向量数据库：

```bash
# 增量索引所有笔记本（只索引有变化的文档，自动清理孤立索引）
siyuan index

# 索引指定笔记本
siyuan index --notebook <notebook-id>

# 索引指定文档
siyuan index <doc-id>

# 强制重建索引（按范围删除对应记录）
siyuan index <doc-id> --force
siyuan index --notebook <notebook-id> --force
siyuan index --force  # 清空整个集合

# 移除索引（不重新索引）
siyuan index <doc-id> --remove
siyuan index --notebook <notebook-id> --remove
```

### 2. 搜索文档

使用向量搜索：

```bash
# 默认 Legacy 模式
siyuan search "关键词"

# 关键词搜索
siyuan search "长颈鹿" --mode keyword

# 语义搜索
siyuan search "机器学习技术" --mode semantic

# 混合搜索
siyuan search "人工智能应用" --mode hybrid
```

## 中文分词支持

系统使用双向最大匹配分词算法，并结合 N-gram 处理未登录词：

### 分词策略
1. **词典分词**：使用内置词典（837+ 词）进行分词
2. **N-gram 补充**：对未登录词自动生成 2-gram 和 3-gram

### 示例
```
输入: "长颈鹿"
分词: ["长颈", "颈鹿", "长颈鹿"]（N-gram）
     + 词典中的词（如果有）

输入: "人工智能技术"
分词: ["人工智能", "技术"]（词典）
     + ["人工", "工智", "智能", "能技", "技术"]（N-gram）
```

## 自动分块处理

当文档内容超过 `maxContentLength`（默认 4000 字符）时，系统会自动使用思源笔记 API 的块列表功能将文档分块索引。

### 分块策略
- 基于文档的块结构（标题、段落、列表等）进行分块
- 每个块最大长度由 `maxChunkLength` 配置（默认 4000 字符）
- 最小块长度由 `minChunkLength` 配置（默认 200 字符）
- 保留原始文档 ID，搜索时可以追溯到原始文档

### 空内容过滤
- 自动跳过内容为空的文档
- 避免创建无意义的向量记录

### 跳过索引属性过滤
通过配置 `skipIndexAttrs` 可以指定哪些文档应该跳过索引：

```json
{
  "embedding": {
    "skipIndexAttrs": ["custom-skip-index", "custom-draft"]
  }
}
```

- 包含这些属性（且值不为空或 `false`）的文档将被跳过
- 增量索引时会自动清理已跳过文档的旧索引
- 也可通过环境变量配置：`SIYUAN_SKIP_INDEX_ATTRS=custom-skip-index,custom-draft`

### 递归处理
支持递归处理子文档，确保所有内容都被正确索引。

## 向量存储结构

每条向量记录包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `block_id` | string | 块 ID（分块格式：`{docId}_chunk_{index}`） |
| `notebook_id` | string | 笔记本 ID |
| `title` | string | 文档标题 |
| `path` | string | 文档路径（hPath 格式，不含笔记本名） |
| `content_preview` | string | 内容预览（最大 500 字符） |
| `tags` | array | 文档标签列表 |
| `updated` | number | 更新时间戳 |
| `is_chunk` | boolean | 是否为分块记录 |
| `chunk_index` | number | 分块索引 |
| `total_chunks` | number | 总分块数 |
| `original_doc_id` | string | 原始文档 ID（仅分块记录） |

### 向量类型
- **Dense（稠密向量）**：768 维，由 embedding 模型生成，捕获语义相似性
- **Sparse（稀疏向量）**：关键词索引，用于精确匹配

## 相关度分数

使用余弦相似度，分数范围：

| 分数范围 | 相关性 | 说明 |
|----------|--------|------|
| 0.9 - 1.0 | 极高 | 几乎相同的语义内容 |
| 0.7 - 0.9 | 高度相关 | 语义非常接近 |
| 0.5 - 0.7 | 中等相关 | 语义有交集，可用结果 |
| 0.3 - 0.5 | 弱相关 | 语义有一定联系，参考价值低 |
| < 0.3 | 不相关 | 基本无语义关联 |

可通过 `--threshold` 参数过滤低相关度结果：
```bash
siyuan search "关键词" --mode semantic --threshold 0.5
```

## 性能优化

### 1. 批处理大小
调整批处理大小以提高索引速度：

```json
{
  "embedding": {
    "batchSize": 10
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
根据使用场景通过命令行参数调整权重：

```bash
# 偏向语义搜索
siyuan search "AI" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2

# 偏向关键词匹配
siyuan search "Kubernetes" --mode hybrid --dense-weight 0.3 --sparse-weight 0.7
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

### 关键词搜索找不到结果
```
问题: 词典中没有该词
解决: 系统会自动使用 N-gram 处理，确保重建索引
命令: siyuan index --force
```

### Ollama GPU 降级问题
```
问题: 大文本块导致 GPU 内存溢出，降级为 CPU
解决: 减小 maxChunkLength 和 batchSize 配置值
```

## 注意事项

1. **默认使用 Legacy 模式**：无需配置向量服务，精确匹配
2. **服务依赖**：keyword/semantic/hybrid 模式需要 Qdrant 和 Ollama 服务
3. **索引时间**：首次索引可能需要较长时间，取决于文档数量
4. **存储优化**：只存储内容预览（500 字符），全文通过 block_id 实时获取
5. **模型选择**：推荐使用 nomic-embed-text 模型（768 维）
6. **GPU 建议**：Ollama 建议使用 GPU 加速，大文本需注意内存配置

## 相关文档
- [索引命令](../commands/index.md)
- [搜索命令](../commands/search.md)
- [最佳实践](best-practices.md)
