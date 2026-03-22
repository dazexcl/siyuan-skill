# 索引文档到向量数据库命令

将思源笔记文档索引到向量数据库，支持增量索引和自动分块处理。

## 命令格式

```bash
siyuan index [<id>] [options]
```

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<id>` | string | ❌ | 位置参数：笔记本ID或文档ID（自动识别） |
| `--notebook <id>` | string | ❌ | 指定笔记本 ID |
| `--doc-ids <ids>` | string | ❌ | 指定文档 ID 列表（逗号分隔） |
| `--force` | boolean | ❌ | 强制重建索引（按范围删除对应记录） |
| `--no-incremental` | boolean | ❌ | 禁用增量索引，重新索引所有文档 |
| `--batch-size <size>` | number | ❌ | 批处理大小（默认：5） |

## 使用示例

### 位置参数（自动识别）

```bash
# 传入笔记本ID → 索引整个笔记本
siyuan index 20260308012748-i6sgf0p

# 传入文档ID → 只索引该文档
siyuan index 20260311033146-8o2vury
```

### 增量索引（默认）
```bash
# 增量索引所有笔记本（只索引有变化的文档）
siyuan index

# 增量索引指定笔记本
siyuan index --notebook 20260227231831-yq1lxq2
```

### 强制重建索引
```bash
# 强制重建指定文档索引（只删除该文档的向量记录）
siyuan index 20260311033146-8o2vury --force

# 强制重建指定笔记本索引（只删除该笔记本的向量记录）
siyuan index --notebook 20260227231831-yq1lxq2 --force

# 强制重建所有索引（清空整个集合）
siyuan index --force
```

### 禁用增量索引
```bash
# 重新索引所有文档（不清空现有数据）
siyuan index --no-incremental
```

### 索引指定文档
```bash
# 索引指定文档
siyuan index --doc-ids "doc-id-1,doc-id-2"

# 强制重建指定文档索引
siyuan index --doc-ids "doc-id-1,doc-id-2" --force
```

## 向量索引特性

### 增量索引（默认启用）
- 自动检测文档更新时间，只索引有变化的文档
- 大幅减少索引时间和资源消耗
- 分块文档与原始文档关联，统一判断是否需要更新

### 强制重建策略
`--force` 参数的删除范围：

| 场景 | 删除范围 |
|------|---------|
| 指定文档（`--doc-ids` 或位置参数文档ID） | 仅删除该文档及其分块 |
| 指定笔记本（`--notebook` 或位置参数笔记本ID） | 仅删除该笔记本的所有向量记录 |
| 无参数（全量） | 清空整个集合 |

### 自动分块处理
当文档内容超过配置的 `maxContentLength`（默认 8000 字符）时，系统会自动使用思源笔记 API 的块列表功能将文档分块索引。

### 智能分块策略
- 基于文档的块结构（标题、段落、列表等）进行分块
- 每个块最大长度由 `maxChunkLength` 配置（默认 8000 字符）
- 最小块长度由 `minChunkLength` 配置（默认 200 字符）
- 避免超出 embedding 模型的上下文限制

### 空内容过滤
- 自动跳过内容为空的文档
- 避免创建无意义的向量记录

### 保留原始信息
分块索引时会保留原始文档 ID，搜索时可以追溯到原始文档。

### 递归处理
支持递归处理子文档，确保所有内容都被正确索引。

## 存储结构

每条向量记录包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `block_id` | string | 块 ID（分块文档格式：`{docId}_chunk_{index}`） |
| `notebook_id` | string | 笔记本 ID |
| `title` | string | 文档标题 |
| `path` | string | 文档路径 |
| `content_preview` | string | 内容预览（最大 500 字符） |
| `tags` | array | 文档标签列表 |
| `updated` | number | 更新时间戳 |
| `is_chunk` | boolean | 是否为分块记录 |
| `chunk_index` | number | 分块索引（仅分块记录） |
| `total_chunks` | number | 总分块数（仅分块记录） |
| `original_doc_id` | string | 原始文档 ID（仅分块记录） |

## 配置参数

在 `config.json` 中配置：

```json
{
  "embedding": {
    "baseUrl": "http://127.0.0.1:11434",
    "model": "nomic-embed-text",
    "dimension": 768,
    "maxContentLength": 4000,
    "maxChunkLength": 4000,
    "minChunkLength": 200,
    "batchSize": 5
  },
  "qdrant": {
    "url": "http://127.0.0.1:6333",
    "collectionName": "siyuan_notes"
  }
}
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `embedding.baseUrl` | `http://127.0.0.1:11434` | Ollama 服务地址 |
| `embedding.model` | `nomic-embed-text` | Embedding 模型 |
| `embedding.dimension` | `768` | 向量维度 |
| `embedding.maxContentLength` | `4000` | 触发分块的内容长度阈值 |
| `embedding.maxChunkLength` | `4000` | 单个分块最大长度 |
| `embedding.minChunkLength` | `200` | 单个分块最小长度 |
| `embedding.batchSize` | `5` | 批处理大小 |

## 返回格式

```json
{
  "success": true,
  "indexed": 15,
  "skipped": 10,
  "total": 25,
  "errors": [],
  "message": "成功索引 15 个文档，跳过 10 个未变化的文档"
}
```

## 注意事项

1. **向量搜索配置**：需要配置 Qdrant 和 Embedding 服务
2. **增量索引**：默认启用增量索引，只索引有变化的文档
3. **强制重建**：`--force` 按范围删除，不会误删其他索引
4. **自动分块**：超长文档会自动分块，无需手动处理
5. **内容预览**：只存储 500 字符预览，全文可通过 `block_id` 从思源获取
6. **权限限制**：需要相应的权限才能索引文档

## 相关文档
- [向量搜索配置](../advanced/vector-search.md)
- [搜索内容命令](search.md)
- [最佳实践](../advanced/best-practices.md)
