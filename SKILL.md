---
name: "siyuan-skill"
version: "1.2.0"
description: "思源笔记命令行工具，提供便捷的命令行操作方式，支持笔记本管理、文档操作、内容搜索等功能"
---

# Siyuan Skill CLI 命令行工具

思源笔记命令行工具，提供便捷的命令行方式来管理思源笔记内容。

## 快速开始

### 使用方式

```bash
# 方式 1：进入技能目录运行
cd <skills-directory>/siyuan-skill
node siyuan.js <command>

# 方式 2：使用 npm link 全局安装（推荐）
npm link -g
siyuan <command>

# 方式 3：直接指定路径运行
node <skills-directory>/siyuan-skill/siyuan.js <command>
```

### 查看帮助

```bash
# 查看所有可用命令
node siyuan.js help
# 或
siyuan help

# 查看特定命令的详细帮助
node siyuan.js help search
# 或
siyuan help search

# 查看其他命令的帮助
siyuan help create
siyuan help update
siyuan help nlp
```

**帮助系统特性：**
- 支持查看所有命令列表
- 支持查看特定命令的详细帮助
- 每个命令的帮助包含：描述、用法、选项、示例

## 命令列表

| 命令 | 别名 | 说明 | 用法 |
|-----|------|------|------|
| `notebooks` | `nb` | 获取笔记本列表 | `siyuan notebooks [--force-refresh]` |
| `structure` | `ls` | 获取文档结构 | `siyuan structure <notebookId> [--force-refresh]` |
| `content` | `cat` | 获取文档内容 | `siyuan content <docId> [--format <format>] [--raw]` |
| `search` | `find` | 搜索内容（支持向量搜索） | `siyuan search <query> [--mode hybrid\|semantic\|keyword\|legacy] [--limit <limit>]` |
| `create` | `new` | 创建文档（自动处理换行符） | `siyuan create <title> [content] [--parent-id <parentId>] [--path <path>] [--force]` |
| `update` | `edit` | 更新文档（自动处理换行符） | `siyuan update <docId> <content>` |
| `delete` | `rm` | 删除文档 | `siyuan delete <docId>` |
| `move` | `mv` | 移动文档 | `siyuan move <docId\|path> <targetParentId\|path> [--new-title <title>]` |
| `convert` | `path` | 转换 ID 和路径 | `siyuan convert --id <docId> 或 siyuan convert --path <hPath> [--force]` |
| `index` | - | 索引文档到向量数据库（支持自动分块） | `siyuan index [--notebook <id>] [--force]` |
| `nlp` | - | NLP 文本分析 | `siyuan nlp <text> [--tasks tokenize,entities,keywords]` |

## 搜索参数

`search` 命令支持以下参数：

| 参数 | 说明 | 示例 |
|-----|------|------|
| `--mode <mode>` | 搜索模式：hybrid（混合）、semantic（语义）、keyword（关键词）、legacy（SQL） | `--mode hybrid` |
| `--type <type>` | 按单个类型过滤 | `--type d` |
| `--types <types>` | 按多个类型过滤（逗号分隔） | `--types d,p,h` |
| `--sort-by <sortBy>` | 排序方式（relevance/date） | `--sort-by date` |
| `--limit <limit>` | 结果数量限制 | `--limit 5` |
| `--path <path>` | 搜索路径（仅搜索指定路径下的内容） | `--path /AI/openclaw` |
| `--sql <sql>` | 自定义SQL查询条件 | `--sql "length(content) > 100 AND updated > '20260101000000'"` |
| `--dense-weight <weight>` | 语义搜索权重（混合搜索时，默认 0.7） | `--dense-weight 0.8` |
| `--sparse-weight <weight>` | 关键词搜索权重（混合搜索时，默认 0.3） | `--sparse-weight 0.2` |
| `--threshold <score>` | 相似度阈值（0-1） | `--threshold 0.5` |

**搜索模式说明：**
- `hybrid` - 混合搜索（默认）：结合语义搜索和关键词搜索，提供最佳检索效果
- `semantic` - 语义搜索：基于向量相似度，能找到语义相关的内容（使用 nomic-embed-text 模型）
- `keyword` - 关键词搜索：基于 BM25 算法，精确匹配关键词
- `legacy` - SQL 搜索：使用原有的 SQL LIKE 查询

