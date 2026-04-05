# 基础用法示例

## 查看笔记本

```bash
node scripts/notebooks.js
```

## 浏览文档结构

```bash
node scripts/structure.js <notebookId>
node scripts/structure.js <notebookId> --depth 2
node scripts/structure.js --path "/笔记本名/目录"
```

## 读取文档

```bash
node scripts/content.js <docId>
node scripts/content.js <docId> --format markdown
node scripts/content.js --path "/笔记本/文档路径"
```

## 创建文档

```bash
# 在指定父文档下创建
node scripts/create.js "新文档" --parent-id <parentId>

# 带内容创建
node scripts/create.js "新文档" --content "文档内容" --parent-id <parentId>

# 使用路径创建
node scripts/create.js --path "/笔记本/目录/文档名" --content "内容"

# 从文件读取内容
node scripts/create.js "文档" --file content.md --parent-id <parentId>

# 强制创建同名文档
node scripts/create.js "文档" --parent-id <id> --force
```

## 修改文档

```bash
# 全文替换
node scripts/update.js <docId> --content "完整的新内容"

# 从文件读取内容
node scripts/update.js <docId> --file content.md

# 修改单个块
node scripts/block-update.js <blockId> --content "新的块内容"
```

## 搜索

```bash
# 基础搜索
node scripts/search.js "关键词"

# 限定搜索范围
node scripts/search.js "关键词" --notebook <id> --limit 5

# 指定搜索模式
node scripts/search.js "关键词" --mode keyword
node scripts/search.js "关键词" --mode hybrid
node scripts/search.js "关键词" --mode semantic
```

## 标签和属性

```bash
# 添加标签
node scripts/tags.js <docId> --add "重要,技术"

# 获取标签
node scripts/tags.js <docId> --get

# 设置自定义属性
node scripts/block-attrs.js <docId> --set "status=published"
```
