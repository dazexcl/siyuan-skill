# 获取笔记本列表命令

获取思源笔记中所有笔记本的列表。

## 命令格式

```bash
siyuan notebooks
```

**别名**：`nb`

## 使用示例

### 基本用法
```bash
# 获取笔记本列表
siyuan notebooks

# 使用别名
siyuan nb
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

1. **权限限制**：根据权限配置，可能只返回部分笔记本

## 相关文档
- [权限管理](../advanced/permission.md)
