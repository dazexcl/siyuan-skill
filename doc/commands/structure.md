# 获取文档结构命令

获取指定笔记本或文档的文档结构（文档树）。

## 命令格式

```bash
siyuan structure (<notebookId|docId> | --path <path>)
```

**别名**：`ls`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<notebookId\|docId>` | string | 二选一 | 笔记本ID或文档ID（位置参数） |
| `--path` | string | 二选一 | 文档路径（与位置参数互斥） |

> **注意**：位置参数和 `--path` 参数不能同时使用，必须二选一。

## 路径格式

`--path` 参数支持以下格式：

| 格式 | 示例 | 说明 |
|------|------|------|
| 含笔记本名 | `--path "/笔记本名"` | 完整路径，首位为笔记本名称 |
| 含笔记本名 | `--path "/笔记本名/目录/文档"` | 完整路径，指向文档 |
| 不含笔记本名 | `--path "目录/文档"` | 使用默认笔记本 |

## 使用示例

### 通过 ID 获取结构

```bash
# 获取笔记本的完整文档结构
siyuan structure 20260227231831-yq1lxq2

# 使用别名
siyuan ls 20260227231831-yq1lxq2

# 获取指定文档的子文档结构
siyuan structure 20260311033152-2lldhes

# 使用别名
siyuan ls 20260311033152-2lldhes
```

### 通过路径获取结构

```bash
# 获取笔记本的文档结构（路径首位为笔记本名）
siyuan ls --path "/我的笔记本"

# 获取文档的子文档结构
siyuan ls --path "/我的笔记本/目录/文档名"

# 使用默认笔记本（路径不含笔记本名）
siyuan ls --path "目录/文档名"
```

## 返回格式

```json
{
  "success": true,
  "data": {
    "notebookId": "20260227231831-yq1lxq2",
    "documents": [
      {
        "id": "20260311033152-abc123",
        "name": "文档标题",
        "title": "文档标题",
        "path": "文档标题",
        "updated": "20260311",
        "size": 1024
      }
    ],
    "folders": []
  },
  "timestamp": 1646389200000,
  "documentCount": 1,
  "folderCount": 0,
  "type": "notebook"
}
```

## 注意事项

1. **ID识别**：自动识别是笔记本ID还是文档ID
2. **权限限制**：需要相应的权限才能访问文档结构
3. **路径解析**：使用 `--path` 时会自动解析路径，支持首位存在或不存在笔记本名称

## 相关文档

- [获取笔记本列表命令](notebooks.md)
- [获取文档内容命令](content.md)
- [最佳实践](../advanced/best-practices.md)
