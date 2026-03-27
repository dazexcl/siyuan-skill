---
name: "siyuan-skill"
version: "1.6.15"
description: "思源笔记命令行工具，提供便捷的命令行操作方式，支持笔记本管理、文档操作、内容搜索、块控制等功能"
skillType: "cli"
runtime: "node"
runtimeVersion: ">=14.0.0"
installType: "clone"
installSpec:
  method: "git-clone"
  source: "https://github.com/dazexcl/siyuan-skill.git"
  directory: "siyuan-skill"
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
  - name: "SIYUAN_NOTEBOOK_LIST"
    description: "白名单/黑名单笔记本列表（逗号分隔）"
  - name: "SIYUAN_TIMEOUT"
    description: "API 请求超时时间（毫秒）"
    default: "10000"
  - name: "QDRANT_URL"
    description: "Qdrant 向量数据库地址（语义搜索需要）"
  - name: "OLLAMA_BASE_URL"
    description: "Ollama 服务地址（语义搜索需要）"
---

> 📋 完整环境变量配置见 [环境变量文档](doc/config/environment.md)

# Siyuan Skill

**思源笔记 CLI 工具** - 为 AI Agent 提供笔记本管理、文档操作、内容搜索、块控制等功能。

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

# 快速决策表

根据用户需求快速选择正确的命令：

| 用户需求 | 使用命令 | 关键参数 | 示例 |
|----------|----------|----------|------|
| 查看笔记本列表 | `notebooks` / `nb` | 无 | `siyuan nb` |
| 查看文档结构 | `structure` / `ls` | `--depth` | `siyuan ls <notebookId>` |
| 查看文档内容 | `content` / `cat` | 无 | `siyuan cat <docId>` |
| 获取文档信息 | `info` | 文档ID | `siyuan info <docId>` |
| 创建新文档 | `create` / `new` | `--parent-id` 或 `--path` | `siyuan create "标题" --parent-id xxx` |
| 修改整个文档 | `update` / `edit` | 文档ID | `siyuan update <docId> "完整内容"` |
| 修改单个块 | `block-update` / `bu` | 块ID（非文档ID） | `siyuan bu <blockId> "块内容"` |
| 删除文档 | `delete` / `rm` | 文档ID | `siyuan rm <docId>` |
| 删除单个块 | `block-delete` / `bd` | 块ID | `siyuan bd <blockId>` |
| 搜索内容 | `search` / `find` | `--mode` | `siyuan search "关键词"` |
| 检查文档存在 | `exists` / `check` | `--title` 或 `--path` | `siyuan exists --title "标题"` |
| 设置文档属性 | `block-attrs` / `ba` | `--set` | `siyuan ba <docId> --set "status=done"` |
| 设置标签 | `tags` / `st` | `--tags` | `siyuan st <docId> --tags "A,B"` |
| 移动文档 | `move` / `mv` | `--new-title`（可选） | `siyuan mv <docId> <targetId>` |
| 重命名文档 | `rename` | 新标题 | `siyuan rename <docId> "新标题"` |
| 保护/取消保护 | `protect` | `--on` / `--off` | `siyuan protect <docId> --on` |
| 转换ID和路径 | `convert` / `path` | `--to-id` 或 `--to-path` | `siyuan path "/笔记本/文档" --to-id` |

---

# 命令列表

## 常用命令

| 命令 | 别名 | 说明 |
|------|------|------|
| `notebooks` | `nb` | 获取笔记本列表 |
| `structure` | `ls` | 获取文档结构 |
| `content` | `cat` | 获取文档内容 |
| `info` | - | 获取文档基础信息（ID、标题、路径、属性、标签） |
| `create` | `new` | 创建文档（自动重名检测） |
| `update` | `edit` | 更新文档内容（仅接受文档ID） |
| `delete` | `rm` | 删除文档（受保护） |
| `protect` | - | 设置/移除文档保护 |
| `move` | `mv` | 移动文档（自动重名检测） |
| `rename` | - | 重命名文档（自动重名检测） |
| `search` | `find` | 搜索内容 |
| `convert` | `path` | 转换 ID 和路径 |
| `block-attrs` | `ba`, `attrs` | 管理块/文档属性（设置/获取/移除） |
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
| `block-transfer-ref` | `btr` | 转移块引用 |

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

## 标准工作流

### 创建文档工作流

```
1. 检查文档是否存在
   └─ siyuan exists --title "标题" [--parent-id <父ID>]
   
2a. 如不存在 → 直接创建
    └─ siyuan create "标题" "内容" --parent-id <id>
    
2b. 如存在 → 询问用户
    ├─ 覆盖？ → siyuan update <docId> "新内容"
    └─ 新建同名？ → siyuan create "标题" "内容" --force
    
3. 设置属性（可选）
   └─ siyuan ba <docId> --set "status=draft"
   └─ siyuan st <docId> --tags "标签1,标签2"
```

### 修改文档工作流

```
1. 获取当前内容
   └─ siyuan content <docId>
   
2. 判断修改范围
   ├─ 全文替换 → siyuan update <docId> "完整新内容"
   └─ 仅修改部分块 → 继续步骤3
   
3. 查看块结构（块级修改）
   └─ siyuan bg <docId> --mode kramdown
   
4. 根据需求选择操作
   ├─ 更新单个块 → siyuan bu <blockId> "新内容"
   ├─ 删除多余块 → siyuan bd <blockId>
   └─ 插入新块 → siyuan bi <parentId> "内容"
   
5. 验证结果
   └─ siyuan content <docId>
```

