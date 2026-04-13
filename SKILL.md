---
name: "siyuan-skill"
description: "思源笔记工具，支持笔记本管理、文档操作、内容搜索、块控制。当用户操作思源笔记、管理笔记本、创建/更新/删除文档、搜索内容、管理块时调用。"
skillType: "cli"
homepage: "https://github.com/dazexcl/siyuan-skill"
metadata: {"openclaw":{"emoji":"📝","requires":{"bins":["node"],"env":["SIYUAN_BASE_URL","SIYUAN_TOKEN"],"optionalEnv":["SIYUAN_TIMEOUT","SIYUAN_PERMISSION_MODE","SIYUAN_NOTEBOOK_LIST","QDRANT_URL","QDRANT_API_KEY","QDRANT_COLLECTION_NAME","OLLAMA_BASE_URL","EMBEDDING_MODEL","EMBEDDING_DIMENSION","SIYUAN_DELETE_SAFE_MODE","SIYUAN_DELETE_REQUIRE_CONFIRMATION","SIYUAN_TLS_ALLOW_SELF_SIGNED"]},"primaryEnv":"SIYUAN_TOKEN"}}
---

> **运行要求:** Node.js >= 14.0.0, 思源笔记 >= 3.6.0
> **安装:** 从 [ClawHub](https://clawhub.ai/dazexcl/siyuan-skill) 下载

## 快速开始

```bash
node {baseDir}/scripts/<command>.js [options]
node {baseDir}/scripts/<command>.js --help  # 查看命令帮助
```

## 场景化快速开始

> 💡 根据你的任务场景，快速找到对应的命令和工作流

### 我要...

| 场景 | 核心命令 | 详细文档 |
|------|---------|---------|
| **创建新文档** | `create.js` | [文档工作流示例](examples/document-workflow.md#场景创建并编辑一个项目文档) |
| **更新文档内容** | `update.js` / `block-update.js` | [基础用法示例](examples/basic-usage.md#修改文档) |
| **搜索内容** | `search.js` | [向量搜索配置](references/advanced/vector-search.md) |
| **删除文档** | `delete.js` | [删除保护文档](references/advanced/delete-protection.md) ⚠️ |
| **批量操作** | `search.js` + 其他命令 | [批量整理文档](examples/document-workflow.md#场景批量整理文档) |
| **使用语义搜索** | `search.js --mode semantic` | [向量搜索文档](references/advanced/vector-search.md) |
| **遇到权限问题** | - | [配置说明](references/config/setup.md#权限配置) |
| **遇到删除问题** | - | [删除保护文档](references/advanced/delete-protection.md) |
| **遇到搜索问题** | - | [向量搜索配置](references/advanced/vector-search.md#常见问题) |
| **写入内容格式错误** | - | [格式标准](references/format-standard.md) |

> 📋 更多场景：[troubleshooting.md](references/troubleshooting.md)

## 命令列表

### 笔记本/文档操作

| 脚本 | 说明 | 示例 |
|------|------|------|
| `notebooks` | 列出笔记本 | `node {baseDir}/scripts/notebooks.js` |
| `structure` | 查看文档结构 | `node {baseDir}/scripts/structure.js <notebookId|docId>` |
| `content` | 获取文档内容 | `node {baseDir}/scripts/content.js <docId>` |
| `info` | 获取文档/块信息 | `node {baseDir}/scripts/info.js <docId> [--raw]` |
| `create` | 创建文档 | `node {baseDir}/scripts/create.js <title> --parent-id <id>` 或 `--path <path>` |
| `update` | 更新文档 | `node {baseDir}/scripts/update.js <docId> --content <md>` |
| `delete` | 删除文档 | `node {baseDir}/scripts/delete.js <docId>` |
| `move` | 移动文档 | `node {baseDir}/scripts/move.js <docId|path> --target <notebookId|path>` |
| `rename` | 重命名文档 | `node {baseDir}/scripts/rename.js <docId> <title>` |
| `protect` | 保护/取消保护 | `node {baseDir}/scripts/protect.js <docId>` |
| `exists` | 检查文档存在 | `node {baseDir}/scripts/exists.js --title <title>` |
| `convert` | ID与路径转换 | `node {baseDir}/scripts/convert.js --id <id>` |
| `icon` | 设置/获取图标 | `node {baseDir}/scripts/icon.js <id> [emoji]` 或 `--remove` |

### 块操作

| 脚本 | 说明 | 示例 |
|------|------|------|
| `block-get` | 获取块信息 | `node {baseDir}/scripts/block-get.js <blockId>` |
| `block-insert` | 插入块 | `node {baseDir}/scripts/block-insert.js "内容" --parent-id <id>` |
| `block-update` | 更新块 | `node {baseDir}/scripts/block-update.js <blockId> --content <md>` |
| `block-delete` | 删除块 | `node {baseDir}/scripts/block-delete.js <blockId>` |
| `block-move` | 移动块 | `node {baseDir}/scripts/block-move.js <blockId> --parent-id <parentId>` |
| `block-fold` | 折叠/展开 | `node {baseDir}/scripts/block-fold.js <blockId> --action fold` |
| `block-transfer` | 转移引用 | `node {baseDir}/scripts/block-transfer.js <srcId> <tgtId>` |
| `block-attrs` | 块属性 | `node {baseDir}/scripts/block-attrs.js <blockId> --set key=value` |

### 搜索/索引

| 脚本 | 说明 | 示例 |
|------|------|------|
| `search` | 搜索内容 | `node {baseDir}/scripts/search.js <query> --mode keyword` |
| `tags` | 标签管理 | `node {baseDir}/scripts/tags.js <blockId> --add tag1,tag2` |
| `index` | 索引到向量库 | `node {baseDir}/scripts/index.js --notebook <id>` |
| `nlp` | NLP分析 | `node {baseDir}/scripts/nlp.js <text>` |

---

# 关键规则

## ID 区分

- **文档操作** (`update`/`delete`/`move`/`rename`) 接受**文档 ID**（部分命令也支持路径）
- **块操作** (`block-update`/`block-delete` 等) 只接受**块 ID**
- 混用会导致错误, 详见 [快速参考](references/quick-reference.md)

## 删除保护

- 默认禁止删除文档, 需用户手动在 config.json 中启用
- 保护层级: 全局安全模式 → 文档保护标记 → 删除确认机制
- Agent 禁止自动修改删除配置
- 详见 [安全文档](references/advanced/security.md)

## 权限验证

- 支持 `permissionMode`: `all`(默认) / `whitelist` / `blacklist`
- 写入操作 (create/update/delete/move 等) 会检查笔记本权限
- 通过 `SIYUAN_NOTEBOOK_LIST` 环境变量配置笔记本列表

## 格式规范（重要）

写入思源笔记时**必须**遵循以下格式：

| 场景 | 正确格式 | 错误格式 |
|------|---------|---------|
| 内部链接 | `((id "锚文本"))` | `[文本](id)` ❌ |
| 动态锚文本 | `((id '锚文本'))` | `((id 锚文本))` ❌ |
| 换行 | `\\n` | 直接换行 |
| 段落分隔 | `\\n\\n` | 单个 \\n |

> 📋 **完整规范**：[format-standard.md](references/format-standard.md) | **快速参考**：[quick-reference.md](references/quick-reference.md)

## 搜索模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `legacy` | SQL LIKE | 精确关键词 |
| `keyword` | BM25 + N-gram | 关键词匹配 |
| `semantic` | 语义向量 | 同义词、概念 |
| `hybrid` | 稠密+稀疏 | 综合搜索 |

向量搜索需配置 `QDRANT_URL` + `OLLAMA_BASE_URL`

---

# 标准工作流

```
创建: exists 检查 → create (或 --force)
修改: content 获取 → 判断范围 → update (全文) 或 block-update (单块)
搜索: search 查询 → content 查看 → update/block-update 修改
删除: protect 检查 → delete
```

> 📋 完整工作流示例见 [examples/basic-usage.md](examples/basic-usage.md)

---

# 参考文档

## 📋 必读文档

| 文档 | 用途 | 何时阅读 |
|------|------|---------|
| **SKILL.md** | 本文档，核心入口 | 首次使用必读 |
| **troubleshooting.md** | 问题解决索引 | 遇到问题时查阅 |
| **quick-reference.md** | 快速决策表 | 选择命令时查阅 |
| **format-standard.md** | 格式规范 | 写入内容前查阅 |

## 🔧 配置与权限

| 文档 | 用途 |
|------|------|
| [配置说明](references/config/setup.md) | 环境变量和 config.json 配置 |
| [高级配置](references/config/advanced.md) | 完整配置选项 |

## 🚀 进阶功能

| 文档 | 用途 |
|------|------|
| [向量搜索](references/advanced/vector-search.md) | 语义搜索配置和使用 |
| [删除保护](references/advanced/delete-protection.md) | 删除保护机制说明 |
| [最佳实践](references/advanced/best-practices.md) | 使用建议和技巧 |
| [安全文档](references/advanced/security.md) | 安全最佳实践 |

## 📖 示例文档

| 文档 | 用途 |
|------|------|
| [基础用法](examples/basic-usage.md) | 常用命令示例 |
| [文档工作流](examples/document-workflow.md) | 完整任务场景示例 |
| [块操作指南](examples/block-operations.md) | 块级操作详解 |

## 🎯 快速导航

- **遇到问题**：[troubleshooting.md](references/troubleshooting.md)
- **查看命令**：[quick-reference.md](references/quick-reference.md)
- **格式规范**：[format-standard.md](references/format-standard.md)
- **规范索引**：[spec-index.md](references/spec-index.md)

---

## 🔧 遇到问题？

如果在使用过程中遇到任何问题，请按以下步骤排查：

### 1. 查看错误信息

错误信息中通常会包含：
- 错误原因
- 解决方案提示
- 相关文档链接

### 2. 查阅问题解决索引

📋 **[troubleshooting.md](references/troubleshooting.md)** - 按错误信息和任务场景组织的完整问题索引

### 3. 查看快速参考

📋 **[quick-reference.md](references/quick-reference.md)** - 命令决策表和常见错误预防

### 4. 查看详细文档

| 问题类型 | 文档 |
|---------|------|
| 连接/权限 | [配置说明](references/config/setup.md) |
| 删除问题 | [删除保护文档](references/advanced/delete-protection.md) |
| 搜索问题 | [向量搜索文档](references/advanced/vector-search.md) |
| 格式问题 | [格式标准](references/format-standard.md) |

### 5. 查看示例

- [基础用法示例](examples/basic-usage.md)
- [文档工作流](examples/document-workflow.md)
- [块操作指南](examples/block-operations.md)

---

> 💡 **快速链接**：[规范索引](references/spec-index.md) | [问题解决索引](references/troubleshooting.md)

---
