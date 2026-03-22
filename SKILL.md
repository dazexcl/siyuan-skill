---
name: "siyuan-skill"
version: "1.6.10"
description: "思源笔记命令行工具，提供便捷的命令行操作方式，支持笔记本管理、文档操作、内容搜索、块控制等功能"
skillType: "cli"
runtime: "node"
runtimeVersion: ">=14.0.0"
installType: "executable"
required_env_vars:
  - name: "SIYUAN_BASE_URL"
    description: "思源笔记 API 地址"
    required: true
    example: "http://localhost:6806"
  - name: "SIYUAN_TOKEN"
    description: "API 认证令牌"
    required: true
  - name: "SIYUAN_DEFAULT_NOTEBOOK"
    description: "默认笔记本 ID"
    required: true
optional_env_vars:
  - name: "SIYUAN_PERMISSION_MODE"
    description: "权限模式 (all/whitelist/blacklist)"
    default: "all"
  - name: "QDRANT_URL"
    description: "Qdrant 向量数据库地址（语义搜索需要）"
  - name: "OLLAMA_BASE_URL"
    description: "Ollama 服务地址（语义搜索需要）"
---

# Siyuan Skill

**思源笔记 CLI 工具** - 为 AI Agent 提供笔记本管理、文档操作、内容搜索、块控制等功能。

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `SIYUAN_BASE_URL` | ✅ | API 地址，建议 `http://localhost:6806` |
| `SIYUAN_TOKEN` | ✅ | API 令牌 |
| `SIYUAN_DEFAULT_NOTEBOOK` | ✅ | 默认笔记本 ID |
| `SIYUAN_PERMISSION_MODE` | ❌ | 权限模式，默认 `all` |

---

# 重要约束

- **必须使用 CLI 命令操作思源笔记**
- **禁止自动修改配置文件和环境变量**

---

# 快速开始

```bash
node siyuan.js <command> [options]
siyuan help <command>  # 查看命令帮助
```

---

# 命令列表

## 常用命令

| 命令 | 别名 | 说明 |
|------|------|------|
| `notebooks` | `nb` | 获取笔记本列表 |
| `structure` | `ls` | 获取文档结构 |
| `content` | `cat` | 获取文档内容 |
| `create` | `new` | 创建文档（自动重名检测） |
| `update` | `edit` | 更新文档内容（仅接受文档ID） |
| `delete` | `rm` | 删除文档（受保护） |
| `protect` | - | 设置/移除文档保护 |
| `move` | `mv` | 移动文档（自动重名检测） |
| `rename` | - | 重命名文档（自动重名检测） |
| `search` | `find` | 搜索内容 |
| `convert` | `path` | 转换 ID 和路径 |
| `block-attrs` | `ba`, `attrs` | 设置块/文档属性 |
| `tags` | `st` | 设置标签 |
| `exists` | `check` | 检查文档是否存在 |

## 块操作命令

| 命令 | 别名 | 说明 |
|------|------|------|
| `block-insert` | `bi` | 插入块 |
| `block-update` | `bu` | 更新块内容（仅接受块ID） |
| `block-delete` | `bd` | 删除块（仅限普通块） |
| `block-move` | `bm` | 移动块 |
| `block-get` | `bg` | 获取块信息 |
| `block-fold` | `bf`, `buu` | 折叠/展开块 |

> **重要区分**：
> - `update` 命令：仅接受**文档ID**，用于更新整个文档内容
> - `block-update` 命令：仅接受**块ID**（非文档ID），用于更新单个块内容
> - 两个命令不能混用，传入错误类型的ID会返回错误提示

## 块操作决策流程

**操作前必须执行**：
1. 先用 `bg <blockId> --mode kramdown` 查看块结构
2. 分析哪些块是多余的、哪些需要修改
3. 根据目标选择正确的命令

**命令选择规则**：

| 目标 | 命令 | 说明 |
|------|------|------|
| 删除不需要的块 | `bd <blockId>` | 整个块删除 |
| 修改块内容 | `bu <blockId> "新内容"` | 保留块 ID，更新内容 |
| 查看块结构 | `bg <blockId> --mode kramdown` | 查看 kramdown 格式 |
| 查看文档内容 | `content <docId>` | 查看完整文档 |

