---
name: "siyuan-skill"
version: "1.6.0"
description: "思源笔记命令行工具，提供便捷的命令行操作方式，支持笔记本管理、文档操作、内容搜索、块控制等功能"
---
# 核心价值

**提供 AI Agent 可快速接入思源笔记的 skill 方案**

## 适用场景
✅ 团队规范、项目知识、可复用技能
✅ 需要多 Agent 共享的知识
✅ 需要长期存储和检索的内容

## 不适用场景
❌ 日常互动记录、个人学习反思
❌ 临时笔记、代码版本管理
❌ 实时协作编辑

---

# 重要约束

**必须使用 CLI 命令来操作思源笔记** 

**禁止自动修改配置文件与本技能相关环境变量配置** 

**禁止直接调用 API** 

**禁止使用脚本调用、引用 index.js** 

**禁止使用脚本调用、引用指令文件** 

**遇到问题优先查阅文档，禁止直接读取源码**

---

# 问题导向文档导航

> ⚠️ **重要**：遇到以下问题时，请直接查阅对应文档，不要读取源码

| 问题类型 | 查阅文档 | 说明 |
|----------|----------|------|
| 如何获取笔记本列表 | [doc/commands/notebooks.md](doc/commands/notebooks.md) | 笔记本列表命令 |
| 如何获取文档结构 | [doc/commands/structure.md](doc/commands/structure.md) | 文档结构命令 |
| 如何获取文档内容 | [doc/commands/content.md](doc/commands/content.md) | 文档内容命令 |
| 如何创建文档 | [doc/commands/create.md](doc/commands/create.md) | 创建命令详解 |
| 如何更新文档 | [doc/commands/update.md](doc/commands/update.md) | 更新命令详解 |
| 如何删除文档 | [doc/commands/delete.md](doc/commands/delete.md) | 删除命令详解 |
| 删除被阻止 | [doc/advanced/delete-protection.md](doc/advanced/delete-protection.md) | 删除保护机制 |
| 如何保护文档 | [doc/commands/protect.md](doc/commands/protect.md) | 文档保护命令 |
| 如何移动文档 | [doc/commands/move.md](doc/commands/move.md) | 移动文档命令 |
| 如何重命名文档 | [doc/commands/rename.md](doc/commands/rename.md) | 重命名文档命令 |
| 如何搜索内容 | [doc/commands/search.md](doc/commands/search.md) | 搜索命令详解 |
| 搜索结果不准确 | [doc/advanced/vector-search.md](doc/advanced/vector-search.md) | 向量搜索配置 |
| 如何设置标签 | [doc/commands/tags.md](doc/commands/tags.md) | 标签命令详解 |
| 块操作问题 | [doc/commands/block-control.md](doc/commands/block-control.md) | 块控制命令详解 |
| 如何转换ID和路径 | [doc/commands/convert.md](doc/commands/convert.md) | ID/路径转换命令 |
| 如何索引文档 | [doc/commands/index.md](doc/commands/index.md) | 索引命令详解 |
| 如何使用NLP分析 | [doc/commands/nlp.md](doc/commands/nlp.md) | NLP分析命令 |
| 配置环境变量 | [doc/config/environment.md](doc/config/environment.md) | 环境变量配置 |
| 高级配置 | [doc/config/advanced.md](doc/config/advanced.md) | 详细配置选项 |
| 使用最佳实践 | [doc/advanced/best-practices.md](doc/advanced/best-practices.md) | 最佳实践指南 |
| 命令参数说明 | `siyuan help <command>` | CLI 帮助命令 |

---

# 快速开始

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

## 查看帮助

```bash
# 查看所有可用命令
siyuan help

# 查看特定命令帮助
siyuan help <command>
```

---

# 命令列表

**常用命令**：
| 命令 | 别名 | 说明 |
|------|------|------|
| `notebooks` | `nb` | 获取笔记本列表 |
| `structure` | `ls` | 获取文档结构 |
| `content` | `cat` | 获取文档内容 |
| `create` | `new` | 创建文档 |
| `update` | `edit`, `bu` | 更新文档/块内容 |
| `delete` | `rm` | 删除文档（受保护） |
| `protect` | - | 设置/移除文档保护 |
| `move` | `mv` | 移动文档 |
| `rename` | - | 重命名文档 |
| `search` | `find` | 搜索内容 |
| `convert` | `path` | 转换 ID 和路径 |
| `index` | - | 索引到向量数据库 |
| `nlp` | - | NLP 文本分析 [实验性] |
| `block-attrs` | `ba`, `attrs` | 设置块/文档属性 |
| `tags` | `st` | 设置块/文档标签 |

