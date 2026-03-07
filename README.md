# Siyuan Skill

Siyuan Notes 命令行工具，提供便捷的命令行操作方式，支持笔记本管理、文档操作、内容搜索等功能。

## 快速开始

### 安装

```bash
# 进入技能目录
cd skills/siyuan-skill

# 复制配置示例
cp config.example.json config.json

# 编辑配置文件
# 修改 config.json 中的必要配置项
```

### 配置

创建或编辑 `config.json` 文件：

```json
{
  "baseURL": "http://127.0.0.1:6806",
  "token": "your-api-token-here",
  "timeout": 10000,
  "defaultNotebook": "your-notebook-id-here",
  "defaultFormat": "markdown",
  "permissionMode": "all",
  "notebookList": [],
  "enableCache": true,
  "enableSync": false,
  "enableLogging": true,
  "debugMode": false,
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
  },
  "nlp": {
    "language": "zh",
    "extractEntities": true,
    "extractKeywords": true
  }
}
```

### 获取 API Token

1. 打开思源笔记
2. 进入 **设置 → 关于**
3. 复制 **API Token**
4. 粘贴到 `token` 字段

### 获取笔记本 ID

```bash
# 使用命令获取笔记本列表
node siyuan.js notebooks

# 输出示例：
# {
#   "success": true,
#   "data": [
#     {
#       "id": "20260227231831-yq1lxq2",
#       "name": "我的笔记本"
#     }
#   ]
# }
```

## 配置说明

### 1. 基础连接配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `baseURL` | string | ✅ | `http://127.0.0.1:6806` | 思源笔记 API 地址 |
| `token` | string | ✅ | `""` | API 认证令牌 |
| `timeout` | number | ❌ | `10000` | 请求超时时间（毫秒） |

**获取方式：**
1. 打开思源笔记 → 设置 → 关于 → 复制 API Token
2. 使用 `node siyuan.js notebooks` 获取笔记本 ID

### 2. 默认值配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `defaultNotebook` | string | ❌ | `null` | 默认笔记本 ID |
| `defaultFormat` | string | ❌ | `markdown` | 默认输出格式（markdown/text/html） |

### 3. 权限配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `permissionMode` | string | ❌ | `all` | 权限模式：`all`（无限制）/`whitelist`（白名单）/`blacklist`（黑名单） |
| `notebookList` | array | ❌ | `[]` | 笔记本 ID 列表（配合 whitelist/blacklist 使用） |

**权限模式说明：**
- `all` - 无限制访问所有笔记本
- `whitelist` - 只允许访问 `notebookList` 中的笔记本
- `blacklist` - 禁止访问 `notebookList` 中的笔记本

### 4. 功能配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `enableCache` | boolean | ❌ | `true` | 是否启用缓存 |
| `enableSync` | boolean | ❌ | `false` | 是否启用同步 |
| `enableLogging` | boolean | ❌ | `true` | 是否启用日志 |
| `debugMode` | boolean | ❌ | `false` | 是否启用调试模式 |

### 5. Qdrant 向量数据库配置（可选）

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `qdrant.url` | string | ❌ | `null` | Qdrant 服务地址 |
| `qdrant.apiKey` | string | ❌ | `""` | Qdrant API 密钥 |
| `qdrant.collectionName` | string | ❌ | `siyuan_notes` | 集合名称 |

**说明：** 向量搜索功能需要单独部署 Qdrant 服务。如果 Qdrant 不可用，系统会自动回退到 SQL 搜索。

### 6. Embedding 模型配置（可选）

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `embedding.model` | string | ❌ | `nomic-embed-text` | Embedding 模型名称 |
| `embedding.dimension` | number | ❌ | `768` | 向量维度 |
| `embedding.batchSize` | number | ❌ | `8` | 批处理大小 |
| `embedding.baseUrl` | string | ❌ | `null` | Embedding 服务地址 |

**说明：** 当前版本使用 Ollama Embedding 服务，无需下载本地模型文件。

### 7. 混合搜索配置（可选）

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `hybridSearch.denseWeight` | number | ❌ | `0.7` | 语义搜索权重（0-1） |
| `hybridSearch.sparseWeight` | number | ❌ | `0.3` | 关键词搜索权重（0-1） |
| `hybridSearch.limit` | number | ❌ | `20` | 搜索结果数量限制 |

