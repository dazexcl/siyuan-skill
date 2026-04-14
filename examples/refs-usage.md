# refs 命令使用指南

## 概述

`refs` 命令用于查询引用了指定文档/块的所有笔记（反链检索）。通过该命令，你可以了解哪些文档引用了某个特定的文档或块。

## 用法

```bash
node {baseDir}/scripts/refs.js <docId> [选项]
```

### 参数

- `<docId>`: 目标文档/块的ID

### 选项

- `-l, --limit <num>`: 返回结果数量限制（默认: 20）
- `-n, --notebook-id <id>`: 限定笔记本ID
- `-h, --help`: 显示帮助信息

## 示例

### 基本用法

```bash
# 查询引用了指定文档的所有笔记
node scripts/refs.js 20260306005621-033fgnz

# 输出：
{
  "success": true,
  "data": {
    "blocks": [
      {
        "id": "20260414203308-uqd7f23",
        "content": "API文档",
        "type": "p",
        "rootId": "20260410031926-ktdfkek",
        "hpath": "/test",
        "notebookId": "20260227231831-yq1lxq2",
        "refMarkdown": "((20260306005621-033fgnz 'API文档'))",
        "defBlockId": "20260306005621-033fgnz",
        "updated": "20260414203308"
      },
      {
        "id": "20260414204741-2vcpel1",
        "content": "规范",
        "type": "p",
        "rootId": "20260410031926-ktdfkek",
        "hpath": "/test",
        "notebookId": "20260227231831-yq1lxq2",
        "refMarkdown": "((20260306005621-p874aru '规范'))",
        "defBlockId": "20260306005621-p874aru",
        "updated": "20260414204829"
      }
    ]
  },
  "query": {
    "docId": "20260306005621-033fgnz",
    "mode": "references",
    "limit": 20
  },
  "total": 2
}
```

### 限制返回数量

```bash
# 只返回前 10 条引用记录
node scripts/refs.js 20260306005621-033fgnz --limit 10

# 或使用简写
node scripts/refs.js 20260306005621-033fgnz -l 10
```

### 限定笔记本

```bash
# 只查询指定笔记本中的引用
node scripts/refs.js 20260306005621-033fgnz --notebook-id 20260227231831-yq1lxq2

# 或使用简写
node scripts/refs.js 20260306005621-033fgnz -n 20260227231831-yq1lxq2
```

### 查询文档引用

```bash
# 查询哪些文档引用了某个文档
node scripts/refs.js 20260410031926-ktdfkek

# 这会返回所有引用了该文档（或文档中的块）的笔记
```

## 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `success` | boolean | 执行是否成功 |
| `data.blocks` | array | 引用块列表 |
| `data.blocks[].id` | string | 引用块的ID |
| `data.blocks[].content` | string | 引用块的内容 |
| `data.blocks[].type` | string | 块类型（d=文档, p=段落, h=标题等） |
| `data.blocks[].rootId` | string | 引用内容所在文档的ID |
| `data.blocks[].hpath` | string | 人类可读路径 |
| `data.blocks[].notebookId` | string | 所在笔记本的ID |
| `data.blocks[].refMarkdown` | string | Markdown格式的引用 |
| `data.blocks[].defBlockId` | string | 被引用文档/块的ID |
| `data.blocks[].updated` | string | 更新时间 |
| `query.docId` | string | 查询的目标文档/块ID |
| `query.mode` | string | 查询模式（固定为 "references"） |
| `query.limit` | number | 返回结果限制 |
| `total` | number | 引用总数 |

## 类型代码

思源笔记的块类型代码：

| 代码 | 类型 | 说明 |
|------|------|------|
| `d` | Document | 文档块 |
| `h` | Heading | 标题块 |
| `p` | Paragraph | 段落块 |
| `l` | List | 列表块 |
| `i` | List Item | 列表项 |
| `b` | Blockquote | 引用块 |
| `s` | Super Block | 超级块 |
| `c` | Code Block | 代码块 |
| `t` | Table | 表格 |
| `m` | Math Block | 数学公式块 |

## 引用格式

思源笔记支持多种引用格式，`refMarkdown` 字段会返回完整的引用语法：

