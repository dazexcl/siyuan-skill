# 设置标签命令

设置、添加、移除或获取块/文档的标签。

## 命令格式

```bash
siyuan tags <id> --tags <tags> [--add] [--remove] [--get]
```

**别名**：`st`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<id>` | string | ✅ | 块ID/文档ID（位置参数） |
| `--id` | string | ❌ | 块ID/文档ID（等同于位置参数） |
| `--tags <tags>` | string | ❌ | 标签内容（逗号分隔多个标签） |
| `--add` | flag | ❌ | 添加标签（追加模式） |
| `--remove` | flag | ❌ | 移除指定标签 |
| `--get` | flag | ❌ | 获取当前标签 |

## 使用示例

### 设置标签（覆盖模式）

```bash
# 设置标签（覆盖原有标签）
siyuan tags <docId> --tags "标签1,标签2"

# 使用别名
siyuan st <docId> --tags "标签1,标签2"
```

### 添加标签（追加模式）

```bash
# 添加新标签（保留原有标签）
siyuan tags <docId> --tags "新标签" --add

# 添加多个标签
siyuan tags <docId> --tags "标签3,标签4" --add
```

### 移除标签

```bash
# 移除指定标签
siyuan tags <docId> --tags "旧标签" --remove

# 移除多个标签
siyuan tags <docId> --tags "标签1,标签2" --remove
```

### 获取标签

```bash
# 获取当前标签
siyuan tags <docId> --get

# 使用别名
siyuan st <docId> --get
```

## 返回格式

### 设置/添加/移除标签成功

```json
{
  "success": true,
  "data": {
    "id": "20260311033152-2lldhes",
    "tags": ["标签1", "标签2", "标签3"],
    "notebookId": "20260227231831-yq1lxq2"
  },
  "message": "标签设置成功",
  "timestamp": 1646389200000
}
```

### 获取标签成功

```json
{
  "success": true,
  "data": {
    "id": "20260311033152-2lldhes",
    "tags": ["标签1", "标签2", "标签3"]
  },
  "message": "获取标签成功",
  "timestamp": 1646389200000
}
```

## 注意事项

1. **标签格式**：标签之间用逗号分隔，支持中文标签
2. **覆盖模式**：默认模式会覆盖所有现有标签
3. **追加模式**：使用 `--add` 参数可以保留现有标签
4. **移除模式**：使用 `--remove` 参数可以移除指定标签
5. **权限限制**：需要相应的权限才能修改标签
6. **ID类型**：支持块ID和文档ID

## 相关文档

- [块属性命令](block-control.md#block-attrs-ba-attrs)
- [块控制命令](block-control.md)
- [最佳实践](../advanced/best-practices.md)