**支持的类型：**
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

### 获取笔记本列表

```bash
# 基本用法
node siyuan.js notebooks

# 强制刷新缓存
node siyuan.js notebooks --force-refresh
```

### 获取文档结构

```bash
# 获取指定笔记本的文档结构
node siyuan.js structure <notebook-id>

# 强制刷新缓存
node siyuan.js structure <notebook-id> --force-refresh
```

### 获取文档内容

```bash
# 获取文档内容（默认 markdown 格式）
node siyuan.js content <doc-id>

# 指定输出格式（text/html）
node siyuan.js content <doc-id> --format text

# 以纯文本格式返回（移除JSON外部结构）
node siyuan.js content <doc-id> --raw

# 组合使用格式和纯文本返回
node siyuan.js content <doc-id> --format text --raw
```

### 搜索内容

```bash
# 基本搜索
node siyuan.js search "关键词"

# 仅搜索文档类型
node siyuan.js search "关键词" --type d

# 搜索段落和标题
node siyuan.js search "关键词" --types p,h

# 按内容长度过滤
node siyuan.js search "关键词" --min-length 20 --max-length 500

# 按时间排序并限制结果数量
node siyuan.js search "关键词" --sort-by date --limit 5

# 在指定路径下搜索
node siyuan.js search "关键词" --path /AI/openclaw

# 在指定路径下搜索特定类型
node siyuan.js search "关键词" --path /AI/openclaw --type d

# 使用自定义SQL查询条件
node siyuan.js search "关键词" --sql "length(content) > 100 AND updated > '20260101000000'"

# 组合使用路径和SQL查询
node siyuan.js search "关键词" --path /AI/openclaw --sql "type = 'd'"

# 使用混合搜索（默认模式，结合语义和关键词）
node siyuan.js search "机器学习技术" --mode hybrid

# 使用语义搜索（找到语义相关的内容）
node siyuan.js search "人工智能应用" --mode semantic

# 使用关键词搜索（精确匹配关键词）
node siyuan.js search "深度学习" --mode keyword

# 使用 SQL 搜索（传统模式）
node siyuan.js search "关键词" --mode legacy

# 混合搜索时调整权重
node siyuan.js search "机器学习" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2

# 设置相似度阈值
node siyuan.js search "AI" --mode semantic --threshold 0.5
```

### 索引文档到向量数据库

```bash
# 索引所有笔记本的文档
node siyuan.js index

# 索引指定笔记本
node siyuan.js index --notebook 20260227231831-yq1lxq2

# 强制重建索引
node siyuan.js index --force

# 索引指定文档
node siyuan.js index --doc-ids "doc-id-1,doc-id-2"
```

**向量索引特性：**
- **自动分块处理**：当文档内容超过 4000 字符时，系统会自动使用思源笔记 API 的块列表功能将文档分块索引
- **智能分块策略**：基于文档的块结构（标题、段落、列表等）进行分块，每个块最大 3000 字符
- **保留原始信息**：分块索引时会保留原始文档 ID，搜索时可以追溯到原始文档
- **递归处理**：支持递归处理子文档，确保所有内容都被正确索引

### NLP 文本分析

```bash
# 分析文本（分词、实体识别、关键词提取）
node siyuan.js nlp "这是一段需要分析的文本内容"

# 只进行分词
node siyuan.js nlp "文本内容" --tasks tokenize

# 进行所有分析
node siyuan.js nlp "文本内容" --tasks tokenize,entities,keywords,summary
```

**NLP 功能特点：**
- 完全本地实现，无外部依赖
- 支持中英文分词
- 实体识别（邮箱、URL、手机号、日期、时间、IP地址、金额）
- 关键词提取（基于词频和权重计算）
- 语言检测（自动识别中文/英文）
- 摘要生成（基于关键词评分）

### 创建文档

