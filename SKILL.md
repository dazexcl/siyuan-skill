---
name: "siyuan-skill"
description: "思源笔记API转CLI工具，支持笔记本管理、文档操作、内容搜索、块控制。当用户操作思源笔记、管理笔记本、创建/更新/删除文档、搜索内容、管理块时调用。"
skillType: "cli"
homepage: "https://github.com/dazexcl/siyuan-skill"
metadata: {"openclaw":{"emoji":"📝","requires":{"bins":["node"],"env":["SIYUAN_BASE_URL","SIYUAN_TOKEN","SIYUAN_DEFAULT_NOTEBOOK"],"optionalEnv":["SIYUAN_TIMEOUT","SIYUAN_PERMISSION_MODE","SIYUAN_NOTEBOOK_LIST","QDRANT_URL","QDRANT_API_KEY","QDRANT_COLLECTION_NAME","OLLAMA_BASE_URL","OLLAMA_EMBED_MODEL","EMBEDDING_MODEL","EMBEDDING_BASE_URL","EMBEDDING_DIMENSION","EMBEDDING_BATCH_SIZE","SIYUAN_EMBEDDING_MAX_CONTENT_LENGTH","SIYUAN_EMBEDDING_MAX_CHUNK_LENGTH","SIYUAN_EMBEDDING_MIN_CHUNK_LENGTH","SIYUAN_SKIP_INDEX_ATTRS","HYBRID_DENSE_WEIGHT","HYBRID_SPARSE_WEIGHT","HYBRID_SEARCH_LIMIT","NLP_LANGUAGE","NLP_EXTRACT_ENTITIES","NLP_EXTRACT_KEYWORDS","SIYUAN_DELETE_SAFE_MODE","SIYUAN_DELETE_REQUIRE_CONFIRMATION","SIYUAN_TLS_ALLOW_SELF_SIGNED","SIYUAN_TLS_ALLOWED_HOSTS"]},"primaryEnv":"SIYUAN_TOKEN"}}
---

