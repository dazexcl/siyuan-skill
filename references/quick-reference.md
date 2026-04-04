# 快速参考

## 命令决策表

### 我要做什么？

| 意图 | 脚本 | 示例 |
|------|------|------|
| 查看笔记本列表 | `notebooks.js` | `node scripts/notebooks.js` |
| 查看文档结构 | `structure.js` | `node scripts/structure.js <notebookId>` |
| 读取文档内容 | `content.js` | `node scripts/content.js <docId>` |
| 获取文档信息 | `info.js` | `node scripts/info.js <docId>` |
| 创建文档 | `create.js` | `node scripts/create.js "标题" --parent-id <parentId>` |
| 修改文档全文 | `update.js` | `node scripts/update.js <docId> --content "新内容"` |
| 删除文档 | `delete.js` | `node scripts/delete.js <docId>` |
| 移动文档 | `move.js` | `node scripts/move.js <docId> --target <targetId>` |
| 重命名文档 | `rename.js` | `node scripts/rename.js <docId> "新标题"` |
| 保护/取消保护 | `protect.js` | `node scripts/protect.js <docId>` |
| 检查文档存在 | `exists.js` | `node scripts/exists.js --title "标题"` |
| ID↔路径转换 | `convert.js` | `node scripts/convert.js --path "/笔记本/文档"` |
| 设置图标 | `icon.js` | `node scripts/icon.js <docId> 1f4cb` |
| 设置属性 | `block-attrs.js` | `node scripts/block-attrs.js <id> --set "key=value"` |
| 管理标签 | `tags.js` | `node scripts/tags.js <id> --add "标签1,标签2"` |
| 搜索内容 | `search.js` | `node scripts/search.js "关键词"` |
| 向量索引 | `index-docs.js` | `node scripts/index-docs.js --notebook <id>` |
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
| `content` / `info` | **文档 ID** | |
| `block-get` | **块 ID** | |

## 常见错误预防

| 错误场景 | 错误做法 | 正确做法 |
|----------|----------|----------|
| 文档已存在 | 直接 create | 先 `exists.js` 检查，再 `--force` |
| 删除被阻止 | 反复尝试 | 告知用户修改配置或用 `protect.js --remove` |
| ID 类型混淆 | `update.js` 用块ID | `update.js` 只用文档ID，`block-update.js` 只用块ID |
| 修改部分内容 | 删了重建 | 用 `block-update.js` 或 `block-delete.js` 进行块级操作 |
| 格式化问题 | 所有内容一行 | 用 `\n` 换行 |

## 标准工作流

### 创建文档
```
exists.js --title "标题" → 不存在 → create.js "标题" --parent-id <id>
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
