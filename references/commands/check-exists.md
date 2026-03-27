# exists 命令

检查指定位置是否存在同名文档。

## 用法

```bash
# 通过标题检查（位置参数）
siyuan exists "文档标题" [--parent-id <父文档ID>] [--notebook-id <笔记本ID>]

# 通过标题检查（命名参数）
siyuan exists --title "文档标题" [--parent-id <父文档ID>] [--notebook-id <笔记本ID>]

# 通过路径检查
siyuan exists --path "/目录/文档标题" [--notebook-id <笔记本ID>]

# 别名
siyuan check "文档标题"
```

## 参数

| 参数 | 别名 | 必填 | 说明 |
|------|------|------|------|
| `<title>` | - | 三选一 | 文档标题（位置参数） |
| `--title` | `-t` | 三选一 | 文档标题（命名参数） |
| `--path` | - | 三选一 | 文档完整路径（如 `/目录/子文档`） |
| `--parent-id` | `-p` | 否 | 父文档ID，不指定则检查笔记本根目录 |
| `--notebook-id` | `-n` | 否 | 笔记本ID，不指定则使用默认笔记本 |

## 返回结果

### 文档存在

```json
{
  "success": true,
  "exists": true,
  "data": {
    "id": "20260313203125-hg6mdrz",
    "path": "/测试目录/子文档A",
    "title": "子文档A"
  },
  "message": "文档存在，ID: 20260313203125-hg6mdrz，路径: /测试目录/子文档A"
}
```

### 文档不存在

```json
{
  "success": true,
  "exists": false,
  "data": {
    "title": "不存在的文档",
    "parentId": null,
    "notebookId": "20260227231831-yq1lxq2"
  },
  "message": "文档不存在"
}
```

## 示例

### 检查笔记本根目录是否存在文档

```bash
siyuan exists --title "我的文档"
```

### 检查子目录下是否存在文档

```bash
siyuan exists --title "子文档A" --parent-id 20260313203048-cjem96v
```

### 通过完整路径检查

```bash
siyuan exists --path "/测试目录/子文档A"
```

### 指定笔记本检查

```bash
siyuan exists --title "我的文档" --notebook-id 20260227231831-yq1lxq2
```

## 使用场景

1. **创建前检查**：在创建文档前检查是否已存在同名文档
2. **移动前检查**：在移动文档前检查目标位置是否有冲突
3. **脚本验证**：在自动化脚本中验证文档是否存在

## 相关命令

- [create](create.md) - 创建文档（自动重名检测）
- [move](move.md) - 移动文档（自动重名检测）
- [rename](rename.md) - 重命名文档（自动重名检测）
