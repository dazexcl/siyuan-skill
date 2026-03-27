# 获取文档信息命令

获取思源笔记文档的基础信息，包括ID、标题、路径、属性和标签。

## 命令格式

```bash
siyuan info <docId> [options]
```

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<docId>` | string | ✅ | 文档 ID（位置参数） |
| `--id <id>` | string | ❌ | 文档 ID（等同于位置参数） |
| `--format <format>` | string | ❌ | 输出格式：summary（默认）、json |

## 使用示例

### 基本用法

```bash
# 获取文档信息（摘要格式）
siyuan info <docId>

# 使用 --id 参数
siyuan info --id <docId>
```

### 完整信息输出

```bash
# 获取完整信息（JSON格式）
siyuan info <docId> --format json
```

## 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 文档 ID |
| `title` | string | 文档标题 |
| `type` | string | 块类型（`doc` 为文档块） |
| `notebook` | object | 所属笔记本信息 |
| `notebook.id` | string | 笔记本 ID |
| `notebook.name` | string | 笔记本名称 |
| `path` | string | 人类可读路径 |
| `attributes` | object | 自定义属性（已去除 `custom-` 前缀） |
| `tags` | array | 标签数组 |
| `created` | string | 创建时间戳 |
| `updated` | string | 更新时间戳 |

## 返回格式

### summary 格式（默认）

```json
{
  "success": true,
  "data": {
    "id": "20260306044633-u0n0uj4",
    "title": "文档标题",
    "type": "doc",
    "notebook": {
      "id": "20260227231831-yq1lxq2",
      "name": "AI"
    },
    "path": "/AI/目录/文档标题",
    "attributes": {
      "status": "draft",
      "priority": "high"
    },
    "tags": ["标签1", "标签2"],
    "created": "20260306044633",
    "updated": "20260312185840"
  },
  "message": "文档信息获取成功"
}
```

### json 格式

包含更详细的路径信息和原始属性：

```json
{
  "success": true,
  "data": {
    "id": "20260306044633-u0n0uj4",
    "title": "文档标题",
    "type": "doc",
    "notebook": {
      "id": "20260227231831-yq1lxq2",
      "name": "AI"
    },
    "path": {
      "humanReadable": "/AI/目录/文档标题",
      "storage": "/20260306044555-2m5b94y/20260306044633-u0n0uj4.sy",
      "hpath": "/目录/文档标题"
    },
    "attributes": {
      "status": "draft"
    },
    "tags": ["标签1"],
    "rawAttributes": {
      "id": "20260306044633-u0n0uj4",
      "title": "文档标题",
      "type": "doc",
      "custom-status": "draft",
      "updated": "20260312185840"
    },
    "updated": "20260312185840",
    "created": "20260306044633"
  },
  "message": "文档信息获取成功"
}
```

**两种格式区别**：

| 字段 | summary | json |
|------|---------|------|
| `path` | 字符串 | 对象（含 storage、hpath） |
| `rawAttributes` | ❌ 无 | ✅ 原始属性（带 custom- 前缀） |

## 错误处理

### 传入笔记本 ID

```json
{
  "success": false,
  "error": "参数类型错误",
  "message": "\"20260227231831-yq1lxq2\" 是笔记本ID，不是文档ID。info 命令仅支持文档ID。",
  "hint": "笔记本名称: AI",
  "reason": "wrong_id_type"
}
```

### 文档不存在

```json
{
  "success": false,
  "error": "文档不存在",
  "message": "未找到 ID 对应的文档：20260301000000-notexist",
  "reason": "not_found"
}
```

## 注意事项

1. **仅支持文档ID**：此命令不支持笔记本 ID，如传入笔记本 ID 会返回明确的错误提示
2. **属性前缀处理**：返回的 `attributes` 已自动去除 `custom-` 前缀，直接显示属性名
3. **标签解析**：`tags` 字段已自动解析为数组格式
4. **权限限制**：需要相应的权限才能访问文档信息

## 相关文档

- [获取文档内容命令](content.md)
- [获取文档结构命令](structure.md)
- [块属性命令](block-control.md)
- [标签命令](tags.md)