```bash
# 创建空文档（在默认笔记本根目录）
node siyuan.js create "我的文档"

# 创建带内容的文档（在默认笔记本根目录）
node siyuan.js create "我的文档" "文档内容"

# 在指定父文档下创建文档
node siyuan.js create "子文档" "文档内容" --parent-id <parentId>

# 在指定路径下创建文档
node siyuan.js create "子文档" "文档内容" --path /AI/openclaw/插件

# 在指定路径下强制创建（忽略重名检测）
node siyuan.js create "子文档" "文档内容" --path /AI/openclaw/插件 --force

# 使用路径参数创建文档（简化版）
node siyuan.js create "API文档" "# API 文档内容" --path /技术文档/API

# 在嵌套路径下创建文档
node siyuan.js create "用户管理" "用户管理模块的详细说明" --path /系统设计/用户管理

# 创建多行内容文档（自动处理换行符）
node siyuan.js create "多行文档" "第一行内容\n第二行内容\n第三行内容"
```

**创建文档特性：**
- **自动换行符处理**：支持使用 `\n` 表示换行，系统会自动将其转换为实际的换行符
- **路径自动创建**：如果指定的路径不存在，系统会自动创建中间的文件夹
- **重名检测**：默认会检测同名文档，可使用 `--force` 参数强制创建
- **完整内容参数解析**：支持内容中包含空格，所有非 `--` 开头的参数都会被合并为文档内容

**Front Matter 使用说明：**
```bash
# 不添加 Front Matter（直接使用内容）
siyuan create "我的文档" "# 这是文档内容"

# 自定义 Front Matter（需要手动添加）
siyuan create "自定义文档" '---
title: 自定义标题
date: 2024-01-01
tags: [tag1, tag2]
---

这是文档内容'

# 混合使用 - 提供自定义 Front Matter
siyuan create "高级文档" '---
title: 高级文档
author: 张三
category: 技术
---

# 详细内容

这里是详细的内容描述...'
```

**长内容处理最佳实践：**
```bash
# 对于超长内容（超过 4000 字符），建议分两步操作：
# 1. 先创建空文档
siyuan create "长文档标题" "" --path /分类

# 2. 然后使用 update 命令更新完整内容
siyuan update <docId> "完整的超长内容..."

# 或者使用文件重定向
siyuan create "文件文档" "$(cat content.md)" --path /分类
```

### 更新文档

```bash
# 更新文档内容
node siyuan.js update <doc-id> "新的文档内容"

# 更新多行内容（自动处理换行符）
node siyuan.js update <doc-id> "第一行\n第二行\n第三行"
```

**更新文档特性：**
- **自动换行符处理**：支持使用 `\n` 表示换行，系统会自动将其转换为实际的换行符
- **保留文档结构**：更新时会保留文档的元数据和结构信息

### 删除文档

```bash
node siyuan.js delete <doc-id>
```

### 移动文档

```bash
# 基本用法 - 使用文档 ID 移动文档到新位置
node siyuan.js move <doc-id> <target-parent-id>

# 使用文档 ID 移动文档并同时重命名
node siyuan.js move <doc-id> <target-parent-id> --new-title "新标题"

# 使用路径方式移动文档（推荐）
node siyuan.js move /笔记本名称/文档路径 /目标笔记本/目标文档路径

# 使用别名
siyuan mv <doc-id> <target-parent-id>

# 路径方式示例
siyuan move /AI/test1 /AI/openclaw/更新记录
```

**参数说明：**
- `<doc-id>` 或 `<path>` - 要移动的文档 ID 或完整路径
- `<target-parent-id>` 或 `<path>` - 目标父目录或笔记本 ID 或路径
- `--new-title <title>` - 可选，移动后重命名文档

**路径格式说明：**
- 路径以 `/` 开头，例如：`/AI/test1`
- 第一个部分为笔记本名称或 ID
- 后续部分为文档路径
- 支持中文文档名称

### 转换 ID 和路径

```bash
# 将文档 ID 转换为路径
node siyuan.js convert --id 20260304051123-doaxgi4

# 将路径转换为文档 ID
node siyuan.js convert --path /AI/openclaw/更新记录

# 强制转换（当存在多个匹配时返回第一个结果）
node siyuan.js convert --path /AI/测试笔记 --force

# 使用别名
siyuan path 20260304051123-doaxgi4
siyuan path /AI/openclaw/更新记录

# 不带选项的简写方式（自动识别）
siyuan convert 20260304051123-doaxgi4
siyuan convert /AI/openclaw/更新记录

# 带强制参数的简写方式
siyuan convert /AI/测试笔记 --force
```

