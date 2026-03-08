# 更新文档命令

更新思源笔记文档内容，支持自动处理换行符。

## 命令格式

```bash
siyuan update <docId> <content>
```

**别名**：`edit`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<docId>` | string | ✅ | 文档 ID |
| `<content>` | string | ✅ | 新的文档内容 |

## 功能特性

### 自动换行符处理
支持使用 `\n` 表示换行，系统会自动将其转换为实际的换行符。

```bash
siyuan update <docId> "第一行\n第二行\n第三行"
```

### 保留文档结构
更新时会保留文档的元数据和结构信息。

## 使用示例

### 基本更新
```bash
# 更新文档内容
siyuan update <docId> "新的文档内容"

# 使用别名
siyuan edit <docId> "新的文档内容"
```

### 更新多行内容
```bash
# 更新多行内容（自动处理换行符）
siyuan update <docId> "第一行\n第二行\n第三行"

# 更新带格式的内容
siyuan update <docId> "# 标题\n\n这是段落内容\n\n- 列表项1\n- 列表项2"
```

### 更新长内容
```bash
# 更新超长内容
siyuan update <docId> "完整的超长内容..."

# 使用文件重定向
siyuan update <docId> "$(cat content.md)"
```

## 注意事项

1. **文档ID格式**：文档 ID 格式为 15 位数字 + 短横线 + 5 位字母数字
2. **换行符处理**：支持使用 `\n` 表示换行，系统会自动转换
3. **内容长度**：支持超长内容，无长度限制
4. **覆盖更新**：更新会完全覆盖原有内容，请谨慎操作

## 相关文档
- [创建文档命令](create.md)
- [删除文档命令](delete.md)
- [最佳实践](../advanced/best-practices.md)