**常见错误**：
- ❌ 不分析结构就直接 `bu` 更新
- ❌ 对需要删除的块用 `bu` 更新
- ✅ 先 `bg` 查看，再决定用 `bu` 还是 `bd`

---

# 重名检测

以下命令在执行前会自动检测目标位置是否存在同名文档：

| 命令 | 检测时机 | 冲突处理 |
|------|----------|----------|
| `create` | 创建前 | 返回错误，使用 `--force` 强制创建 |
| `move` | 移动前 | 返回错误，使用 `--new-title` 指定新标题 |
| `rename` | 重命名前 | 返回错误，需更换新标题 |

**示例：**

```bash
# 检测到冲突
siyuan create "文档标题" "内容"
# 返回: 在目标位置已存在标题为"文档标题"的文档，请使用 --force 参数强制创建

# 强制创建同名文档
siyuan create "文档标题" "内容" --force

# 移动时检测到冲突
siyuan mv <docId> <targetParentId>
# 返回: 在目标位置已存在同名文档，请使用 --new-title 参数指定新标题

# 使用新标题移动
siyuan mv <docId> <targetParentId> --new-title "新标题"
```

**手动检查文档是否存在：**

```bash
# 通过标题检查
siyuan exists --title "文档标题" [--parent-id <父文档ID>]

# 通过路径检查
siyuan exists --path "/目录/文档标题"

# 返回示例
# 存在: { "exists": true, "id": "xxx", "path": "/xxx" }
# 不存在: { "exists": false }
```

---

# 删除保护

**默认禁止删除文档**。如需启用删除功能，**必须由用户手动**在 `config.json` 中配置。

> ⚠️ **Agent 禁止自动修改此配置**

```json
{
  "deleteProtection": {
    "safeMode": false,
    "requireConfirmation": true
  }
}
```

保护层级：全局安全模式 → 文档保护标记 → 删除确认机制

> 💡 **提示**：如删除被阻止，应告知用户修改配置或使用 `protect` 命令移除文档保护标记

---

# 最佳实践

## create 命令参数

参数顺序灵活，以下写法都支持：

```bash
# 以下三种写法效果相同
siyuan create "文档标题" "文档内容" --parent-id <parentId>
siyuan create --parent-id <parentId> "文档标题" "文档内容"
siyuan create "文档标题" --path "/笔记本/目录/文档名" "文档内容"
```

**指定目标位置的方式**（二选一）：
- `--parent-id <id>` — 指定父文档/笔记本ID
- `--path "/路径"` — 指定完整路径（推荐）

**常见错误参数提示**：
- ❌ `--parent-path` → ✅ 使用 `--path` 或 `--parent-id`
- ❌ `--notebook` → ✅ 使用 `--parent-id`（笔记本ID也可作为父ID）
- ❌ `--folder` / `--dir` → ✅ 使用 `--parent-id` 或 `--path`

**标题包含斜杠**：
- 标题中的 `/` 会自动转换为全角 `／`，避免被误认为路径分隔符
- 示例：`siyuan create "文档/子标题" "内容"` → 实际标题为 `文档／子标题`

## 内容修改

```bash
# ✅ 推荐：使用正确的命令
siyuan update <docId> "新内容"        # 全文更新：必须传入完整的文档内容
siyuan edit <docId> "新内容"          # 全文更新：同上
siyuan bu <blockId> "新内容"          # 块更新：只需传入需要修改的块内容

# ❌ 错误：混用命令
siyuan bu <docId> "内容"              # 错误：block-update 不接受文档ID
siyuan update <blockId> "内容"        # 错误：update 不接受块ID

# ❌ 不推荐：删除再新建（丢失属性、引用）
```

> **重要说明**：
> - `update` 命令：**全文更新**，必须传入文档的完整内容，会替换整个文档
> - `block-update` 命令：**块更新**，只需传入需要修改的单个块内容，不影响其他块

## 属性设置

```bash
# ✅ 推荐：使用命令设置
siyuan ba <docId> --set "status=published"
siyuan st <docId> --tags "重要,待审核"

# ❌ 不推荐：在内容中添加 Front Matter
```

