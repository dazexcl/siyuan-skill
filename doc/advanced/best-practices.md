# 最佳实践

使用思源笔记命令行工具的最佳实践和注意事项。

## 内容操作最佳实践

### 文档创建

**推荐方式：直接创建并填充内容**

```bash
siyuan create "文档标题" "第一段内容\n\n## 二级标题\n第二段内容"
```

**超长内容处理：两步法**

```bash
siyuan create "长文档标题" ""
siyuan update <docId> "$(cat long-content.md)"
```

**注意事项：**
- 单次内容建议不超过 4000 字符
- 使用 `\n` 表示换行，`\n\n` 表示段落分隔
- 标题通过命令参数指定，内容从正文开始

### 文档更新

**推荐：直接更新**

```bash
siyuan update <docId> "新内容"
```

**不推荐：删除后重建**

```bash
siyuan rm <docId>
siyuan create "标题" "内容"
```

> 删除后重建会丢失：文档属性、标签、引用关系、块 ID

### 块级操作

**精确更新单个块：**

```bash
siyuan bu <blockId> "新的块内容"
```

**在指定位置插入块：**

```bash
siyuan bi <parentId> "插入的内容" --position first
```

## 属性设置最佳实践

### 使用命令设置属性（推荐）

```bash
siyuan ba <docId> --set "status=published"
siyuan ba <docId> --set "priority=high" --set "due=2024-12-31"
```

### 使用命令设置标签（推荐）

```bash
siyuan st <docId> --tags "重要,待审核,项目A"
```

> 标签支持中英文逗号分隔

### 不推荐：在内容中添加 Front Matter

思源笔记不使用 Front Matter 管理元数据，应使用专门的属性和标签命令。

## 搜索最佳实践

### 搜索模式选择

| 模式 | 命令 | 适用场景 |
|------|------|----------|
| 关键词 | `siyuan search "关键词"` | 精确匹配 |
| SQL | `siyuan search --sql "SELECT *"` | 复杂查询 |
| 语义 | `siyuan search --semantic "概念描述"` | 概念查找（需向量服务） |
| 混合 | `siyuan search --hybrid "查询"` | 综合搜索（需向量服务） |

### 性能优化

```bash
siyuan search "关键词" --limit 10 --path "/笔记本/目录"
```

- 使用 `--limit` 限制返回数量
- 使用 `--path` 缩小搜索范围
- 使用 `--type` 指定内容类型

### 结果处理

```bash
siyuan search --semantic "查询内容" --threshold 0.7 --sort-by score
```

- `--threshold`：相似度阈值（0-1），过滤低质量结果
- `--sort-by`：按相关度排序

## 权限管理最佳实践

### 权限模式选择

| 环境 | 推荐模式 | 配置 |
|------|----------|------|
| 开发/测试 | `all` | `SIYUAN_PERMISSION_MODE=all` |
| 生产环境 | `whitelist` | `SIYUAN_PERMISSION_MODE=whitelist` |
| 受限访问 | `blacklist` | `SIYUAN_PERMISSION_MODE=blacklist` |

### 白名单配置

```json
{
  "permissionMode": "whitelist",
  "notebookList": ["notebook-id-1", "notebook-id-2"]
}
```

或环境变量：

```bash
SIYUAN_PERMISSION_MODE=whitelist
SIYUAN_NOTEBOOK_LIST=notebook-id-1,notebook-id-2
```

## 删除保护最佳实践

### 保护层级

```
全局安全模式 → 文档保护标记 → 删除确认机制
```

### 配置示例

```json
{
  "deleteProtection": {
    "safeMode": false,
    "requireConfirmation": true,
    "protectedNotebooks": ["重要笔记本ID"],
    "protectedPaths": ["/系统文档", "/配置"]
  }
}
```

### 设置文档保护

```bash
siyuan protect <docId> --enable
siyuan protect <docId> --disable
```

## 向量搜索最佳实践

### 服务部署

**Qdrant（向量数据库）：**

```bash
docker run -d -p 6333:6333 qdrant/qdrant
```

**Ollama（嵌入模型）：**

```bash
ollama pull nomic-embed-text
```

### 配置

```bash
QDRANT_URL=http://localhost:6333
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
```

### 索引管理

- 首次索引在低峰期进行
- 大量文档建议分批索引
- 定期检查索引状态

## 错误处理最佳实践

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `ECONNREFUSED` | 服务未启动 | 检查思源笔记是否运行 |
| `401 Unauthorized` | Token 无效 | 检查 `SIYUAN_TOKEN` |
| `404 Not Found` | 文档不存在 | 检查 ID 或路径 |
| `403 Forbidden` | 权限不足 | 检查权限模式配置 |

### 降级策略

```bash
if ! siyuan search --semantic "查询" --quiet 2>/dev/null; then
  siyuan search "关键词"
fi
```

向量搜索失败时自动降级为关键词搜索。

## 安全最佳实践

### 连接安全

- 仅连接本地实例：`http://localhost:6806`
- 生产环境启用 TLS
- 不禁用证书验证

### Token 管理

- Token 在日志中自动脱敏
- 不在命令行参数中传递 Token
- 定期更换 Token

### 权限最小化

- 使用 `whitelist` 模式限制访问范围
- 仅授权必要的笔记本

## 相关文档

- [命令详细文档](../commands/)
- [环境变量配置](../config/environment.md)
- [高级配置](../config/advanced.md)
- [权限管理](permission.md)
- [向量搜索](vector-search.md)
