# 获取笔记本列表命令

获取思源笔记中所有笔记本的列表。

## 命令格式

```bash
siyuan notebooks [options]
```

**别名**：`nb`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `--force-refresh` | boolean | ❌ | 强制刷新缓存 |

## 使用示例

### 基本用法
```bash
# 获取笔记本列表
siyuan notebooks

# 使用别名
siyuan nb
```

### 强制刷新缓存
```bash
# 强制刷新缓存
siyuan notebooks --force-refresh
```

## 返回格式

```json
{
  "success": true,
  "data": [
    {
      "id": "20260227231831-yq1lxq2",
      "name": "我的笔记本",
      "icon": "1f4d9",
      "sort": 0,
      "closed": false
    }
  ],
  "message": "获取笔记本列表成功",
  "timestamp": 1646389200000
}
```

## 注意事项

1. **缓存机制**：笔记本列表会自动缓存，默认缓存5分钟
2. **强制刷新**：使用 `--force-refresh` 可强制刷新缓存
3. **权限限制**：根据权限配置，可能只返回部分笔记本

## 相关文档
- [权限管理](../advanced/permission.md)
- [缓存机制](../advanced/caching.md)