### 搜索文档工作流

```
1. 选择搜索模式
   ├─ 精确匹配 → siyuan search "关键词"
   ├─ 语义搜索 → siyuan search "概念" --mode semantic
   └─ 混合搜索 → siyuan search "查询" --mode hybrid
   
2. 根据结果定位文档
   └─ siyuan content <docId>
```

### 批量操作工作流

```
1. 获取目标列表
   └─ siyuan ls <notebookId> --depth 3
   
2. 逐个处理（避免并发问题）
   └─ for doc in docs: siyuan update <doc.id> "内容"
   
3. 验证结果
   └─ siyuan ls <notebookId>
```

## info 命令

获取文档基础信息（ID、标题、路径、属性、标签）。

```bash
siyuan info <docId> [--format json]
```

> 📋 详细用法见 [info 命令文档](doc/commands/info.md)

## create 命令

**三种创建模式**：

| 模式 | 场景 | 示例 |
|------|------|------|
| 传统模式 | 已知父ID | `siyuan create "标题" "内容" --parent-id <id>` |
| 路径指定 | 创建多级目录 | `siyuan create --path "笔记本/A/B/C" "内容"` |
| 目录下创建 | 批量创建 | `siyuan create --path "笔记本/目录/" "标题" "内容"` |

**关键参数**：
- `--parent-id <id>` — 指定父文档/笔记本ID
- `--path "/路径"` — 指定完整路径（中间目录自动创建）
- `--force` — 强制创建同名文档

**注意事项**：
- 标题中的 `/` 自动转为 `／`
- 默认检测重名，已存在时用 `--force`
- ❌ 不要用 `--parent-path`、`--notebook`、`--folder`

> 📋 详细用法见 [create 命令文档](doc/commands/create.md)

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

# 获取属性
siyuan ba <docId> --get

# 移除属性
siyuan ba <docId> --remove "status"

# ❌ 不推荐：在内容中添加 Front Matter
```

> **属性前缀说明**：
> - 默认：属性自动添加 `custom-` 前缀，在思源界面**可见**
> - `--hide`：设置/操作内部属性（不带 `custom-` 前缀），在界面**不可见**

## 文档格式

```bash
# ✅ 正确：使用 \n 换行
siyuan create "标题" "第一段\n\n## 二级标题\n内容"

# ❌ 错误：所有内容在一行
siyuan create "标题" "第一段## 二级标题 内容"
```

## 内容规范

**常见错误预防表**：

| 错误场景 | 错误做法 | 正确做法 |
|----------|----------|----------|
| 标题包含 `/` | 手动转义 | 自动转为 `／`，无需处理 |
| 文档已存在 | 直接 create | 先 `exists` 检查，再用 `--force` |
| 删除被阻止 | 反复尝试 | 告知用户修改配置或使用 `protect` |
| ID 类型混淆 | `update` 用块ID | `update` 只用文档ID，`bu` 只用块ID |
| 修改部分内容 | 删了重建 | 用 `bu` 或 `bd` 进行块级操作 |
| 格式问题 | 用 `bu` 覆盖 | 先 `bg` 查看结构，再用 `bd` 删除多余块 |

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

**思源特有语法**：

| 语法 | 写法 | 说明 |
|------|------|------|
| 内部链接 | `((docId '标题'))` | 引用其他文档，导出时显示标题 |
| SQL 嵌入块 | `{{ SELECT ... }}` | 动态查询并嵌入内容 |

> 详细用法请参阅 [最佳实践 - 内容书写](doc/advanced/best-practices.md#内容书写最佳实践)

**其他规范**：
- 写入使用 Markdown 格式
- kramdown 格式仅用于读取

---

# 高级功能

## 向量搜索（可选）

需配置 `QDRANT_URL` + `OLLAMA_BASE_URL`。

**搜索模式**：

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

> 📋 详细配置见 [向量搜索文档](doc/advanced/vector-search.md)

## NLP 分析

```bash
siyuan nlp "文本" --tasks tokenize,keywords
```

> 📋 详细用法见 [NLP 文档](doc/commands/nlp.md)

---

# 安全要点

- 仅使用本地实例 (`http://localhost:6806`)
- 推荐使用 `whitelist` 权限模式
- 删除功能默认禁用，需用户手动配置

> 📋 详细安全配置见 [配置文档](doc/config/advanced.md)

---

# 参考文档

- [命令详细文档](doc/commands/)
- [配置文档](doc/config/)
- [高级功能](doc/advanced/)
- [思源笔记 API](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)

---

# 更新

```bash
# 进入 skill 目录（根据实际安装工具选择）
# OpenClaw: cd ~/.openclaw/skills/siyuan-skill
# Trae:     cd ~/.trae/skills/siyuan-skill
# Cursor:   cd ~/.cursor/skills/siyuan-skill
# Claude Desktop (macOS): cd ~/Library/Application\ Support/Claude/claude-desktop/skills/siyuan-skill

git pull origin main
node siyuan.js help  # 验证
```

> 📋 详细安装说明见 [INSTALL.md](INSTALL.md)
