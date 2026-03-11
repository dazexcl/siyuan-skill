# 删除保护机制

为了防止 Agent 无故删除重要文档，系统提供多层删除保护机制。

## 保护层级

删除操作受多层保护机制约束，按优先级依次检查：

```
┌─────────────────┐
│  1. 全局安全模式  │  ← 最高优先级
├────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. 文档保护标记  │
├────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. 删除确认机制  │  ← 最低优先级
└─────────────────┘
```

### 1. 全局安全模式

**触发条件**：`config.json` 中 `deleteProtection.safeMode = true`

**效果**：禁止所有删除操作

**适用场景**：
- 系统维护期间
- 重要数据保护期
- 防止 Agent 误操作

**配置方式**：
```json
{
  "deleteProtection": {
    "safeMode": true
  }
}
```

**错误信息**：
```json
{
  "success": false,
  "error": "删除保护",
  "message": "全局安全模式已启用，禁止所有删除操作。如需删除，请关闭安全模式。",
  "protectionLevel": "safe_mode"
}
```

### 2. 文档保护标记

**触发条件**：文档属性 `custom-protected` 为 `true` 或 `permanent`

**效果**：保护文档无法删除

**保护类型**：

| 属性值 | 说明 | 可否通过命令移除 |
|--------|------|-----------------|
| `true` | 普通保护 | ✅ 可以 |
| `permanent` | 永久保护 | ❌ 不可以 |

**设置方式**：
```bash
# 设置普通保护
siyuan protect <docId>

# 设置永久保护
siyuan protect <docId> --permanent
```

**移除方式**：
```bash
# 移除普通保护
siyuan protect <docId> --remove
```

**错误信息**：
```json
{
  "success": false,
  "error": "删除保护",
  "message": "文档已被标记为保护状态（custom-protected=true），禁止删除。如需删除，请先移除保护标记。",
  "protectionLevel": "document_protected"
}
```

### 3. 删除确认机制

**触发条件**：`config.json` 中 `deleteProtection.requireConfirmation = true`

**效果**：删除时需要确认文档标题

**配置方式**：
```json
{
  "deleteProtection": {
    "requireConfirmation": true
  }
}
```

**使用方式**：
```bash
# 必须提供正确的文档标题
siyuan delete <docId> --confirm-title "文档标题"
```

**错误信息**：
```json
{
  "success": false,
  "error": "删除保护",
  "message": "删除确认机制已启用，必须提供 --confirm-title 参数以确认删除操作。",
  "protectionLevel": "confirmation_failed"
}
```

## 配置说明

### 完整配置示例

```json
{
  "deleteProtection": {
    "safeMode": false,
    "requireConfirmation": true
  }
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `safeMode` | boolean | true | 默认启用，禁止所有删除操作 |
| `requireConfirmation` | boolean | false | 启用后删除需要确认标题 |

## 最佳实践

### 推荐配置

对于生产环境，推荐启用删除确认机制：

```json
{
  "deleteProtection": {
    "safeMode": false,
    "requireConfirmation": true
  }
}
```

### 重要文档保护

对于重要文档，建议设置保护标记：

```bash
# 设置普通保护（可移除）
siyuan protect <important-doc-id>

# 设置永久保护（不可通过命令移除）
siyuan protect <critical-doc-id> --permanent
```

### Agent 操作建议

1. **启用确认机制**：确保 Agent 删除时需要明确确认
2. **保护重要文档**：对关键文档设置保护标记
3. **定期检查**：定期检查保护配置是否正确

## 相关文档

- [删除文档命令](../commands/delete.md)
- [文档保护命令](../commands/protect.md)
- [配置说明](../config/environment.md)
