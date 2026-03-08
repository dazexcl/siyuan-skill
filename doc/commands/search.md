# 搜索内容命令

搜索思源笔记内容，支持向量搜索、语义搜索、关键词搜索和SQL搜索。

## 命令格式

```bash
siyuan search <query> [options]
```

**别名**：`find`

## 参数说明

| 参数 | 类型 | 说明 | 示例 |
|-----|------|------|------|
| `--mode <mode>` | string | 搜索模式：hybrid（混合）、semantic（语义）、keyword（关键词）、legacy（SQL） | `--mode hybrid` |
| `--type <type>` | string | 按单个类型过滤 | `--type d` |
| `--types <types>` | string | 按多个类型过滤（逗号分隔） | `--types d,p,h` |
| `--sort-by <sortBy>` | string | 排序方式（relevance/date） | `--sort-by date` |
| `--limit <limit>` | number | 结果数量限制 | `--limit 5` |
| `--path <path>` | string | 搜索路径（仅搜索指定路径下的内容） | `--path /AI/openclaw` |
| `--sql <sql>` | string | 自定义SQL查询条件 | `--sql "length(content) > 100 AND updated > '20260101000000'"` |
| `--dense-weight <weight>` | number | 语义搜索权重（混合搜索时，默认 0.7） | `--dense-weight 0.8` |
| `--sparse-weight <weight>` | number | 关键词搜索权重（混合搜索时，默认 0.3） | `--sparse-weight 0.2` |
| `--threshold <score>` | number | 相似度阈值（0-1） | `--threshold 0.5` |

## 搜索模式说明

- `hybrid` - 混合搜索（默认）：结合语义搜索和关键词搜索，提供最佳检索效果
- `semantic` - 语义搜索：基于向量相似度，能找到语义相关的内容（使用 nomic-embed-text 模型）
- `keyword` - 关键词搜索：基于 BM25 算法，精确匹配关键词
- `legacy` - SQL 搜索：使用原有的 SQL LIKE 查询

## 支持的类型
- `d` - 文档
- `p` - 段落
- `h` - 标题
- `l` - 列表
- `i` - 列表项
- `tb` - 表格
- `c` - 代码块
- `s` - 分隔线
- `img` - 图片

## 使用示例

### 基本搜索
```bash
siyuan search "关键词"
siyuan search "关键词" --type d
siyuan search "关键词" --types p,h
```

### 混合搜索（推荐）
```bash
siyuan search "机器学习技术" --mode hybrid
siyuan search "机器学习" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2
```

### 语义搜索
```bash
siyuan search "人工智能应用" --mode semantic
siyuan search "AI" --mode semantic --threshold 0.5
```

### 关键词搜索
```bash
siyuan search "深度学习" --mode keyword
```

### SQL搜索
```bash
siyuan search "关键词" --mode legacy
```

### 路径搜索
```bash
siyuan search "关键词" --path /AI/openclaw
siyuan search "关键词" --path /AI/openclaw --type d
```

### 高级查询
```bash
siyuan search "关键词" --sql "length(content) > 100 AND updated > '20260101000000'"
siyuan search "关键词" --path /AI/openclaw --sql "type = 'd'"
siyuan search "关键词" --min-length 20 --max-length 500
siyuan search "关键词" --sort-by date --limit 5
```

## 最佳实践
1. **默认使用混合搜索**：适用于大多数场景，提供最佳检索效果
2. **语义搜索用于概念查找**：当需要找到概念相关的内容时使用
3. **关键词搜索用于精确查找**：当需要精确匹配关键词时使用
4. **合理设置limit**：避免返回过多结果，影响性能
5. **使用路径限制搜索范围**：提高搜索效率和准确性

## 相关文档
- [向量搜索配置](../advanced/vector-search.md)
- [最佳实践](../advanced/best-practices.md)
