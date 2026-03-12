# 获取文档结构命令

获取指定笔记本或文档的文档结构（文档树）。

## 命令格式

```bash
siyuan structure <notebookId|docId> [options]
```

**别名**：`ls`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<notebookId\|docId>` | string | ✅ | 笔记本ID或文档ID |
| `--force-refresh` | boolean | ❌ | 强制刷新缓存 |

## 使用示例

### 获取笔记本的文档结构

```bash
# 获取笔记本的完整文档结构
siyuan structure 20260227231831-yq1lxq2

# 使用别名
siyuan ls 20260227231831-yq1lxq2

# 强制刷新缓存
siyuan structure 20260227231831-yq1lxq2 --force-refresh
```

### 获取文档的子文档结构

```bash
# 获取指定文档的子文档结构
siyuan structure 20260311033152-2lldhes

# 使用别名
siyuan ls 20260311033152-2lldhes
```

## 返回格式

```json
{
  "success": true,
  "data": [
    {
      "id": "20260311033152-abc123",
      "title": "文档标题",
      "type": "doc",
      "subDocCount": 2
    }
  ],
  "message": "获取文档结构成功",
  "timestamp": 1646389200000
}
```

## 注意事项

1. **ID识别**：自动识别是笔记本ID还是文档ID
2. **缓存机制**：文档结构会自动缓存，默认缓存5分钟
3. **强制刷新**：使用 `--force-refresh` 可强制刷新缓存
4. **权限限制**：需要相应的权限才能访问文档结构

## 相关文档

- [获取笔记本列表命令](notebooks.md)
- [获取文档内容命令](content.md)
- [最佳实践](../advanced/best-practices.md)
