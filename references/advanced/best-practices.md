# 最佳实践

使用思源笔记命令行工具的最佳实践和注意事项。

## 内容操作最佳实践

### 文档创建

#### 三种创建模式选择

| 场景 | 推荐模式 | 命令示例 |
|------|---------|----------|
| 简单创建，已知父ID | 模式1 | `siyuan create "标题" --parent-id <id>` |
| 创建多级目录 | 模式2 | `siyuan create --path "笔记本/A/B/C"` |
| 在目录下批量创建 | 模式3 | `siyuan create --path "笔记本/目录/" "标题"` |
| 需要自定义标题 | 模式2 + --title | `siyuan create --path "A/B" --title "自定义"` |

#### 模式1：传统模式

```bash
# 在笔记本根目录创建
siyuan create "我的文档" --parent-id <notebookId>

# 在某个文档下创建子文档
siyuan create "子文档" "内容" --parent-id <docId>
```

#### 模式2：路径指定文档

```bash
# 创建文档，标题从路径最后一段提取
siyuan create --path "AI/项目/需求文档" "这是文档内容"

# 创建多级空目录
siyuan create --path "AI/项目/模块A/模块B/最终目录"

# 使用自定义标题覆盖
siyuan create --path "AI/项目/需求文档" --title "需求文档v2" "内容"
```

#### 模式3：在目录下创建

```bash
# 在指定目录下批量创建文档
siyuan create --path "AI/项目/" "需求文档" "需求内容"
siyuan create --path "AI/项目/" "设计文档" "设计内容"
siyuan create --path "AI/项目/" "测试文档" "测试内容"
```

#### 重名处理

```bash
# 默认检测重名，已存在时返回错误
siyuan create --path "AI/测试" "内容"

# 使用 --force 强制创建（允许重名）
siyuan create --path "AI/测试" "内容" --force
```

#### 超长内容处理

```bash
# 方式1：直接创建（支持长内容）
siyuan create "文档标题" "很长的内容..."

# 方式2：两步法（从文件读取）
siyuan create "长文档标题" --parent-id <id>
siyuan update <docId> "$(cat long-content.md)"
```

#### 注意事项

- 使用 `\n` 表示换行，`\n\n` 表示段落分隔
- 标题通过命令参数指定，内容从正文开始
- 路径中间目录不存在时会自动创建（空内容）
- `--parent-id` 与 `--path` 不能同时使用

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
# 在父块下插入（文档末尾）
siyuan bi "插入的内容" --parent-id <docId>

# 在指定块后插入
siyuan bi "插入的内容" --previous-id <blockId>

# 在指定块前插入
siyuan bi "插入的内容" --next-id <blockId>
```

## 内容书写最佳实践

### 内部链接

在思源笔记中引用其他文档时，应使用思源特有的链接格式。

**推荐写法：**

```
((docId '标题'))
```

**示例：**

```
((20260304051123-doaxgi4 '我的文档'))
```

**特性说明：**

- 在思源笔记中会被渲染成可点击的链接
- 导出时会显示为文档标题
- 支持使用文档 ID 进行精确链接
- 不使用标准 Markdown 链接写法

**为什么推荐使用这种写法：**

1. **更好的兼容性**：思源笔记会自动处理这种链接格式
2. **导出友好**：导出时会自动显示为文档标题，而不是原始链接
3. **可维护性**：使用文档 ID 可以避免文档重命名后链接失效

**不推荐的写法：**

```markdown
# ❌ 不推荐：标准 Markdown 链接
[我的文档](20260304051123-doaxgi4)

# ❌ 不推荐：纯文档 ID
20260304051123-doaxgi4
```

### SQL 嵌入块

思源笔记支持在文档中嵌入 SQL 查询结果，实现动态内容展示。

**创建方式：**

- 输入 `/嵌入块` 或 `/embed`
- 或直接输入 `{{` 然后在窗口中输入 SQL 语句

**基本语法：**

```sql
{{ SELECT * FROM blocks WHERE type = 'd' }}
```

**常用示例：**

```sql
-- 查询最近更新的 5 个标题块
SELECT * FROM blocks WHERE type = 'h' ORDER BY updated DESC LIMIT 5

-- 查询包含特定标签的文档
SELECT * FROM blocks WHERE content LIKE '%#项目A%' AND type = 'd'

-- 查询特定笔记本下的所有文档
SELECT * FROM blocks WHERE box = '笔记本ID' AND type = 'd'
```

**主要数据表：**

| 表名 | 说明 |
|------|------|
| `blocks` | 内容块表（最常用） |
| `attributes` | 属性表 |
| `refs` | 引用关系表 |
| `assets` | 资源引用表 |
| `spans` | 行内元素表 |

**常用块类型 (type 字段)：**

| 类型 | 说明 |
|------|------|
| `d` | 文档块 |
| `h` | 标题块 |
| `p` | 段落块 |
| `l` | 列表块 |
| `c` | 代码块 |
| `t` | 表格块 |
| `query_embed` | 嵌入块 |

**注意事项：**

- SQL 查询仅能渲染 `blocks` 表中的内容
- 支持使用其他表进行辅助查询（如 JOIN）
- 内容更新后嵌入块会自动刷新

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
| Legacy（默认） | `siyuan search "关键词"` | 精确匹配 |
| 关键词 | `siyuan search "关键词" --mode keyword` | N-gram 关键词匹配 |
| 语义 | `siyuan search "概念描述" --mode semantic` | 概念查找（需向量服务） |
| 混合 | `siyuan search "查询" --mode hybrid` | 综合搜索（需向量服务） |

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
siyuan protect <docId>              # 设置保护
siyuan protect <docId> --permanent  # 设置永久保护
siyuan protect <docId> --remove     # 移除保护
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
- [向量搜索](vector-search.md)
