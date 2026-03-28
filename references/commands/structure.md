# 获取文档结构命令

获取指定笔记本或文档的文档结构（文档树）。

## 命令格式

```bash
siyuan structure (<notebookId|docId> | --path <path>) [--depth <depth>]
```

**别名**：`ls`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<notebookId\|docId>` | string | 二选一 | 笔记本ID或文档ID（位置参数） |
| `--path, -P` | string | 二选一 | 文档路径（与位置参数互斥） |
| `--depth, -d` | number | 否 | 递归深度（默认1，-1表示无限） |

> **注意**：位置参数和 `--path` 参数不能同时使用，必须二选一。

## 路径格式

`--path` / `-P` 参数支持以下格式：

| 格式 | 示例 | 说明 |
|------|------|------|
| 含笔记本名 | `-P "/笔记本名"` | 完整路径，首位为笔记本名称 |
| 含笔记本名 | `-P "/笔记本名/目录/文档"` | 完整路径，指向文档 |
| 不含笔记本名 | `-P "目录/文档"` | 使用默认笔记本 |

## 使用示例

### 通过 ID 获取结构

```bash
# 获取笔记本的文档结构（默认深度1）
siyuan structure 20260227231831-yq1lxq2

# 使用别名
siyuan ls 20260227231831-yq1lxq2

# 获取指定文档的子文档结构
siyuan structure 20260311033152-2lldhes

# 指定递归深度
siyuan ls 20260227231831-yq1lxq2 --depth 2

# 无限递归获取完整结构
siyuan ls 20260227231831-yq1lxq2 --depth -1
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
    "path": "/",
    "hpath": "/",
    "documents": [
      {
        "id": "20260311033152-abc123",
        "title": "文档标题",
        "path": "/20260311033152-abc123.sy",
        "hpath": "/文档标题",
        "type": "doc",
        "updated": "2026-03-11T03:31:52.000Z",
        "created": "2026-03-11T03:31:52.000Z",
        "size": 1024,
        "hasChildren": false,
        "subFileCount": 0
      }
    ],
    "folders": [
      {
        "id": "20260311033152-folder1",
        "title": "文件夹名",
        "path": "/20260311033152-folder1.sy",
        "hpath": "/文件夹名",
        "type": "folder",
        "updated": "2026-03-11T03:31:52.000Z",
        "created": "2026-03-11T03:31:52.000Z",
        "size": 512,
        "documents": [],
        "folders": [],
        "subFileCount": 3
      }
    ]
  },
  "timestamp": 1646389200000,
  "documentCount": 1,
  "folderCount": 1,
  "type": "notebook"
}
```

## 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 文档/文件夹ID |
| `title` | string | 文档标题 |
| `path` | string | 系统路径（含ID） |
| `hpath` | string | 可读路径（人类可读的层级路径） |
| `type` | string | 类型：`doc`（文档）或 `folder`（文件夹） |
| `updated` | string | 更新时间（ISO 8601格式） |
| `created` | string | 创建时间（ISO 8601格式） |
| `size` | number | 文档大小（字节） |
| `hasChildren` | boolean | 是否有子文档（仅文档类型） |
| `subFileCount` | number | 子文档数量 |

## 注意事项

1. **ID识别**：自动识别是笔记本ID还是文档ID
2. **权限限制**：需要相应的权限才能访问文档结构
3. **路径解析**：使用 `--path` 时会自动解析路径，支持首位存在或不存在笔记本名称
4. **递归深度**：默认只获取第一层，可通过 `--depth` 参数调整

## 相关文档

- [获取笔记本列表命令](notebooks.md)
- [获取文档内容命令](content.md)
- [最佳实践](../advanced/best-practices.md)
