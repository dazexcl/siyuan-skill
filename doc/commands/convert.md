# 转换 ID 和路径命令

转换思源笔记文档 ID 和人类可读路径。

## 命令格式

```bash
siyuan convert [options]
```

**别名**：`path`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `--id <docId>` | string | ❌ | 文档 ID，格式：15 位数字 + 短横线 + 5 位字母数字 |
| `--path <hPath>` | string | ❌ | 人类可读路径，例如：`/AI/openclaw/更新记录` |
| `--force` | boolean | ❌ | 强制操作（创建时忽略重名检测，转换时返回第一个匹配结果） |

## 使用示例

### 将文档 ID 转换为路径
```bash
# 将文档 ID 转换为路径
siyuan convert --id 20260304051123-doaxgi4

# 使用别名
siyuan path 20260304051123-doaxgi4

# 不带选项的简写方式（自动识别）
siyuan convert 20260304051123-doaxgi4
```

### 将路径转换为文档 ID
```bash
# 将路径转换为文档 ID
siyuan convert --path /AI/openclaw/更新记录

# 使用别名
siyuan path /AI/openclaw/更新记录

# 不带选项的简写方式（自动识别）
siyuan convert /AI/openclaw/更新记录
```

### 强制转换
```bash
# 强制转换（当存在多个匹配时返回第一个结果）
siyuan convert --path /AI/测试笔记 --force

# 带强制参数的简写方式
siyuan convert /AI/测试笔记 --force
```

## 返回格式

### ID 转路径
```json
{
  "success": true,
  "data": {
    "id": "20260304051123-doaxgi4",
    "hPath": "/AI/openclaw/更新记录",
    "box": "20260227231831-yq1lxq2",
    "title": "更新记录"
  },
  "message": "ID 转路径成功",
  "timestamp": 1646389200000
}
```

### 路径转 ID
```json
{
  "success": true,
  "data": {
    "id": "20260304051123-doaxgi4",
    "name": "更新记录",
    "type": "d",
    "box": "20260227231831-yq1lxq2"
  },
  "message": "路径转 ID 成功",
  "timestamp": 1646389200000
}
```

## 注意事项

1. **自动识别**：可以不带选项直接使用，系统会自动识别是 ID 还是路径
2. **ID 格式**：文档 ID 格式为 15 位数字 + 短横线 + 5 位字母数字
3. **路径格式**：路径以 `/` 开头，例如：`/AI/openclaw/更新记录`
4. **多个匹配**：当路径匹配多个文档时，使用 `--force` 返回第一个结果
5. **权限限制**：需要相应的权限才能访问文档信息

## 相关文档
- [移动文档命令](move.md)
- [获取文档结构命令](structure.md)
- [最佳实践](../advanced/best-practices.md)
