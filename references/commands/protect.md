# 文档保护命令

设置或移除文档保护标记，防止文档被误删除。

## 命令格式

```bash
siyuan protect <docId> [--remove] [--permanent]
```

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<docId>` | string | ✅ | 文档 ID |
| `--remove` | flag | ❌ | 移除保护标记 |
| `--permanent` | flag | ❌ | 设置为永久保护 |

## 使用示例

### 设置保护

```bash
# 设置普通保护（可通过 --remove 移除）
siyuan protect 20260311025717-qmokx21

# 设置永久保护（无法通过命令移除）
siyuan protect 20260311025717-qmokx21 --permanent
```

### 移除保护

```bash
# 移除普通保护
siyuan protect 20260311025717-qmokx21 --remove
```

## 返回格式

### 设置保护成功

```json
{
  "success": true,
  "data": {
    "id": "20260311025717-qmokx21",
    "protected": true,
    "protectionType": true,
    "notebookId": "20260227231831-yq1lxq2"
  },
  "message": "文档保护已设置: true",
  "timestamp": 1646389200000
}
```

### 移除保护成功

```json
{
  "success": true,
  "data": {
    "id": "20260311025717-qmokx21",
    "protected": false,
    "protectionType": null,
    "notebookId": "20260227231831-yq1lxq2"
  },
  "message": "文档保护已移除",
  "timestamp": 1646389200000
}
```

### 永久保护无法移除

```json
{
  "success": false,
  "error": "永久保护",
  "message": "文档被标记为永久保护，无法通过命令移除保护。需要手动在思源笔记中修改属性。"
}
```

## 保护状态说明

文档通过 `custom-protected` 属性标记保护状态：

| 属性值 | 说明 | 可否通过命令移除 |
|--------|------|-----------------|
| 未设置 | 无保护 | - |
| `true` | 普通保护 | ✅ 可以 |
| `permanent` | 永久保护 | ❌ 不可以 |

## 注意事项

1. **普通保护**：可通过 `--remove` 参数移除
2. **永久保护**：无法通过命令移除，需要手动在思源笔记中修改文档属性
3. **权限要求**：需要有文档所在笔记本的操作权限
4. **保护范围**：仅防止通过本工具删除，不影响思源笔记客户端操作

## 相关文档

- [删除文档命令](delete.md)
- [删除保护机制](../advanced/delete-protection.md)