> **运行要求：** Node.js >= 14.0.0，思源笔记 >= 3.6.0
> 
> **安装：** 从 [ClawHub](https://clawhub.ai/dazexcl/siyuan-skill) 下载，详见 [安装配置指南](references/config/setup.md)
> 
> **环境变量：** 参考 [环境变量文档](references/config/environment.md)

---


# 快速开始

```bash
cd skills/siyuan-skill
node siyuan.js <command> [options]
node siyuan.js help <command>  # 查看命令帮助
node siyuan.js --version       # 显示版本信息
```

---

# 快速决策表

根据用户需求快速选择正确的命令：

## 笔记本与文档操作

| 用户需求 | 使用命令 | 关键参数 | 示例 |
|----------|----------|----------|------|
| 查看笔记本列表 | `notebooks` / `nb` | 无 | `siyuan nb` |
| 查看文档结构 | `structure` / `ls` | `--depth` | `siyuan ls <notebookId>` |
| 查看文档内容 | `content` / `cat` | 无 | `siyuan cat <docId>` |
| 获取文档信息 | `info` | 文档ID | `siyuan info <docId>` |
| 创建新文档 | `create` / `new` | `--parent-id` 或 `--path` | `siyuan create "标题" --parent-id xxx` |
| 修改整个文档 | `update` / `edit` | 文档ID | `siyuan update <docId> "完整内容"` |
| 删除文档 | `delete` / `rm` | 文档ID | `siyuan rm <docId>` |
| 移动文档 | `move` / `mv` | `--new-title`（可选） | `siyuan mv <docId> <targetId>` |
| 重命名文档 | `rename` | 新标题 | `siyuan rename <docId> "新标题"` |
| 保护/取消保护 | `protect` | `--on` / `--off` | `siyuan protect <docId> --on` |
| 检查文档存在 | `exists` / `check` | `--title` 或 `--path` | `siyuan exists --title "标题"` |
| 转换ID和路径 | `convert` / `path` | `--to-id` 或 `--to-path` | `siyuan path "/笔记本/文档" --to-id` |
| 设置文档图标 | `icon` / `set-icon` | `--emoji` / `--get` / `--remove` | `siyuan icon <docId> --emoji 1f4c4` |
| 设置文档属性 | `block-attrs` / `ba` | `--set` / `--get` / `--remove` | `siyuan ba <docId> --set "status=done"` |
| 设置标签 | `tags` / `st` | `--tags` | `siyuan st <docId> --tags "A,B"` |
| 搜索内容 | `search` / `find` | `--mode` / `--threshold` | `siyuan search "关键词" --mode semantic` |

## 块操作

| 用户需求 | 使用命令 | 关键参数 | 示例 |
|----------|----------|----------|------|
| 获取块信息 | `block-get` / `bg` | `--mode` | `siyuan bg <blockId> --mode kramdown` |
| 修改单个块 | `block-update` / `bu` | 块ID（非文档ID） | `siyuan bu <blockId> "块内容"` |
| 插入新块 | `block-insert` / `bi` | `--parent-id` / `--next-id` | `siyuan bi "内容" --parent-id xxx` |
| 删除单个块 | `block-delete` / `bd` | 块ID | `siyuan bd <blockId>` |
| 移动块 | `block-move` / `bm` | `--parent-id` / `--next-id` | `siyuan bm <blockId> --parent-id xxx` |
| 折叠/展开块 | `block-fold` / `bf` | `--fold` / `--unfold` | `siyuan bf <blockId> --fold` |
| 转移块引用 | `block-transfer-ref` / `btr` | 源块ID、目标块ID | `siyuan btr <srcId> <tgtId>` |

> **重要区分**：`update` 只接受文档ID，`block-update` 只接受块ID

---

## 块操作决策流程

**操作前必须执行**：
1. 先用 `bg <blockId> --mode kramdown` 查看块结构
2. 分析哪些块是多余的、哪些需要修改
3. 根据目标选择正确的命令

| 目标 | 命令 | 说明 |
|------|------|------|
| 删除不需要的块 | `bd <blockId>` | 整个块删除 |
| 修改块内容 | `bu <blockId> "新内容"` | 保留块 ID，更新内容 |
| 查看块结构 | `bg <blockId> --mode kramdown` | 查看 kramdown 格式 |
| 查看文档内容 | `content <docId>` | 查看完整文档 |

---

# 重名检测

以下命令在执行前会自动检测目标位置是否存在同名文档：

| 命令 | 检测时机 | 冲突处理 |
|------|----------|----------|
| `create` | 创建前 | 返回错误，使用 `--force` 强制创建 |
| `move` | 移动前 | 返回错误，使用 `--new-title` 指定新标题 |
| `rename` | 重命名前 | 返回错误，需更换新标题 |

**手动检查文档是否存在：**

```bash
siyuan exists --title "文档标题" [--parent-id <父文档ID>]
siyuan exists --path "/目录/文档标题"
```

---

# 删除保护

**默认禁止删除文档**。如需启用删除功能，**必须由用户手动**在 `config.json` 中配置。

> ⚠️ **Agent 禁止自动修改此配置**


保护层级：全局安全模式 → 文档保护标记 → 删除确认机制

> 💡 **提示**：如删除被阻止，应告知用户修改配置或使用 `protect` 命令移除文档保护标记

---

# 最佳实践

## 标准工作流

### 创建文档

```
1. 检查文档是否存在
   └─ siyuan exists --title "标题" [--parent-id <父ID>]
   
2a. 如不存在 → 直接创建
    └─ siyuan create "标题" "内容" --parent-id <id>
    
2b. 如存在 → 询问用户
    ├─ 覆盖？ → siyuan update <docId> "新内容"
    └─ 新建同名？ → siyuan create "标题" "内容" --force
```

### 修改文档

```
1. 获取当前内容
   └─ siyuan content <docId>
   
2. 判断修改范围
   ├─ 全文替换 → siyuan update <docId> "完整新内容"
   └─ 仅修改部分块 → 先 siyuan bg <docId> --mode kramdown
```

## create 命令

| 模式 | 场景 | 示例 |
|------|------|------|
| 传统模式 | 已知父ID | `siyuan create "标题" "内容" --parent-id <id>` |
| 路径指定 | 创建多级目录 | `siyuan create --path "笔记本/A/B/C" "内容"` |
| 目录下创建 | 批量创建 | `siyuan create --path "笔记本/目录/" "标题" "内容"` |

> 📋 详细用法见 [create 命令文档](references/commands/create.md)

## 内容修改

```bash
# ✅ 推荐
siyuan update <docId> "新内容"        # 全文更新：必须传入完整的文档内容
siyuan bu <blockId> "新内容"          # 块更新：只需传入需要修改的块内容

# ❌ 错误：混用命令
siyuan bu <docId> "内容"              # 错误：block-update 不接受文档ID
siyuan update <blockId> "内容"        # 错误：update 不接受块ID
```

## 属性设置

```bash
siyuan ba <docId> --set "status=published"
siyuan ba <docId> --get
siyuan ba <docId> --remove "status"
siyuan st <docId> --tags "重要,待审核"
```

## 图标设置

```bash
siyuan icon <docId> --emoji 📄       # 直接传入 emoji
siyuan icon <docId> --emoji 1f4c4    # 或使用编码
siyuan icon <docId> --get            # 获取图标
siyuan icon <docId> --remove         # 移除图标
```

> 📋 完整 emoji 编码表见 [图标命令文档](references/commands/icon.md)

## 文档格式

```bash
# ✅ 正确：使用 \n 换行
siyuan create "标题" "第一段\n\n## 二级标题\n内容"

# ❌ 错误：所有内容在一行
siyuan create "标题" "第一段## 二级标题 内容"
```

## 常见错误预防

| 错误场景 | 错误做法 | 正确做法 |
|----------|----------|----------|
| 文档已存在 | 直接 create | 先 `exists` 检查，再用 `--force` |
| 删除被阻止 | 反复尝试 | 告知用户修改配置或使用 `protect` |
| ID 类型混淆 | `update` 用块ID | `update` 只用文档ID，`bu` 只用块ID |
| 修改部分内容 | 删了重建 | 用 `bu` 或 `bd` 进行块级操作 |

## 书写规范

### 内部链接

```markdown
((docId '标题'))
```

### SQL 嵌入块

```markdown
{{ SELECT * FROM blocks WHERE type = 'd' ORDER BY updated DESC LIMIT 5 }}
```

> 📋 完整规范见 [书写指南](references/advanced/writing-guide.md) 和 [最佳实践](references/advanced/best-practices.md)

---

# 高级功能

## 向量搜索（可选）

需配置 `QDRANT_URL` + `OLLAMA_BASE_URL`。

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `legacy` | SQL LIKE 精确匹配 | 精确关键词 |
| `keyword` | BM25 + N-gram | 关键词匹配 |
| `semantic` | 语义向量 | 同义词、概念 |
| `hybrid` | 稠密 + 稀疏 | 综合搜索 |

```bash
siyuan index                        # 增量索引
siyuan search "关键词" --mode semantic
```

**相关度分数参考：**

| 分数范围 | 相关性 | 说明 |
|----------|--------|------|
| 0.9-1.0 | 极高 | 几乎相同内容 |
| 0.7-0.9 | 高度 | 语义非常接近 |
| 0.5-0.7 | 中等 | 语义有交集 |
| <0.5 | 弱 | 参考价值低 |

```bash
siyuan search "关键词" --mode semantic --threshold 0.7
```

> 📋 详细配置见 [向量搜索文档](references/advanced/vector-search.md)

## NLP 分析

```bash
siyuan nlp "文本" --tasks tokenize,keywords
```

> 📋 详细用法见 [NLP 文档](references/commands/nlp.md)

---

# 安全要点

- 仅使用本地实例 (`http://localhost:6806`)
- 推荐使用 `whitelist` 权限模式
- 删除功能默认禁用，需用户手动配置
- **配置只读保护**：CLI 命令集不暴露任何配置修改 API，敏感配置（token 等）仅通过环境变量注入，不会持久化到配置文件
- **Token 安全**：SIYUAN_TOKEN 仅从环境变量或 config.json 读取，技能本身绝不会修改或写入 token
- **可选功能**：QDRANT_URL、OLLAMA_BASE_URL 为可选配置，如不需要向量搜索/NLP 功能，无需配置这些变量

> 📋 详细安全配置见 [配置文档](references/config/advanced.md)

## 安全声明

### 配置只读保护

**重要**：本技能采用**配置只读**设计原则。

- 所有敏感配置（token、API 密钥等）**仅通过环境变量或 config.json 读取**
- 技能本身**不提供任何配置写入能力**
- 配置变更需要用户**手动修改**环境变量或配置文件

### Token 处理

- `SIYUAN_TOKEN` **仅从环境变量或 config.json 读取**
- 技能本身**绝不修改或写入 token**
- Token 变更需要用户手动操作

### 可选功能

- `QDRANT_URL`、`OLLAMA_BASE_URL` 为**可选配置**
- 如不需要向量搜索/NLP 功能，**无需配置**这些变量
- 不配置时，技能将使用基础的 SQL 搜索模式

---

# 参考文档

- [安装配置指南](references/config/setup.md)
- [环境变量配置](references/config/environment.md)
- [命令详细文档](references/commands/)
- [高级功能](references/advanced/)
- [书写指南（内容格式规范）](references/advanced/writing-guide.md)
- [最佳实践](references/advanced/best-practices.md)
- [使用指南（故障排除）](references/advanced/usage-guide.md)
- [思源笔记 API](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)

---
