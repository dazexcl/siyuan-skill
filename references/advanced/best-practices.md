# 最佳实践

使用思源笔记命令行工具的最佳实践和注意事项。

## 内容操作最佳实践

### 文档创建

#### 三种创建模式选择

| 场景 | 推荐模式 | 命令示例 |
|------|---------|----------|
| 简单创建，已知父ID | 模式1 | `node scripts/create.js "标题" --parent-id <id>` |
| 创建多级目录 | 模式2 | `node scripts/create.js --path "笔记本/A/B/C"` |
| 在目录下批量创建 | 模式3 | `node scripts/create.js --path "笔记本/目录/" --title "标题"` |

#### 模式1：传统模式

```bash
# 在笔记本根目录创建
node scripts/create.js "我的文档" --parent-id <notebookId>

# 在某个文档下创建子文档
node scripts/create.js "子文档" --content "内容" --parent-id <docId>
```

#### 模式2：路径指定文档

```bash
# 创建文档，标题从路径最后一段提取
node scripts/create.js --path "AI/项目/需求文档" --content "这是文档内容"

# 创建多级空目录
node scripts/create.js --path "AI/项目/模块A/模块B/最终目录"

# 使用自定义标题覆盖
node scripts/create.js --path "AI/项目/需求文档" --title "需求文档v2" --content "内容"
```

#### 模式3：在目录下创建

```bash
# 在指定目录下批量创建文档
node scripts/create.js --path "AI/项目/" --title "需求文档" --content "需求内容"
node scripts/create.js --path "AI/项目/" --title "设计文档" --content "设计内容"
node scripts/create.js --path "AI/项目/" --title "测试文档" --content "测试内容"
```

#### 重名处理

```bash
# 默认检测重名，已存在时返回错误
node scripts/create.js --path "AI/测试" --content "内容"

# 使用 --force 强制创建（允许重名）
node scripts/create.js --path "AI/测试" --content "内容" --force
```

#### 超长内容处理

```bash
# 方式1：使用 --file 参数（推荐，最可靠）
node scripts/create.js "文档标题" --file long-content.md --parent-id <id>
node scripts/update.js <docId> --file long-content.md

# 方式2：Shell 命令替换（无需临时文件）
# macOS/Linux (bash/zsh)
node scripts/create.js "文档标题" --content "$(cat long-content.md)" --parent-id <id>
# Windows PowerShell
node scripts/create.js "文档标题" --content (Get-Content long-content.md -Raw -Encoding UTF8) --parent-id <id>
```

### 文档更新

**推荐：直接更新**

```bash
node scripts/update.js <docId> --content "新内容"
```

**不推荐：删除后重建**

```bash
node scripts/delete.js <docId>
node scripts/create.js "标题" --content "内容"
```

> 删除后重建会丢失：文档属性、标签、引用关系、块 ID

### 块级操作

**精确更新单个块：**

```bash
node scripts/block-update.js <blockId> --content "新的块内容"
```

**在指定位置插入块：**

```bash
# 在父块下插入（文档末尾）
node scripts/block-insert.js "插入的内容" --parent-id <docId>

# 在指定块后插入
node scripts/block-insert.js "插入的内容" --previous-id <blockId>

# 在指定块前插入
node scripts/block-insert.js "插入的内容" --next-id <blockId>
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

### SQL 嵌入块

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
```

## 属性设置最佳实践

### 使用命令设置属性（推荐）

```bash
node scripts/block-attrs.js <docId> --set "status=published"
node scripts/block-attrs.js <docId> --set "priority=high" --set "due=2024-12-31"
```

### 使用命令设置标签（推荐）

```bash
node scripts/tags.js <docId> --add "重要,待审核,项目A"
```

## 搜索最佳实践

### 搜索模式选择

| 模式 | 命令 | 适用场景 |
|------|------|----------|
| Legacy（默认） | `node scripts/search.js "关键词"` | 精确匹配 |
| 关键词 | `node scripts/search.js "关键词" --mode keyword` | N-gram 关键词匹配 |
| 语义 | `node scripts/search.js "概念描述" --mode semantic` | 概念查找（需向量服务） |
| 混合 | `node scripts/search.js "查询" --mode hybrid` | 综合搜索（需向量服务） |

### 性能优化

```bash
node scripts/search.js "关键词" --limit 10 --path "/笔记本/目录"
```

## 权限管理最佳实践

### 权限模式选择

| 环境 | 推荐模式 | 配置 |
|------|----------|------|
| 开发/测试 | `all` | `SIYUAN_PERMISSION_MODE=all` |
| 生产环境 | `whitelist` | `SIYUAN_PERMISSION_MODE=whitelist` |

### 白名单配置

```json
{
  "permissionMode": "whitelist",
  "notebookList": ["notebook-id-1", "notebook-id-2"]
}
```

## 删除保护最佳实践

### 保护层级

```
全局安全模式 → 文档保护标记 → 删除确认机制
```

### 设置文档保护

```bash
node scripts/protect.js <docId>              # 设置保护
node scripts/protect.js <docId> --permanent  # 设置永久保护
node scripts/protect.js <docId> --remove     # 移除保护
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
```

## 错误处理最佳实践

### 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| `ECONNREFUSED` | 服务未启动 | 检查思源笔记是否运行 |
| `401 Unauthorized` | Token 无效 | 检查 `SIYUAN_TOKEN` |
| `404 Not Found` | 文档不存在 | 检查 ID 或路径 |
| `403 Forbidden` | 权限不足 | 检查权限模式配置 |

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
