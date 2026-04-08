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

### 使用 --parent-id 模式

```bash
# 在指定父文档下创建
node scripts/create.js "新文档" --parent-id <parentId>

# 带内容创建
node scripts/create.js "新文档" --content "文档内容" --parent-id <parentId>

# 从文件读取内容
node scripts/create.js "文档" --file content.md --parent-id <parentId>

# 强制创建同名文档
node scripts/create.js "文档" --parent-id <id> --force
```

### 使用 --path 路径模式

使用路径模式创建文档时，**路径首位必须是笔记本名称或ID**：

```bash
# ✓ 正确：路径首位是笔记本名称
node scripts/create.js --path "/AI/目录/文档名" --content "内容"

# ✓ 正确：路径首位是笔记本ID
node scripts/create.js --path "/20260227231831-yq1lxq2/目录/文档名" --content "内容"

# ✗ 错误：路径首位不是笔记本
node scripts/create.js --path "/SomeFolder/文档名" --content "内容"
# 报错：路径首部 "SomeFolder" 不是有效的笔记本名称或ID
```

**路径格式说明**：
- 路径以 `/` 开头
- 首位组件必须是有效的笔记本名称或ID
- 中间目录会自动创建
- 最后一个组件是文档标题
- 支持多级目录嵌套：`/笔记本/目录1/目录2/文档名`

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

# 启用重排
node scripts/search.js "关键词" --mode hybrid --enable-rerank

# 混合搜索权重调整
node scripts/search.js "关键词" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2
```

### 搜索结果结构

所有搜索返回统一格式的结果：

```javascript
{
  id: "文档ID",
  score: 0.6327913679999999,    // 顶层主要分数（方便访问）
  content: "完整内容",
  title: "文档标题",
  notebookId: "笔记本ID",
  path: "文档路径",
  type: "d",
  blockId: "块ID",
  source: "hybrid",              // 搜索来源：sql/vector/hybrid
  scores: {
    relevance: 0.015687263556116014,  // 相关性分数
    vector: 0.6327913679999999,       // 向量搜索分数（已组合）
    sql: 0.6,                         // SQL 搜索分数
    rerank: 0.88,                     // 重排分数
    final: 0.81                       // 最终综合分数
  }
}
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