**块控制命令**：
| 命令 | 别名 | 说明 |
|------|------|------|
| `block-insert` | `bi` | 插入块 |
| `block-update` | `bu` | 更新块（同 `update`） |
| `block-delete` | `bd` | 删除块 |
| `block-move` | `bm` | 移动块 |
| `block-get` | `bg` | 获取块信息 |
| `block-fold` | `bf`, `buu` | 折叠/展开块 |
| `block-transfer-ref` | `btr` | 转移块引用 |

---

# 删除保护

**默认禁止删除**，需在 `config.json` 中配置：

```json
{
  "deleteProtection": {
    "safeMode": false,
    "requireConfirmation": true
  }
}
```

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `safeMode` | `true` | 禁止所有删除 |
| `requireConfirmation` | `false` | 删除需确认标题 |

**保护层级**：全局安全模式 → 文档保护标记 → 删除确认机制

---

# 更新方式选择

| 场景 | 推荐方式 |
|------|----------|
| 创建/重写文档 | `edit` 全文档更新 |
| 局部修改 | `bu` 块更新 ✅ |
| 保留块属性 | `bu` 块更新 ✅ |

**注意**：文档本身也是一种块，`edit` 和 `bu` 本质调用相同 API。

---

# 内容修改最佳实践

## 修改内容时使用修改命令

**推荐做法**：使用 `update` 或 `bu` 命令直接修改内容

```bash
# ✅ 推荐：直接更新文档内容
siyuan update <docId> "新内容"

# ✅ 推荐：更新块内容
siyuan bu <blockId> "新内容"

# ❌ 不推荐：删除再新建（会丢失属性、引用关系等）
siyuan delete <docId>
siyuan create "标题" "内容"
```

**原因**：
- 删除再新建会丢失文档属性、标签、保护标记
- 删除再新建会破坏其他文档对该文档的引用关系
- 修改命令保留所有元数据

## 不要在文档中附加 Front Matter

**推荐做法**：使用 `block-attrs` 命令设置文档属性

```bash
# ✅ 推荐：设置文档属性
siyuan ba <docId> --attrs "status=published,priority=high"

# ✅ 推荐：设置文档标签
siyuan st <docId> --tags "重要,待审核"

# ❌ 不推荐：在内容中添加 Front Matter
siyuan update <docId> "---\ntitle: 标题\nstatus: published\n---\n内容"
```

**原因**：
- 思源笔记中的 Front Matter 只是普通文本，不会被解析为属性
- 使用 `block-attrs` 设置的属性可被搜索、筛选
- 属性与内容分离，更易管理

## 文档内容规范

### 文档格式说明

**写入格式**：创建/更新文档使用 Markdown 格式

API 的 `dataType` 参数只支持 `markdown` 和 `dom` 两种类型，**不支持 kramdown 作为写入格式**。

### ⚠️ 换行符使用说明

**重要**：Markdown 语法要求标题、列表等块级元素前必须有空行才能正确解析。

在命令行中传入多段内容时，**必须使用 `\n` 显式换行**：

```bash
# ❌ 错误 - 所有内容在一行，标题不会被正确解析
siyuan create "标题" "第一段内容。## 二级标题 标题下的内容"

# ✅ 正确 - 使用 \n 换行，标题正确解析为独立块
siyuan create "标题" "第一段内容。\n\n## 二级标题\n标题下的内容"

# ✅ 完整示例 - 多段落、多级标题
siyuan create "文档" "概述内容。\n\n## 第一章\n第一章内容。\n\n## 第二章\n第二章内容。\n\n### 2.1 小节\n小节内容。"
```

**常见格式对应的换行符**：

| 格式 | 换行符 | 示例 |
|------|--------|------|
| 段落分隔 | `\n\n` | `段落1\n\n段落2` |
| 二级标题 | `\n\n## ` | `内容\n\n## 标题\n内容` |
| 三级标题 | `\n\n### ` | `内容\n\n### 标题\n内容` |
| 列表项 | `\n- ` | `列表项1\n- 列表项2` |

```bash
# 创建文档 - 使用 Markdown 格式
siyuan create "标题" "正文内容\n\n**粗体** *斜体*\n\n- 列表项1\n- 列表项2"

# 更新文档 - 使用 Markdown 格式
siyuan update <docId> "更新后的内容"
```

**读取格式**：获取文档内容时可选择格式