**参数说明：**
- `--id <docId>` - 文档 ID，格式：15 位数字 + 短横线 + 5 位字母数字
- `--path <hPath>` - 人类可读路径，例如：`/AI/openclaw/更新记录`
- `--force` - 强制操作（创建时忽略重名检测，转换时返回第一个匹配结果）
- `--parent-id <parentId>` - 父文档或笔记本 ID（用于创建文档）
- `--path <path>` - 文档路径（用于创建文档，支持绝对路径或相对路径）

**返回值说明：**
- ID 转路径：返回完整路径、存储路径、笔记本信息、文档标题
- 路径转 ID：返回文档 ID、名称、类型、笔记本信息

## 配置

### 环境变量（优先级最高）

```bash
# Windows PowerShell
$env:SIYUAN_BASE_URL="<your-api-url>"
$env:SIYUAN_TOKEN="<your-api-token>"
$env:SIYUAN_DEFAULT_NOTEBOOK="<your-notebook-id>"
$env:SIYUAN_PERMISSION_MODE="<permission-mode>"

# Linux/Mac
export SIYUAN_BASE_URL="<your-api-url>"
export SIYUAN_TOKEN="<your-api-token>"
export SIYUAN_DEFAULT_NOTEBOOK="<your-notebook-id>"
```

**参数说明：**
- `<your-api-url>` - 您的思源笔记 API 地址，例如：http://127.0.0.1:6806
- `<your-api-token>` - 您的 API 认证令牌，在思源笔记设置中获取
- `<your-notebook-id>` - 默认笔记本 ID
- `<permission-mode>` - 权限模式：all（无限制）、whitelist（白名单）、blacklist（黑名单）

### 配置文件

编辑 `config.json` 文件：

```json
{
  "baseURL": "<your-api-url>",
  "token": "<your-api-token>",
  "defaultNotebook": "<your-notebook-id>",
  "permissionMode": "<permission-mode>"
}
```

**主要配置项：**
- `SIYUAN_BASE_URL` - API 地址（默认：http://127.0.0.1:6806）
- `SIYUAN_TOKEN` - API 令牌
- `SIYUAN_DEFAULT_NOTEBOOK` - 默认笔记本 ID
- `SIYUAN_PERMISSION_MODE` - 权限模式（all/blacklist/whitelist）

### 向量搜索配置（可选）

```bash
# Qdrant 向量数据库配置
QDRANT_URL=http://127.0.0.1:6333
QDRANT_API_KEY=
QDRANT_COLLECTION_NAME=siyuan_notes

# Ollama Embedding 服务配置
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_EMBED_MODEL=nomic-embed-text

# 混合搜索权重
HYBRID_DENSE_WEIGHT=0.7
HYBRID_SPARSE_WEIGHT=0.3

# NLP 配置
NLP_LANGUAGE=zh
```

**向量搜索配置说明：**
- `QDRANT_URL` - Qdrant 服务地址（http://127.0.0.1:6333）
- `QDRANT_API_KEY` - Qdrant API 密钥（可选）
- `OLLAMA_BASE_URL` - Ollama API 地址（http://127.0.0.1:11434）
- `OLLAMA_EMBED_MODEL` - Embedding 模型名称（默认：nomic-embed-text）
- `HYBRID_DENSE_WEIGHT` - 语义搜索权重（默认：0.7）
- `HYBRID_SPARSE_WEIGHT` - 关键词搜索权重（默认：0.3）

**注意：** 向量搜索功能需要单独部署 Qdrant 服务。如果 Qdrant 不可用，系统会自动回退到 SQL 搜索。当前版本使用 Ollama Embedding 服务，无需下载本地模型文件。

## 错误处理

所有命令返回标准化格式：

```json
{
  "success": true,
  "data": { /* 结果数据 */ },
  "message": "操作成功",
  "timestamp": 1646389200000
}
```

失败时：

```json
{
  "success": false,
  "error": "错误信息",
  "message": "错误描述"
}
```

## 注意事项

1. **首次使用**需要配置思源笔记 API 地址和 Token
2. **权限模式**：
   - `all` - 无限制访问所有笔记本
   - `whitelist` - 只允许访问指定笔记本
   - `blacklist` - 禁止访问指定笔记本
3. **缓存机制**：笔记本列表和文档结构会自动缓存，可使用 `--force-refresh` 强制刷新


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
