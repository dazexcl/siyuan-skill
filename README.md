# Siyuan Skill

[![GitHub](https://img.shields.io/badge/GitHub-Source-green.svg)](https://github.com/dazexcl/siyuan-skill)
[![Version](https://img.shields.io/badge/version-1.3.0-blue.svg)](https://github.com/dazexcl/siyuan-skill)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/dazexcl/siyuan-skill)
[![Node](https://img.shields.io/badge/node->14-green.svg)](https://github.com/dazexcl/siyuan-skill)

> **Siyuan Notes 命令行工具，提供便捷的命令行操作方式，支持笔记本管理、文档操作、内容搜索等功能。**

[![Features](https://img.shields.io/badge/features-Vector%20Search-blue.svg)](https://github.com/dazexcl/siyuan-skill)
[![Features](https://img.shields.io/badge/features-NLP-blue.svg)](https://github.com/dazexcl/siyuan-skill)


`纯node环境` `无需任何依赖` `开箱即用` `agent自动接入` `灵活拔插` `黑白名单`
## 核心价值

**提供ai agent可快速接入siyuan笔记的的skill方案**
**为 AI Agent 团队提供统一、结构化、可检索的共享知识库**

### 适用场景

✅ 团队规范、项目知识、可复用技能  
✅ 需要多 Agent 共享的知识  
✅ 需要长期存储和检索的内容  

### 不适用场景

❌ 日常互动记录、个人学习反思  
❌ 临时笔记、代码版本管理  
❌ 实时协作编辑  

### 关键原则

- **思源笔记** = 共享知识库
- **memory 文件** = 私密记录
- **MEMORY.md** = 长期记忆

##  目录

- [核心价值](#核心价值)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [环境变量](#环境变量)
- [使用方式](#使用方式)
- [常用命令](#常用命令)
- [书写规范](#书写规范)
- [权限管理](#权限管理)
- [故障排除](#故障排除)
- [贡献](#贡献)

---

## 快速开始

### 安装 Skill

**方式 1：克隆到 Skills 目录（推荐）**

```bash
# 进入AI工具的 Skills 目录
cd %USERPROFILE%/skills

# 克隆仓库
git clone https://github.com/dazexcl/siyuan-skill.git

# 进入技能目录
cd siyuan-skill

```

**方式 2：手动复制**

```bash
# 将整个 siyuan-skill 目录复制到 Skills 目录
```

**验证安装**

```bash
# 进入技能目录
cd %USERPROFILE%/skills/siyuan-skill

# 测试命令
node siyuan.js help
```

### 配置

#### 方式 1：使用环境变量（推荐）

```bash
export SIYUAN_BASE_URL="http://127.0.0.1:6806"
export SIYUAN_TOKEN="你的 API token"
export SIYUAN_DEFAULT_NOTEBOOK="默认笔记本 ID"
```

#### 方式 2：直接编辑 config.json
**复制配置文件**

```bash
# 进入技能目录
cd skills/siyuan-skill

# 复制配置示例
cp config.example.json config.json

# 编辑配置文件
# 修改 config.json 中的必要配置项
```

**修改配置文件**

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

## 权限管理

### 权限模式

当前系统支持三种权限模式（基于笔记本级别）：

1. **`all`** - 无限制访问所有笔记本
2. **`blacklist`** - 禁止访问指定笔记本
3. **`whitelist`** - 只允许访问指定笔记本

### 多人协作方案权限控制

> 计划中

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