| 格式 | 用途 | 说明 |
|------|------|------|
| `markdown` | 写入/读取 | 标准 Markdown，API `dataType` 支持此格式 |
| `dom` | 写入/读取 | HTML 格式，API `dataType` 支持此格式 |
| `kramdown` | 仅读取 | 带 ID 和属性的 Markdown，通过 `/api/block/getBlockKramdown` API 获取 |

**kramdown 格式说明**（仅用于读取）：

kramdown 是思源笔记内部格式，通过专门的 API `/api/block/getBlockKramdown` 获取，格式示例：

```kramdown
正文内容
{: id="block-id" updated="20260312142019"}

{: id="doc-id" title="文档标题" type="doc" updated="20260312142019"}
```

特点：
- 每个块后面跟着 `{: key="value"}` 形式的属性
- 最后一行是文档块本身的属性
- **kramdown 格式只能读取，不能用于写入**

**在 Markdown 中使用属性语法**（高级用法）：

虽然 `dataType` 不支持 kramdown，但可以在 Markdown 内容中使用 `{: key="value"}` 语法设置块样式或自定义属性：

```bash
# 设置行内样式（API 文档示例）
siyuan update <docId> "foo**bar**{: style=\"color: var(--b3-font-color8);\"}baz"

# 设置自定义属性
siyuan update <docId> "段落内容{: custom-attr=\"custom-value\"}"
```

### 文档内容不应包含标题

**推荐做法**：内容直接从正文开始，标题通过 `title` 属性或创建命令指定

```bash
# ✅ 推荐：创建时指定标题，内容从正文开始
siyuan create "文档标题" "正文内容第一行\n正文内容第二行"

# ✅ 推荐：更新时内容不含标题
siyuan update <docId> "正文内容"

# ❌ 不推荐：内容中包含标题
siyuan create "文档标题" "# 文档标题\n正文内容"
```

**原因**：
- 文档标题已通过 `title` 属性存储，重复写入会造成冗余
- 标题在文档列表、搜索结果中自动显示
- 内容中的标题会与文档标题重复显示

### 文档包含下级文档时不等于文档为空

**注意**：判断文档是否为空时，不能仅检查内容长度

```bash
# 获取文档结构
siyuan ls <notebookId>

# 文档可能有以下情况：
# 1. 有内容，无下级文档 → 内容文档
# 2. 无内容，有下级文档 → 容器文档（目录）
# 3. 有内容，有下级文档 → 混合文档
# 4. 无内容，无下级文档 → 空文档
```

**原因**：
- 思源笔记支持树形文档结构，文档可作为容器（目录）
- 容器文档本身内容为空，但包含多个下级文档
- 删除容器文档会同时删除所有下级文档

## 文档属性

### 系统默认属性（自动维护，只读）

| 属性名 | 说明 | 示例值 |
|--------|------|--------|
| `id` | 文档/块ID | `20260312142019-fr21e3o` |
| `title` | 文档标题 | `测试文档` |
| `type` | 类型 | `doc`（文档） |
| `updated` | 更新时间 | `20260312142019` |

### 常用自定义属性（建议使用）

| 属性名 | 说明 | 示例值 |
|--------|------|--------|
| `status` | 文档状态 | `draft`, `published`, `archived` |
| `priority` | 优先级 | `high`, `medium`, `low` |
| `tags` | 标签（用 tags 命令） | `重要,待审核` |
| `author` | 作者 | `张三` |
| `version` | 版本 | `1.0.0` |

**重要说明**：
- 默认情况下，属性会自动添加 `custom-` 前缀（在思源笔记界面可见）
- 使用 `--hide` 标记可以设置隐藏属性（不带 `custom-` 前缀）

**设置示例**：

```bash
# 设置可见属性（自动添加 custom- 前缀）
siyuan attrs <docId> --set "status=draft,priority=high,author=张三"

# 设置隐藏属性（不带 custom- 前缀）
siyuan attrs <docId> --set "internal=true" --hide

# 获取属性（自动移除 custom- 前缀显示）
siyuan attrs <docId> --get

# 获取指定属性
siyuan attrs <docId> --get "status"

# 获取隐藏属性
siyuan attrs <docId> --get "internal" --hide
```

---

# 注意事项

1. **权限模式**：`all` / `whitelist` / `blacklist`
2. **缓存**：使用 `--force-refresh` 强制刷新
3. **向量搜索**：需部署 Qdrant + Ollama，否则回退 SQL 搜索

---

# 参考文档

- [思源笔记 API 文档](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)
- [思源笔记用户指南](https://github.com/siyuan-note/siyuan/blob/master/README_zh_CN.md)
- [命令详细文档](doc/commands/)
- [高级功能文档](doc/advanced/)
- [配置文档](doc/config/)
