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
| `--mode <mode>` | string | 搜索模式：hybrid（混合）、semantic（语义）、keyword（关键词）、legacy（SQL，默认） | `--mode hybrid` |
| `--type <type>` | string | 按单个类型过滤 | `--type d` |
| `--types <types>` | string | 按多个类型过滤（逗号分隔） | `--types d,p,h` |
| `--sort-by <sortBy>` | string | 排序方式（relevance/date） | `--sort-by date` |
| `--limit <limit>` | number | 结果数量限制 | `--limit 5` |
| `--path <path>` | string | 搜索路径（仅搜索指定路径下的内容） | `--path /AI/openclaw` |
| `--notebook <notebookId>` | string | 指定笔记本ID | `--notebook 20260227231831-yq1lxq2` |
| `--sql <sql>` | string | 自定义SQL查询条件 | `--sql "length(content) > 100 AND updated > '20260101000000'"` |
| `--sql-weight <weight>` | number | SQL搜索权重（混合搜索时，默认 0） | `--sql-weight 0.3` |
| `--dense-weight <weight>` | number | 语义搜索权重（混合搜索时，默认 0.7） | `--dense-weight 0.8` |
| `--sparse-weight <weight>` | number | 关键词搜索权重（混合搜索时，默认 0.3） | `--sparse-weight 0.2` |
| `--threshold <score>` | number | 相似度阈值（0-1） | `--threshold 0.5` |

## 搜索模式说明

- `legacy` - SQL 搜索（默认）：使用 SQL LIKE 查询，精确匹配关键词
- `hybrid` - 混合搜索：结合语义搜索和关键词搜索
- `semantic` - 语义搜索：基于向量相似度，能找到语义相关的内容（使用 nomic-embed-text 模型）
- `keyword` - 关键词搜索：基于 BM25 算法，精确匹配关键词

### 模式对比

| 模式 | 匹配方式 | 适用场景 | 精确度 |
|------|----------|----------|--------|
| legacy | SQL LIKE 精确匹配 | 精确关键词搜索 | ★★★★★ |
| keyword | 稀疏向量（BM25） | 关键词匹配，支持 N-gram | ★★★★☆ |
| semantic | 稠密向量（语义） | 同义词、概念关联 | ★★★☆☆ |
| hybrid | 稠密 + 稀疏 | 综合搜索 | ★★★★☆ |

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

### 基本搜索（默认 Legacy 模式）
```bash
siyuan search "关键词"
siyuan search "长颈鹿"
siyuan search "关键词" --type d
siyuan search "关键词" --types p,h
```

### 混合搜索
```bash
siyuan search "机器学习技术" --mode hybrid
siyuan search "机器学习" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2

# 如需在混合搜索中包含 SQL 精确匹配，手动指定 sql-weight
siyuan search "长颈鹿" --mode hybrid --sql-weight 0.3
```

### 语义搜索
```bash
siyuan search "人工智能应用" --mode semantic
siyuan search "AI" --mode semantic --threshold 0.5
```

### 关键词搜索
```bash
siyuan search "深度学习" --mode keyword
siyuan search "Kubernetes" --mode keyword
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

1. **默认使用 Legacy 模式**：精确匹配关键词，结果最可靠
2. **关键词搜索用于技术术语**：`keyword` 模式支持 N-gram，对未登录词效果好
3. **语义搜索用于概念查找**：当需要找到同义词、概念相关的内容时使用 `semantic` 模式
4. **混合搜索用于综合需求**：需要同时匹配语义和关键词时使用 `hybrid` 模式
5. **合理设置 limit**：避免返回过多结果，影响性能
6. **使用路径限制搜索范围**：提高搜索效率和准确性

## 安全特性

### SQL 注入防护
搜索功能已实现完整的 SQL 注入防护：

- **查询转义**：所有搜索查询都经过 `escapeSql` 方法转义
- **ID 验证**：笔记本 ID 和父文档 ID 必须符合思源笔记格式（14-32位字母数字）
- **类型白名单**：类型参数只接受预定义的合法值
- **自定义 SQL 过滤**：自定义 SQL 条件会过滤注释和危险字符

### 参数验证
| 参数 | 验证规则 |
|------|----------|
| `query` | 最大 1000 字符，自动截断 |
| `mode` | 只接受 legacy/semantic/keyword/hybrid |
| `limit` | 1-100 范围，默认 20 |
| `weights` | 0-1 范围，自动归一化 |
| `notebookId` | 14-32 位字母数字 |

### 性能优化
- **并发控制**：批量请求最多 5 个并发
- **分批处理**：每批最多 10 个结果
- **结果去重**：自动合并重复结果

## 相关文档
- [向量搜索配置](../advanced/vector-search.md)
- [最佳实践](../advanced/best-practices.md)
