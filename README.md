# Siyuan Skill

[![GitHub](https://img.shields.io/badge/GitHub-Source-green.svg)](https://github.com/dazexcl/siyuan-skill)
[![Version](https://img.shields.io/badge/version-1.7.4-blue.svg)](https://github.com/dazexcl/siyuan-skill)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/dazexcl/siyuan-skill)
[![Node](https://img.shields.io/badge/node->=14-green.svg)](https://github.com/dazexcl/siyuan-skill)
[![Features](https://img.shields.io/badge/features-Vector%20Search-blue.svg)](https://github.com/dazexcl/siyuan-skill)
[![Features](https://img.shields.io/badge/features-NLP-orange.svg)](https://github.com/dazexcl/siyuan-skill)

> **思源笔记命令行工具** - 为 AI Agent 和人类用户提供笔记本管理、文档操作、内容搜索、块控制等功能。

`纯Node环境` `无外部依赖` `开箱即用` `Agent友好` `灵活拔插` `黑白名单` `渐进式披露`

***

## 目录

- [核心价值](#核心价值)
- [运行时要求](#运行时要求)
- [快速开始](#快速开始)
- [使用方式](#使用方式)
- [命令详解](#命令详解)
- [配置说明](#配置说明)
- [环境变量](#环境变量)
- [权限管理](#权限管理)
- [删除保护](#删除保护)
- [高级功能](#高级功能)
- [书写规范](#书写规范)
- [最佳实践](#最佳实践)
- [故障排除](#故障排除)
- [安全审计](#安全审计)
- [文档目录](#文档目录)

***

## 核心价值

**提供 AI Agent 可快速接入思源笔记的 Skill 方案**

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

***

## 运行时要求

| 要求          | 版本        | 说明                                   |
| ----------- | --------- | ------------------------------------ |
| **Node.js** | >= 14.0.0 | 必需                                   |
| **思源笔记**    | >= 3.6.0  | 运行中的本地实例（推荐 `http://localhost:6806`） |

***

## 快速开始

### 1. 安装 Skill

**方式 1：克隆到 Skills 目录（推荐）**

```bash
# 进入AI工具的 Skills 目录
cd ~/skills

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
node siyuan.js help
```

### 2. 获取凭证

**获取 API Token**

1. 打开思源笔记
2. 进入 **设置 → 关于**
3. 复制 **API Token**

**获取笔记本 ID**

```bash
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

### 3. 配置

**方式 A：环境变量（推荐）**

```bash
export SIYUAN_BASE_URL="http://localhost:6806"
export SIYUAN_TOKEN="你的 API token"
export SIYUAN_DEFAULT_NOTEBOOK="默认笔记本 ID"
```

**方式 B：配置文件**

```bash
# 复制配置示例
cp config.example.json config.json

# 编辑配置文件
# 修改 config.json 中的必要配置项
```

### 4. 验证

```bash
# 测试连接
node siyuan.js notebooks

# 查看帮助
node siyuan.js help
```

***

## 使用方式

### 方式 1：进入技能目录运行

```bash
cd skills/siyuan-skill
node siyuan.js <command>
```

### 方式 2：使用 npm link 全局安装（推荐）

```bash
cd skills/siyuan-skill
npm link
siyuan <command>
```

### 方式 3：直接指定路径运行

```bash
node <skills-directory>/siyuan-skill/siyuan.js <command>
```

***

## 命令详解

### 查看帮助

```bash
# 查看所有可用命令
siyuan help

# 查看特定命令的详细帮助
siyuan help search
siyuan help create
siyuan help update
```

### 笔记本操作

```bash
# 获取笔记本列表
siyuan notebooks
siyuan nb                    # 别名

# 获取文档结构
siyuan structure [notebook]
siyuan ls [notebook]         # 别名
```

### 文档操作

```bash
# 创建文档 - 三种模式
# 模式1：传统模式（位置参数1=标题，位置参数2=内容）
siyuan create "我的文档" --parent-id <notebookId>
siyuan create "我的文档" "文档内容" --parent-id <docId>

# 模式2：路径指定文档（路径末尾无/，标题从路径提取，位置参数=内容）
siyuan create --path "AI/项目/需求文档" "文档内容"
siyuan create --path "AI/项目/需求文档" --title "自定义标题" "内容"
siyuan create --path "AI/A/B/C"  # 创建多级空目录

# 模式3：在目录下创建（路径末尾有/，位置参数1=标题，位置参数2=内容）
siyuan create --path "AI/项目/" "新文档标题" "内容"

# 重名检测：默认检测同名文档
siyuan create --path "AI/测试" "内容"      # 已存在时报错
siyuan create --path "AI/测试" "内容" --force  # 强制创建

# 别名
siyuan new "标题" "内容"

# 获取文档内容
siyuan content <docId>                  # 默认 kramdown 格式
siyuan content <docId> --format markdown
siyuan content <docId> --format text
siyuan content <docId> --format html
siyuan content <docId> --raw            # 纯文本输出
siyuan cat <docId>                      # 别名

# 获取文档信息（ID、标题、路径、属性、标签）
siyuan info <docId>                     # 摘要格式
siyuan info <docId> --format json       # 完整格式（含原始属性）

# 更新文档（仅接受文档ID）
siyuan update <docId> "新的文档内容"
siyuan edit <docId> "新内容"            # 别名

# 更新块（仅接受块ID）
siyuan block-update <blockId> "更新后的内容"
siyuan bu <blockId> "新内容"            # 别名

# 删除文档（受保护）
siyuan delete <docId>
siyuan rm <docId>                       # 别名
siyuan rm <docId> --confirm-title "标题" # 带确认

# 移动文档
siyuan move <docId> <targetParentId>
siyuan mv <docId> <targetParentId>      # 别名
siyuan mv <docId> --parent <parentId> --new-title "新标题"

# 重命名文档
siyuan rename <docId> "新标题"
```

**格式说明：**

| 格式         | 说明             |
| ---------- | -------------- |
| `kramdown` | 包含块 ID 和属性（默认） |
| `markdown` | 标准 Markdown 格式 |
| `text`     | 纯文本格式          |
| `html`     | HTML 格式        |

### 搜索操作

```bash
# 基本搜索
siyuan search "关键词"
siyuan find "关键词"                    # 别名

# 搜索模式
siyuan search "关键词" --mode keyword   # 关键词搜索（默认）
siyuan search "概念描述" --mode semantic # 语义搜索（需向量服务）
siyuan search "查询内容" --mode hybrid   # 混合搜索（需向量服务）

# WHERE 条件过滤
siyuan search "关键词" --where "length(content) > 100"

# 搜索选项
siyuan search "关键词" --limit 10
siyuan search "关键词" --path /AI/openclaw
siyuan search "关键词" --type d
siyuan search "查询" --semantic --threshold 0.7 --sort-by score
```

### 块操作

```bash
# 获取块信息
siyuan block-get <blockId>
siyuan bg <blockId>                     # 别名
siyuan bg <docId> --mode children       # 获取子块

# 插入块
siyuan block-insert <parentId> "新段落内容"
siyuan bi <parentId> "内容"             # 别名
siyuan bi <parentId> "内容" --position first
siyuan bi <parentId> "内容" --position last

# 更新块
siyuan block-update <blockId> "更新后的内容"
siyuan bu <blockId> "新内容"            # 别名

# 删除块
siyuan block-delete <blockId>
siyuan bd <blockId>                     # 别名

# 移动块
siyuan block-move <blockId> --previous-id <targetBlockId>
siyuan bm <blockId> --prev <pid>        # 别名
siyuan bm <blockId> --next <nid>

# 折叠/展开块
siyuan block-fold <blockId>             # 折叠
siyuan bf <blockId>                     # 别名
siyuan buu <blockId>                    # 展开（别名）

# 转移块引用
siyuan btr --from-id <fromId> --to-id <toId>
```

### 属性与标签

```bash
# 设置块属性（默认添加 custom- 前缀，在界面可见）
siyuan block-attrs <blockId> --set "key=value"
siyuan ba <blockId> --set "status=published"   # 别名
siyuan attrs <blockId> --set "key=value"       # 别名

# 获取属性
siyuan ba <blockId> --get                  # 获取所有属性
siyuan ba <blockId> --get status           # 获取指定属性

# 移除属性
siyuan ba <blockId> --remove "key1,key2"   # 移除指定属性

# 设置内部属性（不带 custom- 前缀，在界面不可见）
siyuan ba <blockId> --set "internal=value" --hide

# 设置标签
siyuan tags <blockId> --tags "标签1,标签2"
siyuan st <blockId> --tags "新标签"            # 别名

# 添加标签（追加模式）
siyuan st <blockId> --tags "新标签" --add

# 获取标签
siyuan tags <blockId> --get

# 清除所有标签
siyuan tags <blockId> --clear
```

**属性前缀说明：**

| 模式       | 前缀        | 可见性        |
| -------- | --------- | ---------- |
| 默认       | `custom-` | 在思源笔记界面可见  |
| `--hide` | 无前缀       | 内部属性，界面不可见 |

**注意：** `--set`、`--get`、`--remove` 三者互斥，每次只能使用其中一个。

### 文档保护

```bash
# 设置保护（防止误删除）
siyuan protect <docId>

# 设置永久保护（无法通过命令移除）
siyuan protect <docId> --permanent

# 移除保护
siyuan protect <docId> --remove
siyuan protect <docId> --disable        # 别名

# 启用保护
siyuan protect <docId> --enable
```

### 检查文档是否存在

```bash
# 通过标题检查
siyuan exists --title "文档标题"
siyuan exists --title "子文档" --parent-id <父文档ID>

# 通过路径检查
siyuan exists --path "/目录/文档标题"

# 别名
siyuan check "文档标题"
```

**返回结果：**

```json
// 文档存在
{
  "success": true,
  "exists": true,
  "data": { "id": "xxx", "path": "/目录/文档标题" },
  "message": "文档存在，ID: xxx"
}

// 文档不存在
{
  "success": true,
  "exists": false,
  "message": "文档不存在"
}
```

### 工具命令

```bash
# ID/路径转换
siyuan convert <id-or-path>
siyuan path <id-or-path>                # 别名

# 向量索引
siyuan index                            # 增量索引（默认，自动清理孤立索引）
siyuan index --force                    # 强制重建索引
siyuan index --remove                   # 只移除索引，不重新索引
siyuan index <notebook-id>              # 索引指定笔记本
siyuan index --notebook <notebookId>    # 索引指定笔记本

# NLP 分析（实验性）
siyuan nlp "这是一段需要分析的文本"
siyuan nlp "文本内容" --tasks tokenize,entities,keywords
siyuan nlp "文本内容" --tasks all
siyuan nlp "文本内容" --tasks keywords --top-n 5
```

***

## 配置说明

### config.json 完整配置

```json
{
  "baseURL": "http://localhost:6806",
  "token": "your-api-token-here",
  "timeout": 10000,
  "defaultNotebook": "your-notebook-id-here",
  "permissionMode": "all",
  "notebookList": [],
  "deleteProtection": {
    "safeMode": true,
    "requireConfirmation": false,
    "protectedNotebooks": [],
    "protectedPaths": []
  },
  "tls": {
    "allowSelfSignedCerts": false,
    "allowedHosts": ["localhost"]
  },
  "qdrant": {
    "url": "http://localhost:6333",
    "apiKey": "",
    "collectionName": "siyuan_notes"
  },
  "embedding": {
    "model": "nomic-embed-text",
    "dimension": 768,
    "batchSize": 5,
    "maxContentLength": 4000,
    "maxChunkLength": 4000,
    "minChunkLength": 200,
    "baseUrl": "http://localhost:11434",
    "skipIndexAttrs": []
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

### 1. 基础连接配置

| 配置项       | 类型     | 必填 | 默认值                     | 说明          |
| --------- | ------ | -- | ----------------------- | ----------- |
| `baseURL` | string | ✅  | `http://localhost:6806` | 思源笔记 API 地址 |
| `token`   | string | ✅  | `""`                    | API 认证令牌    |
| `timeout` | number | ❌  | `10000`                 | 请求超时时间（毫秒）  |

### 2. 默认值配置

| 配置项               | 类型     | 必填 | 默认值    | 说明       |
| ----------------- | ------ | -- | ------ | -------- |
| `defaultNotebook` | string | ✅  | `null` | 默认笔记本 ID |

### 3. 权限配置

| 配置项              | 类型     | 必填 | 默认值   | 说明        |
| ---------------- | ------ | -- | ----- | --------- |
| `permissionMode` | string | ❌  | `all` | 权限模式      |
| `notebookList`   | array  | ❌  | `[]`  | 笔记本 ID 列表 |

**权限模式说明：**

| 模式          | 说明                         |
| ----------- | -------------------------- |
| `all`       | 无限制访问所有笔记本                 |
| `whitelist` | 只允许访问 `notebookList` 中的笔记本 |
| `blacklist` | 禁止访问 `notebookList` 中的笔记本  |

### 4. 删除保护配置

| 配置项                                    | 类型      | 必填 | 默认值     | 说明           |
| -------------------------------------- | ------- | -- | ------- | ------------ |
| `deleteProtection.safeMode`            | boolean | ❌  | `true`  | 安全模式（默认禁止删除） |
| `deleteProtection.requireConfirmation` | boolean | ❌  | `false` | 删除确认机制       |
| `deleteProtection.protectedNotebooks`  | array   | ❌  | `[]`    | 受保护的笔记本 ID   |
| `deleteProtection.protectedPaths`      | array   | ❌  | `[]`    | 受保护的路径       |

**保护层级：**

1. **全局安全模式** - 默认启用，禁止所有删除操作
2. **文档保护标记** - 通过 `protect` 命令设置
3. **删除确认机制** - 需要确认文档标题

### 5. TLS 配置

| 配置项                        | 类型      | 必填 | 默认值             | 说明        |
| -------------------------- | ------- | -- | --------------- | --------- |
| `tls.allowSelfSignedCerts` | boolean | ❌  | `false`         | 是否允许自签名证书 |
| `tls.allowedHosts`         | array   | ❌  | `["localhost"]` | 允许的主机列表   |

### 6. Qdrant 向量数据库配置（可选）

| 配置项                     | 类型     | 必填 | 默认值            | 说明            |
| ----------------------- | ------ | -- | -------------- | ------------- |
| `qdrant.url`            | string | ❌  | `null`         | Qdrant 服务地址   |
| `qdrant.apiKey`         | string | ❌  | `""`           | Qdrant API 密钥 |
| `qdrant.collectionName` | string | ❌  | `siyuan_notes` | 集合名称          |

**说明：** 向量搜索功能需要单独部署 Qdrant 服务。如果 Qdrant 不可用，系统会自动回退到 SQL 搜索。

### 8. Embedding 模型配置（可选）

| 配置项                          | 类型     | 必填 | 默认值                | 说明             |
| ---------------------------- | ------ | -- | ------------------ | -------------- |
| `embedding.model`            | string | ❌  | `nomic-embed-text` | Embedding 模型名称 |
| `embedding.dimension`        | number | ❌  | `768`              | 向量维度           |
| `embedding.batchSize`        | number | ❌  | `5`                | 批处理大小          |
| `embedding.maxContentLength` | number | ❌  | `4000`             | 触发分块的内容长度阈值    |
| `embedding.maxChunkLength`   | number | ❌  | `4000`             | 单个分块最大长度       |
| `embedding.minChunkLength`   | number | ❌  | `200`              | 单个分块最小长度       |
| `embedding.baseUrl`          | string | ❌  | `null`             | Embedding 服务地址 |
| `embedding.skipIndexAttrs`   | array  | ❌  | `[]`               | 跳过索引的属性名列表     |

**说明：** 当前版本使用 Ollama Embedding 服务，无需下载本地模型文件。`skipIndexAttrs` 用于指定哪些属性的文档应跳过索引，如 `["custom-skip-index", "custom-draft"]`。

### 9. 混合搜索配置（可选）

| 配置项                         | 类型     | 必填 | 默认值   | 说明           |
| --------------------------- | ------ | -- | ----- | ------------ |
| `hybridSearch.denseWeight`  | number | ❌  | `0.7` | 语义搜索权重（0-1）  |
| `hybridSearch.sparseWeight` | number | ❌  | `0.3` | 关键词搜索权重（0-1） |
| `hybridSearch.limit`        | number | ❌  | `20`  | 搜索结果数量限制     |

**说明：** `denseWeight + sparseWeight` 应该等于 1。

### 10. NLP 配置（可选，实验性）

> ⚠️ **实验性功能**：NLP 功能目前处于实验阶段，API 可能会发生变化。

| 配置项                   | 类型      | 必填 | 默认值    | 说明            |
| --------------------- | ------- | -- | ------ | ------------- |
| `nlp.language`        | string  | ❌  | `zh`   | NLP 语言（zh/en） |
| `nlp.extractEntities` | boolean | ❌  | `true` | 是否提取实体        |
| `nlp.extractKeywords` | boolean | ❌  | `true` | 是否提取关键词       |

**说明：** NLP 功能完全本地实现，无外部依赖。

***

## 环境变量

如果同时使用了环境变量和配置文件，**环境变量优先级更高**。

### 基础配置

```bash
SIYUAN_BASE_URL="http://localhost:6806"
SIYUAN_TOKEN="your-api-token-here"
SIYUAN_DEFAULT_NOTEBOOK="your-notebook-id-here"
SIYUAN_TIMEOUT=10000
```

### 权限配置

```bash
SIYUAN_PERMISSION_MODE="all"
SIYUAN_NOTEBOOK_LIST="id1,id2,id3"
```

### 删除保护配置

```bash
SIYUAN_DELETE_SAFE_MODE="true"
SIYUAN_DELETE_REQUIRE_CONFIRMATION="false"
```

### TLS 配置

```bash
SIYUAN_TLS_ALLOW_SELF_SIGNED="false"
SIYUAN_TLS_ALLOWED_HOSTS="localhost,127.0.0.1"
```

### Qdrant 配置

```bash
QDRANT_URL="http://localhost:6333"
QDRANT_API_KEY=""
QDRANT_COLLECTION_NAME="siyuan_notes"
```

### Embedding 配置

```bash
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_EMBED_MODEL="nomic-embed-text"
EMBEDDING_DIMENSION=768
EMBEDDING_BATCH_SIZE=5
SIYUAN_EMBEDDING_MAX_CONTENT_LENGTH=4000
SIYUAN_EMBEDDING_MAX_CHUNK_LENGTH=4000
SIYUAN_EMBEDDING_MIN_CHUNK_LENGTH=200
```

### 混合搜索配置

```bash
HYBRID_DENSE_WEIGHT=0.7
HYBRID_SPARSE_WEIGHT=0.3
HYBRID_SEARCH_LIMIT=20
```

### NLP 配置

```bash
NLP_LANGUAGE="zh"
NLP_EXTRACT_ENTITIES="true"
NLP_EXTRACT_KEYWORDS="true"
```

***

## 权限管理

### 权限模式

当前系统支持三种权限模式（基于笔记本级别）：

| 模式          | 说明         | 适用场景    |
| ----------- | ---------- | ------- |
| `all`       | 无限制访问所有笔记本 | 开发/测试环境 |
| `whitelist` | 只允许访问指定笔记本 | 生产环境    |
| `blacklist` | 禁止访问指定笔记本  | 受限访问    |

### 配置示例

**白名单模式：**

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

### 多人协作方案权限控制

> 计划中

***

## 重名检测

以下命令在执行前会自动检测目标位置是否存在同名文档：

| 命令       | 检测时机 | 冲突处理                        |
| -------- | ---- | --------------------------- |
| `create` | 创建前  | 返回错误，使用 `--force` 强制创建      |
| `move`   | 移动前  | 返回错误，使用 `--new-title` 指定新标题 |
| `rename` | 重命名前 | 返回错误，需更换新标题                 |

### 示例

```bash
# 检测到冲突
siyuan create "文档标题" "内容"
# 返回: 在目标位置已存在标题为"文档标题"的文档（ID: xxx），请使用 --force 参数强制创建

# 强制创建同名文档
siyuan create "文档标题" "内容" --force

# 移动时检测到冲突
siyuan mv <docId> <targetParentId>
# 返回: 在目标位置已存在同名文档，请使用 --new-title 参数指定新标题

# 使用新标题移动
siyuan mv <docId> <targetParentId> --new-title "新标题"
```

### 手动检查

```bash
# 通过标题检查
siyuan exists --title "文档标题" [--parent-id <父文档ID>]

# 通过路径检查
siyuan exists --path "/目录/文档标题"
```

***

## 删除保护

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

***

## 高级功能

### 向量搜索（可选）

**部署服务：**

```bash
# 部署 Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

# 部署 Ollama + 模型
ollama pull nomic-embed-text
```

**配置环境变量：**

```bash
QDRANT_URL=http://localhost:6333
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
```

**使用语义搜索：**

```bash
siyuan search "机器学习" --mode semantic
siyuan search "人工智能应用" --mode hybrid
```

### 搜索模式对比

| 模式  | 命令                  | 适用场景 | 依赖              |
| --- | ------------------- | ---- | --------------- |
| 关键词 | `--mode keyword`    | 精确匹配 | 无               |
| WHERE过滤 | `--where "条件"` | 条件过滤 | 无               |
| 语义  | `--mode semantic`   | 概念查找 | Qdrant + Ollama |
| 混合  | `--mode hybrid`     | 综合搜索 | Qdrant + Ollama |

### NLP 分析

```bash
# 分析文本
siyuan nlp "这是一段需要分析的文本"

# 指定分析任务
siyuan nlp "文本内容" --tasks tokenize,entities,keywords

# 进行所有分析
siyuan nlp "文本内容" --tasks all

# 限制关键词数量
siyuan nlp "文本内容" --tasks keywords --top-n 5
```

***

## 书写规范

> 📋 完整书写规范见 [书写指南](references/advanced/writing-guide.md)

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

***

## 最佳实践

### 内容创建

```bash
# 模式选择建议：
# - 简单创建，已知父ID → 模式1
# - 创建多级目录 → 模式2
# - 在目录下批量创建 → 模式3

# ✅ 推荐：直接创建
siyuan create "标题" "第一段\n\n## 二级标题\n内容"

# ✅ 创建多级目录
siyuan create --path "笔记本/A/B/C" "内容"

# ✅ 超长内容：两步法
siyuan create "长文档" ""
siyuan update <docId> "$(cat content.md)"

# ❌ 不推荐：删除后重建（丢失属性、引用）
```

### 属性设置

```bash
# ✅ 推荐：使用命令
siyuan ba <docId> --set "status=published"
siyuan st <docId> --tags "重要,待审核"

# ❌ 不推荐：在内容中添加 Front Matter
```

### 文档格式

```bash
# ✅ 正确：使用 \n 换行
siyuan create "标题" "第一段\n\n## 二级标题\n内容"

# ❌ 错误：所有内容在一行
siyuan create "标题" "第一段## 二级标题 内容"
```

### 注意事项

1. **首次使用**需要配置思源笔记 API 地址和 Token
2. **权限模式**：根据实际需求选择合适的权限模式
3. **向量搜索**：需要单独部署 Qdrant 服务，否则会回退到 SQL 搜索
4. **NLP 功能**：完全本地实现，无外部依赖
5. **Embedding**：使用 Ollama 服务，无需下载本地模型文件

> 更多最佳实践请参阅 [doc/advanced/best-practices.md](doc/advanced/best-practices.md)

***

## 故障排除

### 常见错误

| 错误                            | 原因       | 解决方案                  |
| ----------------------------- | -------- | --------------------- |
| `ECONNREFUSED`                | 服务未启动    | 检查思源笔记是否运行            |
| `401 Unauthorized`            | Token 无效 | 检查 `SIYUAN_TOKEN`     |
| `404 Not Found`               | 文档不存在    | 检查 ID 或路径             |
| `403 Forbidden`               | 权限不足     | 检查权限模式配置              |
| `删除被阻止`                       | 安全模式     | 配置 `deleteProtection` |
| `Qdrant API 错误: 409 Conflict` | 集合已存在    | 系统会继续使用现有集合           |

### 调试模式

```bash
# 启用调试输出
DEBUG=* node siyuan.js <command>
```

### 连接测试

```bash
# 测试 API 连接
node siyuan.js notebooks
```

***

## 安全审计

本工具完全开源，欢迎审计：

- **主要源码**：`connector.js`, `config.js`, `index.js`, `siyuan.js`
- **TLS 证书验证**：默认启用
- **日志脱敏**：Token/密码自动隐藏

> 🔒 **安全建议**：仅连接本地实例 `http://localhost:6806`

***

## 文档目录

```
doc/
├── commands/              # 命令详细文档
│   ├── document.md        # 文档操作命令
│   ├── block.md           # 块操作命令
│   ├── search.md          # 搜索命令
│   └── ...
├── config/
│   ├── environment.md     # 环境变量配置
│   └── advanced.md        # config.json 配置
└── advanced/
    ├── best-practices.md  # 最佳实践
    ├── permission.md      # 权限管理
    └── vector-search.md   # 向量搜索
```

***

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请提交 [Issue](https://github.com/dazexcl/siyuan-skill/issues)。

[GitHub](https://github.com/dazexcl/siyuan-skill)