**说明：** `denseWeight + sparseWeight` 应该等于 1。

### 8. NLP 配置（可选）

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `nlp.language` | string | ❌ | `zh` | NLP 语言（zh/en） |
| `nlp.extractEntities` | boolean | ❌ | `true` | 是否提取实体 |
| `nlp.extractKeywords` | boolean | ❌ | `true` | 是否提取关键词 |

**说明：** NLP 功能完全本地实现，无外部依赖。

## 环境变量

如果同时使用了环境变量和配置文件，环境变量优先级更高：

### 基础配置

```bash
export SIYUAN_BASE_URL="http://127.0.0.1:6806"
export SIYUAN_TOKEN="your-api-token-here"
export SIYUAN_DEFAULT_NOTEBOOK="your-notebook-id-here"
export SIYUAN_TIMEOUT=10000
export SIYUAN_DEFAULT_FORMAT="markdown"
```

### 权限配置

```bash
export SIYUAN_PERMISSION_MODE="all"
export SIYUAN_NOTEBOOK_LIST="id1,id2,id3"
```

### 功能配置

```bash
export SIYUAN_ENABLE_CACHE="true"
export SIYUAN_ENABLE_SYNC="false"
export SIYUAN_ENABLE_LOGGING="true"
export SIYUAN_DEBUG_MODE="false"
```

### Qdrant 配置

```bash
export QDRANT_URL="http://127.0.0.1:6333"
export QDRANT_API_KEY=""
export QDRANT_COLLECTION_NAME="siyuan_notes"
```

### Embedding 配置

```bash
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export OLLAMA_EMBED_MODEL="nomic-embed-text"
export EMBEDDING_DIMENSION=768
export EMBEDDING_BATCH_SIZE=8
```

### 混合搜索配置

```bash
export HYBRID_DENSE_WEIGHT=0.7
export HYBRID_SPARSE_WEIGHT=0.3
export HYBRID_SEARCH_LIMIT=20
```

### NLP 配置

```bash
export NLP_LANGUAGE="zh"
export NLP_EXTRACT_ENTITIES="true"
export NLP_EXTRACT_KEYWORDS="true"
```

## 使用方式

### 方式 1：进入技能目录运行

```bash
cd skills/siyuan-skill
node siyuan.js <command>
```

### 方式 2：使用 npm link 全局安装（推荐）

```bash
npm link -g
siyuan <command>
```

### 方式 3：直接指定路径运行

```bash
node <skills-directory>/siyuan-skill/siyuan.js <command>
```

## 常用命令

### 查看帮助

```bash
# 查看所有可用命令
siyuan help

# 查看特定命令的详细帮助
siyuan help search
siyuan help create
```

### 获取笔记本列表

```bash
siyuan notebooks
```

### 创建文档

```bash
# 创建空文档
siyuan create "我的文档"

# 创建带内容的文档
siyuan create "我的文档" "这是文档内容"

# 在指定路径下创建文档
siyuan create "子文档" "文档内容" --path /AI/openclaw/插件

# 创建多行内容文档
siyuan create "多行文档" "第一行\n第二行\n第三行"
```

### 搜索内容

```bash
# 基本搜索
siyuan search "关键词"

# 语义搜索
siyuan search "机器学习技术" --mode semantic

# 混合搜索（推荐）
siyuan search "人工智能应用" --mode hybrid

# 在指定路径下搜索
siyuan search "关键词" --path /AI/openclaw
```

### 更新文档

```bash
siyuan update <docId> "新的文档内容"
```

### 删除文档

```bash
siyuan delete <docId>
```

## 书写规范

### 内部链接

在思源笔记中，推荐使用内部链接来引用其他文档。

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
- 不使用标准 Markdown 链接写法（如 `[标题](docId)`）

**为什么推荐使用这种写法：**
1. **更好的兼容性**：思源笔记会自动处理这种链接格式
2. **导出友好**：导出时会自动显示为文档标题，而不是原始链接
3. **可维护性**：使用文档 ID 可以避免文档重命名后链接失效