## 文档格式

```bash
# ✅ 正确：使用 \n 换行
siyuan create "标题" "第一段\n\n## 二级标题\n内容"

# ❌ 错误：所有内容在一行
siyuan create "标题" "第一段## 二级标题 内容"
```

## 内容规范

**文档属性**（通过文档设置，不是正文内容）：
- 标题 (`title`) — 在文档属性中设置，**正文中不重复**
- 标签 (`tags`) — 用 `st` 命令设置，**不用 Front Matter**
- 日期 (`date`) — 在文档属性中设置

**正文开头**：
- ❌ 不要写 `# 标题`（思源笔记会自动显示文档标题）
- ❌ 不要写 YAML Front Matter (`---\ntitle:...\n---`)
- ❌ 不要写引用块 (`> 所属系列...`)
- ✅ 直接开始正文内容

**修复格式问题的正确方法**：
1. `bg <docId> --mode kramdown` 查看块结构
2. 识别多余的块（重复标题、Front Matter、引用块）
3. 用 `bd <blockId>` 删除多余的块
4. **不要**用 `bu` 或 `update` 来修复格式问题

**其他规范**：
- 写入使用 Markdown 格式
- kramdown 格式仅用于读取

---

# 高级功能

## 向量搜索（可选）

需部署 Qdrant + Ollama，配置环境变量：
- `QDRANT_URL`
- `OLLAMA_BASE_URL`

### 向量索引

```bash
siyuan index                            # 增量索引（默认，自动清理孤立索引）
siyuan index --force                    # 强制重建索引
siyuan index --remove                   # 只移除索引，不重新索引
siyuan index <notebook-id>              # 索引指定笔记本
siyuan index --notebook <notebookId>    # 索引指定笔记本
```

### 搜索模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `legacy`（默认） | SQL LIKE 精确匹配 | 精确关键词搜索 |
| `keyword` | 稀疏向量（BM25）+ N-gram | 关键词匹配，支持未登录词 |
| `semantic` | 稠密向量（语义） | 同义词、概念关联 |
| `hybrid` | 稠密 + 稀疏 | 综合搜索 |

### 搜索示例

```bash
# 默认 Legacy 模式（精确匹配）
siyuan search "关键词"

# 关键词搜索（支持 N-gram）
siyuan search "长颈鹿" --mode keyword

# 语义搜索
siyuan search "人工智能" --mode semantic

# 混合搜索
siyuan search "AI" --mode hybrid
```

## NLP 分析

```bash
siyuan nlp "文本" --tasks tokenize,keywords
```

---

# 安全建议

- 仅将 `SIYUAN_BASE_URL` 设置为本地实例（`http://localhost:6806`）
- 推荐使用 `whitelist` 权限模式限制可访问的笔记本
- 生产环境不启用 `DEBUG` 环境变量
- 敏感信息（token、password、apiKey）在日志中自动脱敏
- TLS 证书验证默认启用
- **SQL 注入防护**：搜索功能已实现完整的参数转义和验证

## 搜索安全特性

| 特性 | 说明 |
|------|------|
| 查询转义 | 所有搜索查询都经过 `escapeSql` 转义 |
| ID 验证 | 笔记本/文档 ID 必须符合 14-32 位字母数字格式 |
| 类型白名单 | 类型参数只接受预定义值 |
| 权重归一化 | 权重参数自动归一化到 0-1 范围 |
| 并发控制 | 批量请求最多 5 个并发，每批 10 个结果 |

## 程序化 API

本 skill 导出 `createSkill` 和 `executeSingleCommand` 函数供高级用户使用：

```javascript
const { createSkill } = require('./index.js');
const skill = createSkill({ baseURL: 'http://localhost:6806', token: 'xxx' });
```

> ⚠️ 程序化 API 仅供高级用户在受控环境中使用。普通 AI Agent 应仅使用 CLI 命令。

---

# 参考文档

- [命令详细文档](doc/commands/)
- [配置文档](doc/config/)
- [高级功能](doc/advanced/)
- [思源笔记 API](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)
