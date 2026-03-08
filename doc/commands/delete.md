# 删除文档命令

删除思源笔记文档。

## 命令格式

```bash
siyuan delete <docId>
```

**别名**：`rm`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<docId>` | string | ✅ | 文档 ID |

## 使用示例

### 基本删除
```bash
# 删除文档
siyuan delete <docId>

# 使用别名
siyuan rm <docId>
```

## 返回格式

```json
{
  "success": true,
  "data": null,
  "message": "删除文档成功",
  "timestamp": 1646389200000
}
```

## 注意事项

1. **不可恢复**：删除操作不可恢复，请谨慎操作
2. **权限限制**：需要相应的权限才能删除文档
3. **子文档处理**：删除文档时会同时删除所有子文档
4. **文档ID格式**：文档 ID 格式为 15 位数字 + 短横线 + 5 位字母数字

## 相关文档
- [创建文档命令](create.md)
- [更新文档命令](update.md)
- [权限管理](../advanced/permission.md)
