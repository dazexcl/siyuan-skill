# 获取文档内容命令

获取思源笔记文档的内容，支持多种输出格式。

## 命令格式

```bash
siyuan content <docId> [options]
```

**别名**：`cat`

## 参数说明

| 参数 | 类型 | 必填 | 说明 |
|-----|------|------|------|
| `<docId>` | string | 二选一 | 文档 ID |
| `--path <path>` | string | 二选一 | 文档路径（如 `/目录/文档标题`） |
| `--format <format>` | string | ❌ | 输出格式：kramdown、markdown、text、html（默认：kramdown） |
| `--raw` | boolean | ❌ | 以纯文本格式返回（移除JSON外部结构） |

## 使用示例

### 基本用法

```bash
# 通过文档ID获取内容（kramdown格式）
siyuan content <docId>

# 通过文档路径获取内容
siyuan content --path "/目录/文档标题"

# 使用别名
siyuan cat <docId>
```

### 指定输出格式

```bash
# 获取纯文本格式
siyuan content <docId> --format text

# 获取 Markdown 格式
siyuan content <docId> --format markdown

# 获取 HTML 格式
siyuan content <docId> --format html
```

### 使用 raw 模式

```bash
# 以纯文本格式返回（直接输出内容，不包含JSON结构）
siyuan content <docId> --raw

# 组合使用
siyuan content <docId> --format text --raw
```

## 输出格式说明

### kramdown 格式（默认）

包含块ID和属性的 Markdown 格式：

```kramdown
文档内容
{: id="block-id" updated="20260312142019"}

{: id="doc-id" title="文档标题" type="doc" updated="20260312142019"}
```

### markdown 格式

标准 Markdown 格式，不包含块ID和属性。

### text 格式

纯文本格式，移除所有格式标记。

### html 格式

HTML 格式，包含完整的标签结构。

## 返回格式

### 非 raw 模式

```json
{
  "success": true,
  "data": {
    "id": "20260311033152-2lldhes",
    "content": "文档内容...",
    "format": "kramdown"
  },
  "message": "获取文档内容成功",
  "timestamp": 1646389200000
}
```

### raw 模式

直接返回文本内容，无JSON包装。

## 注意事项

1. **文档ID格式**：文档 ID 格式为 14 位数字 + 短横线 + 7 位字母数字
2. **格式选择**：根据用途选择合适的格式
   - 需要保留块属性时使用 kramdown
   - 只需要内容时使用 markdown 或 text
   - 需要在网页显示时使用 html
3. **raw模式**：适合直接输出到终端或文件
4. **权限限制**：需要相应的权限才能访问文档内容

## 相关文档

- [获取文档结构命令](structure.md)
- [更新文档命令](update.md)
- [块控制命令](block-control.md)
- [最佳实践](../advanced/best-practices.md)