**不推荐的写法：**
```markdown
# 不推荐：标准 Markdown 链接
[我的文档](20260304051123-doaxgi4)

# 不推荐：纯文档 ID
20260304051123-doaxgi4
```

### Front Matter 使用

Front Matter 是文档顶部的元数据区域，用于存储文档的元信息。

**基本格式：**
```yaml
---
title: 文档标题
date: 2024-01-01
tags: [tag1, tag2]
author: 作者名
---

文档内容
```

**常用字段：**
- `title` - 文档标题
- `date` - 创建日期
- `lastmod` - 最后修改日期
- `tags` - 标签列表
- `author` - 作者
- `category` - 分类

**注意事项：**
- Front Matter 必须在文档最顶部
- 使用 `---` 分隔符包裹
- 支持多行格式
- 字段名区分大小写

### Markdown 格式

思源笔记支持标准 Markdown 语法，推荐使用以下格式：

**标题：**
```markdown
# 一级标题
## 二级标题
### 三级标题
```

**列表：**
```markdown
- 无序列表项
  - 嵌套项

1. 有序列表项
2. 第二项
```

**代码块：**
```markdown
\`\`\`javascript
const x = 1;
\`\`\`
```

**引用：**
```markdown
> 这是一段引用
> 可以多行
```

**粗体和斜体：**
```markdown
**粗体文本**
*斜体文本*
***粗斜体***
```

## 权限管理

### 权限模式

当前系统支持三种权限模式（基于笔记本级别）：

1. **`all`** - 无限制访问所有笔记本
2. **`blacklist`** - 禁止访问指定笔记本
3. **`whitelist`** - 只允许访问指定笔记本

### 多人协作方案

#### 方案 1：配置文件分离（推荐，最简单）

为每个用户创建独立的配置文件，通过环境变量或参数指定。

**实现方式：**

```bash
# 用户 A 的配置文件
~/.siyuan/user-a/config.json
{
  "baseURL": "http://1.1.1.6806",
  "token": "user-a-token",
  "permissionMode": "whitelist",
  "notebookList": ["notebook-id-1", "notebook-id-2"]
}

# 用户 B 的配置文件（只读）
~/.siyuan/user-b/config.json
{
  "baseURL": "http://1.1.1.6806",
  "token": "user-b-token",
  "permissionMode": "whitelist",
  "notebookList": ["notebook-id-1"]
}

# 用户 C 的配置文件（可写）
~/.siyuan/user-c/config.json
{
  "baseURL": "http://1.1.1.6806",
  "token": "user-c-token",
  "permissionMode": "whitelist",
  "notebookList": ["notebook-id-1", "notebook-id-2"]
}
```

**使用方式：**

```bash
# 用户 A 使用自己的配置
export SIYUAN_CONFIG_PATH=~/.siyuan/user-a/config.json
siyuan create "文档" "内容"

# 用户 B 使用自己的配置（只读）
export SIYUAN_CONFIG_PATH=~/.siyuan/user-b/config.json
siyuan search "关键词"  # 只能搜索，不能创建/更新/删除

# 用户 C 使用自己的配置（可写）
export SIYUAN_CONFIG_PATH=~/.siyuan/user-c/config.json
siyuan create "文档" "内容"  # 可以创建
```

**优点：**
- ✅ 实现简单，无需修改代码
- ✅ 每个用户独立配置，互不影响
- ✅ 通过配置文件控制权限（只读用户不包含写操作命令）

**缺点：**
- ❌ 无法在同一个命令中区分读写
- ❌ 需要为每个用户维护配置文件

#### 方案 2：扩展权限系统支持读写（需要修改代码）

修改现有权限系统，添加读写权限控制。

**配置格式：**

```json
{
  "baseURL": "http://1.1.1.6806",
  "token": "shared-token",
  "permissionMode": "user-based",
  "users": {
    "user-a": {
      "notebooks": {
        "notebook-id-1": "read-write",
        "notebook-id-2": "read-only"
      }
    },
    "user-b": {
      "notebooks": {
        "notebook-id-1": "read-only",
        "notebook-id-3": "read-write"
      }
    },
    "user-c": {
      "notebooks": {
        "notebook-id-1": "read-only",
        "notebook-id-2": "read-only",
        "notebook-id-3": "read-write"
      }
    }
  },
  "currentUser": "user-a"  // 当前使用的用户
}
```

