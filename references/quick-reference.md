# 快速参考

## 命令决策表

### 我要做什么？

| 意图 | 脚本 | 示例 |
|------|------|------|
| 查看笔记本列表 | `notebooks.js` | `node scripts/notebooks.js` |
| 查看文档结构 | `structure.js` | `node scripts/structure.js <notebookId>` |
| 读取文档内容 | `content.js` | `node scripts/content.js <docId>` |
| 获取文档/块信息 | `info.js` | `node scripts/info.js <id> [--raw]` |
| 创建文档 | `create.js` | `node scripts/create.js "标题" --parent-id <id>` 或 `--path <path>` |
| 修改文档全文 | `update.js` | `node scripts/update.js <docId> --content "新内容"` |
| 删除文档 | `delete.js` | `node scripts/delete.js <docId>` |
| 移动文档 | `move.js` | `node scripts/move.js <docId> --target <targetId>` |
| 重命名文档 | `rename.js` | `node scripts/rename.js <docId> "新标题"` |
| 保护/取消保护 | `protect.js` | `node scripts/protect.js <docId>` |
| 检查文档存在 | `exists.js` | `node scripts/exists.js --title "标题"` |
| ID↔路径转换 | `convert.js` | `node scripts/convert.js --id <id>` 或 `--path <path>` |
| 设置图标 | `icon.js` | `node scripts/icon.js <docId> 1f4cb` |
| 设置属性 | `block-attrs.js` | `node scripts/block-attrs.js <id> --set "key=value"` |
| 管理标签 | `tags.js` | `node scripts/tags.js <id> --add "标签1,标签2"` |
| 搜索内容 | `search.js` | `node scripts/search.js "关键词"` |
| 向量索引 | `index.js` | `node scripts/index.js --notebook <id>` |
| NLP 分析 | `nlp.js` | `node scripts/nlp.js "文本"` |
| 获取块信息 | `block-get.js` | `node scripts/block-get.js <blockId>` |
| 更新块内容 | `block-update.js` | `node scripts/block-update.js <blockId> --content "新内容"` |
| 插入块 | `block-insert.js` | `node scripts/block-insert.js "内容" --parent-id <id>` |
| 删除块 | `block-delete.js` | `node scripts/block-delete.js <blockId>` |
| 移动块 | `block-move.js` | `node scripts/block-move.js <blockId> --parent-id <id>` |
| 折叠/展开 | `block-fold.js` | `node scripts/block-fold.js <blockId> --action fold` |
| 转移引用 | `block-transfer.js` | `node scripts/block-transfer.js <srcId> <tgtId>` |

## ID 类型区分

| 操作 | 接受的 ID 类型 | 错误示例 |
|------|---------------|----------|
| `update` / `delete` / `move` / `rename` | **文档 ID** | ❌ `update.js <blockId>` |
| `block-update` / `block-delete` 等 | **块 ID** | ❌ `block-update.js <docId>` |
| `content` | **文档 ID** | ❌ `content.js <blockId>` |
| `info` | **文档 ID 或块 ID** | - |
| `block-get` | **块 ID** | ❌ `block-get.js <docId>` |

## 常见错误与解决

| 错误场景 | 错误做法 | 正确做法 | 如果已经错了怎么办？ |
|----------|----------|----------|---------------------|
| 文档已存在 | 直接 create | 先 `exists.js` 检查，再 `--force` | 使用 `update.js` 更新现有文档，或 `create.js --force` 强制创建 |
| 删除被阻止 | 反复尝试 | 告知用户修改配置或用 `protect.js --remove` | [查看删除保护文档](advanced/delete-protection.md) |
| ID 类型混淆 | `update.js` 用块ID | `update.js` 只用文档ID，`block-update.js` 只用块ID | [查看 ID 类型区分说明](#id-类型区分) |
| 修改部分内容 | 删了重建 | 用 `block-update.js` 或 `block-delete.js` 进行块级操作 | [查看块操作指南](../examples/block-operations.md) |
| 格式化问题 | 所有内容一行 | 用 `\\n` 换行 | [查看格式标准](format-standard.md) |
| 内部链接错误 | `[文本](id)` | `((id "文本"))` | [查看格式标准 - 引用语法](format-standard.md#引用语法) |

> 📋 更多问题：[troubleshooting.md](troubleshooting.md)

## 标准工作流

### 创建文档
```
exists.js --title "标题" → 不存在 → create.js "标题" --parent-id <id> 或 --path <path>
                         → 已存在 → 询问用户 → update.js <docId> --content "新内容" 或 create.js --force
```

### 修改文档
```
content.js <docId> → 判断范围 → update.js <docId> --content "全文" 或 block-update.js <blockId> --content "部分"
```

### 搜索修改
```
search.js "关键词" → content.js <docId> → update.js/block-update.js 修改
```

## 内容格式规范

> ⚠️ **写入内容前必查**：完整规范见 [format-standard.md](format-standard.md)

### 内部链接（最常出错）

| 格式 | 示例 | 说明 |
|------|------|------|
| 正确 | `((20200813004931-q4cu8na "什么是内容块"))` | 静态锚文本 |
| 正确 | `((20200813004931-q4cu8na '什么是内容块'))` | 动态锚文本（跟随原文变化） |
| 错误 | `[什么是内容块](20200813004931-q4cu8na)` | ❌ 不要用 Markdown 链接 |
| 错误 | `((20200813004931-q4cu8na 什么是内容块))` | ❌ 锚文本必须用引号 |

### 基础排版

| 元素 | 格式 | 示例 |
|------|------|------|
| 换行 | `\\n` | `第一行\\n第二行` |
| 段落 | `\\n\\n` | `第一段\\n\\n第二段` |
| 标题 | `## ~######` | `## 二级标题` |
| 代码块 | \\`\\`\\`语言 | \\`\\`\\`javascript ... \\`\\`\\` |

> 📋 更多格式：[format-standard.md](format-standard.md) | [规范索引](spec-index.md)