- **块引用**: `((block-id '引用文本'))`
- **嵌入块**: `{{block-id}}`
- **文档引用**: `((doc-id '文档标题'))`

## 权限说明

- `refs` 命令会检查笔记本权限
- 当 `permissionMode` 为 `whitelist` 时，只返回白名单笔记本中的引用
- 当 `permissionMode` 为 `blacklist` 时，不返回黑名单笔记本中的引用
- 当 `permissionMode` 为 `all` 时，返回所有笔记本中的引用
- 详见 [安全文档](../references/advanced/security.md)

## API 调用

`refs` 命令会调用以下 API：

1. `/api/query/sql` - 查询 `refs` 表获取引用关系
2. `/api/query/sql` - JOIN `blocks` 表获取引用块的详细信息

## SQL 查询逻辑

`refs` 命令使用以下 SQL 查询获取引用关系：

```sql
SELECT 
  r.id as ref_id,
  r.block_id,
  r.root_id,
  r.box,
  r.path,
  r.content as ref_content,
  r.markdown as ref_markdown,
  r.type as ref_type,
  r.def_block_id,
  r.def_block_parent_id,
  r.def_block_root_id,
  r.def_block_path,
  b.id,
  b.content,
  b.type,
  b.subtype,
  b.updated,
  b.created,
  b.hpath,
  b.name
FROM refs r
LEFT JOIN blocks b ON r.block_id = b.id
WHERE (r.def_block_id = '<targetId>' OR r.def_block_root_id = '<targetId>')
  AND r.box IN ('<whitelist_notebooks>')
LIMIT <limit>
```

## 错误处理

### 无效 ID

```bash
node scripts/refs.js invalid_id

# 输出：
{
  "success": true,
  "data": {
    "blocks": []
  },
  "query": {
    "docId": "invalid_id",
    "mode": "references",
    "limit": 20
  },
  "total": 0,
  "error": "无效的目标ID"
}
```

### 无引用

```bash
# 如果没有被引用，返回空数组
node scripts/refs.js 20260101000000-xxxxxxx

# 输出：
{
  "success": true,
  "data": {
    "blocks": []
  },
  "query": {
    "docId": "20260101000000-xxxxxxx",
    "mode": "references",
    "limit": 20
  },
  "total": 0
}
```

### 权限过滤

```bash
# 如果使用白名单模式，只返回白名单笔记本中的引用
node scripts/refs.js 20260306005621-033fgnz

# 输出只包含白名单笔记本中的引用
```

## 与其他命令的区别

| 命令 | 职责 | 返回内容 |
|------|------|----------|
| `search` | 搜索关键词 | 包含关键词的文档/块 |
| `refs` | 查询引用关系 | 引用了指定文档/块的所有笔记 |
| `info` | 获取基础信息 | 文档/块的元数据 |

## 使用场景

### 1. 查找引用某个文档的所有笔记

```bash
# 了解哪些文档引用了某个重要的文档
node scripts/refs.js 20260306005621-033fgnz
```

### 2. 检查文档的依赖关系

```bash
# 在删除或移动文档前，检查哪些文档引用了它
node scripts/refs.js <document-id>
```

### 3. 构建知识图谱

```bash
# 通过查询引用关系，构建文档之间的关联图谱
node scripts/refs.js <document-id> --limit 100
```

### 4. 内容审计

```bash
# 审计某个概念在笔记中的使用情况
node scripts/refs.js <concept-block-id>
```

## 注意事项

1. `refs` 命令只返回直接引用，不返回间接引用
2. 引用结果按更新时间降序排列（最新的在前）
3. 如果引用的块已被删除，某些字段可能为空
4. `rootId` 字段可以帮助你定位引用内容所属的文档
5. 使用 `--notebook-id` 可以进一步缩小查询范围
6. 权限配置会影响返回结果，确保配置正确

## 性能说明

- `refs` 命令使用 SQL 直接查询 `refs` 表，性能较好
- 默认限制返回 20 条结果，可以通过 `--limit` 调整
- 大量引用时建议使用 `--limit` 控制返回数量
- 索引会自动按 `updated` 字段排序

## 相关文档

- [搜索使用指南](./search-usage.md)
- [信息查询指南](./info-usage.md)
- [安全文档](../references/advanced/security.md)
- [配置指南](../references/config/setup.md)
