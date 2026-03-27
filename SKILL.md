---
name: "siyuan-skill"
description: "思源笔记CLI工具，支持笔记本管理、文档操作、内容搜索、块控制。当用户操作思源笔记、管理笔记本、创建/更新/删除文档、搜索内容、管理块时调用。"
---

> **运行要求：** Node.js >= 14.0.0，思源笔记 >= 3.6.0
> 
> **安装：** Git 克隆到 AI 工具的 skills 目录，详见 [安装配置指南](references/config/setup.md)
> 
> **环境变量：** 参考 [环境变量文档](references/config/environment.md)

---

# 重要约束

- **必须使用 CLI 命令操作思源笔记**
- **禁止自动修改配置文件和环境变量**

---

# 快速开始

```bash
cd skills/siyuan-skill
node siyuan.js <command> [options]
siyuan help <command>  # 查看命令帮助
siyuan --version       # 显示版本信息
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
# ✅ 推荐：思源特有链接格式
((docId '标题'))

# 示例
((20260304051123-doaxgi4 '我的文档'))

# ❌ 不推荐：标准 Markdown 链接
[我的文档](20260304051123-doaxgi4)
```

### SQL 嵌入块

```markdown
# 动态查询嵌入
{{ SELECT * FROM blocks WHERE type = 'd' ORDER BY updated DESC LIMIT 5 }}
```

> 📋 详细规范见 [最佳实践文档](references/advanced/best-practices.md)

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

> 📋 详细安全配置见 [配置文档](references/config/advanced.md)

---

# 参考文档

- [安装配置指南](references/config/setup.md)
- [环境变量配置](references/config/environment.md)
- [命令详细文档](references/commands/)
- [高级功能](references/advanced/)
- [使用指南（书写规范、故障排除）](references/advanced/usage-guide.md)
- [思源笔记 API](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)

---

# 更新

```bash
cd <skills-directory>/siyuan-skill
git pull origin main
node siyuan.js help  # 验证
```
