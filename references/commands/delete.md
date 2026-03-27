# 删除文档命令

删除思源笔记文档（受多层保护机制约束）。

**注意**：此命令仅用于删除文档。如果传入的是普通块 ID，将返回错误并提示使用 `block-delete` 命令。

## 命令格式

```bash
siyuan delete <docId> [--confirm-title <title>]
siyuan delete --doc-id <docId> [--confirm-title <title>]
```

**别名**：`rm`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<docId>` | string | ✅ | 文档 ID（位置参数或 --doc-id） |
| `--doc-id` | string | ✅ | 文档 ID（命名参数） |
| `--confirm-title` | string | ❌ | 确认标题（启用删除确认时需要） |

## 删除保护机制

删除操作受多层保护机制约束，按优先级依次检查：

| 层级 | 名称 | 触发条件 | 效果 |
|------|------|----------|------|
| 1 | 全局安全模式 | `safeMode: true` | 禁止所有删除操作 |
| 2 | 文档保护标记 | `custom-protected=true/permanent` | 保护文档无法删除 |
| 3 | 删除确认机制 | `requireConfirmation: true` | 需要确认文档标题 |

### 配置方式

在 `config.json` 中配置：

```json
{
  "deleteProtection": {
    "safeMode": false,
    "requireConfirmation": true
  }
}
```

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `safeMode` | boolean | true | 默认启用，禁止所有删除操作 |
| `requireConfirmation` | boolean | false | 启用后删除需要确认标题 |

## 使用示例

### 基本删除

```bash
# 删除文档
siyuan delete <docId>

# 使用别名
siyuan rm <docId>
```

### 带确认标题删除

```bash
# 当启用删除确认机制时，需要提供正确的文档标题
siyuan delete <docId> --confirm-title "文档标题"
```

## 返回格式

### 删除成功

```json
{
  "success": true,
  "data": {
    "id": "20260311025717-qmokx21",
    "deleted": true,
    "notebookId": "20260227231831-yq1lxq2",
    "title": "文档标题",
    "timestamp": 1646389200000
  },
  "message": "文档删除成功",
  "timestamp": 1646389200000
}
```

### 删除被阻止

```json
{
  "success": false,
  "error": "删除保护",
  "message": "文档已被标记为保护状态（custom-protected=true），禁止删除。如需删除，请先移除保护标记。",
  "protectionLevel": "document_protected"
}
```

### 确认失败

```json
{
  "success": false,
  "error": "删除保护",
  "message": "标题确认失败。文档标题: \"实际标题\"，提供的确认标题: \"错误标题\"。请确保标题完全匹配。",
  "protectionLevel": "confirmation_failed"
}
```

### 传入普通块 ID

```json
{
  "success": false,
  "error": "无效操作",
  "message": "传入的 ID \"xxx\" 是普通块而非文档。删除块请使用 block-delete 命令：siyuan bd --id xxx",
  "hint": "所属文档: \"文档标题\"",
  "blockType": "block"
}
```

## 错误类型

| protectionLevel | 说明 |
|-----------------|------|
| `safe_mode` | 全局安全模式已启用 |
| `document_protected` | 文档被保护标记保护 |
| `confirmation_failed` | 删除确认失败 |

## 注意事项

1. **不可恢复**：删除操作不可恢复，请谨慎操作
2. **权限限制**：需要相应的权限才能删除文档
3. **子文档处理**：删除文档时会同时删除所有子文档
4. **保护机制**：受保护的文档需要先移除保护才能删除
5. **确认机制**：启用确认机制时，标题必须完全匹配（不区分大小写）

## 相关文档

- [创建文档命令](create.md)
- [更新文档命令](update.md)
- [文档保护命令](protect.md)