**使用方式：**

```bash
# 切换用户
export SIYUAN_CURRENT_USER=user-a
siyuan create "文档" "内容"  # 用户 A 可以读写

export SIYUAN_CURRENT_USER=user-b
siyuan search "关键词"  # 用户 B 只能搜索（只读）
siyuan create "文档" "内容"  # 用户 B 尝试创建会被拒绝

export SIYUAN_CURRENT_USER=user-c
siyuan update <docId> "内容"  # 用户 C 可以更新
```

**需要修改的文件：**
1. `config.js` - 添加用户配置支持
2. `index.js` - 修改 `checkPermission` 方法支持读写检查
3. `utils/permission.js` - 添加读写权限验证

**优点：**
- ✅ 细粒度权限控制
- ✅ 支持多用户协作
- ✅ 可以区分读写权限

**缺点：**
- ❌ 需要修改代码
- ❌ 配置复杂度增加

#### 方案 3：使用思源笔记自身权限系统（最佳实践）

思源笔记本身有完整的用户和权限管理系统，推荐使用原生功能。

**思源笔记权限特性：**
- ✅ 多用户支持
- ✅ 细粒度权限控制（读/写/管理）
- ✅ 用户组管理
- ✅ 操作日志记录

**实现方式：**

1. **为每个用户创建独立的思源笔记账户**
2. **在思源笔记中设置权限**
3. **命令行工具只作为客户端，不处理权限**

**配置示例：**

```bash
# 用户 A 的配置
~/.siyuan/user-a/config.json
{
  "baseURL": "http://1.1.1.6806",
  "token": "user-a-token",
  "permissionMode": "all"  # 使用思源笔记自身的权限
}

# 用户 B 的配置
~/.siyuan/user-b/config.json
{
  "baseURL": "http://1.1.1.6806",
  "token": "user-b-token",
  "permissionMode": "all"
}
```

**优点：**
- ✅ 使用思源笔记原生权限系统
- ✅ 无需修改命令行工具代码
- ✅ 权限管理更完善
- ✅ 支持审计日志

**缺点：**
- ❌ 需要在思源笔记中管理用户和权限
- ❌ 每个用户需要独立的思源笔记账户

## 推荐方案

根据您的需求，我推荐：

### 短期方案（立即使用）
**方案 1：配置文件分离**
- 为每个用户创建独立配置
- 通过环境变量 `SIYUAN_CONFIG_PATH` 切换
- 在配置中限制可访问的笔记本

### 长期方案（需要开发）
**方案 3：使用思源笔记自身权限**
- 在思源笔记中创建多个用户
- 为每个用户设置适当的权限
- 命令行工具只作为客户端

### 如果需要细粒度控制
**方案 2：扩展权限系统**
- 需要修改代码实现用户级别权限
- 支持读写权限分离
- 适合需要复杂权限控制的场景

## 注意事项

1. **首次使用**需要配置思源笔记 API 地址和 Token
2. **权限模式**：
   - `all` - 无限制访问所有笔记本
   - `whitelist` - 只允许访问指定笔记本
   - `blacklist` - 禁止访问指定笔记本
3. **缓存机制**：笔记本列表和文档结构会自动缓存，可使用 `--force-refresh` 强制刷新
4. **向量搜索**：需要单独部署 Qdrant 服务，否则会回退到 SQL 搜索
5. **NLP 功能**：完全本地实现，无外部依赖
6. **Embedding**：使用 Ollama 服务，无需下载本地模型文件

## 故障排除

### 常见问题

**问题 1：连接失败**
```
错误: 无法连接到 Siyuan Notes
解决: 检查 baseURL 和 token 是否正确
```

**问题 2：权限不足**
```
错误: 无权操作文档
解决: 检查 permissionMode 和 notebookList 配置
```

**问题 3：Qdrant 连接失败**
```
错误: Qdrant API 错误: 409 Conflict
解决: 集合已存在，系统会继续使用现有集合
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请提交 Issue。
