# 创建文档命令

创建思源笔记文档，支持三种使用模式、自动处理换行符、路径自动创建和重名检测。

## 命令格式

```bash
siyuan create [options] [positional-args]
```

**别名**：`new`

## 三种使用模式

### 模式1：传统模式（无 --path）

```bash
siyuan create <title> [content] --parent-id <parentId>
```

| 位置参数 | 说明 |
|---------|------|
| 参数1 | 文档标题 |
| 参数2 | 文档内容（可选） |

```bash
# 在笔记本根目录创建
siyuan create "我的文档" --parent-id <notebookId>

# 在笔记本根目录创建带内容的文档
siyuan create "我的文档" "文档内容" --parent-id <notebookId>

# 在某个文档下创建子文档
siyuan create "子文档" "内容" --parent-id <docId>
```

### 模式2：路径指定文档（--path 末尾无 /）

```bash
siyuan create --path "笔记本/目录/文档名" [content] [--title "自定义标题"]
```

| 位置参数 | 说明 |
|---------|------|
| 参数1 | 文档内容（可选） |

**标题来源**：默认从路径最后一段提取，可用 `--title` 覆盖

```bash
# 创建文档，标题从路径提取
siyuan create --path "AI/项目/需求文档" "这是文档内容"

# 使用自定义标题覆盖
siyuan create --path "AI/项目/需求文档" --title "需求文档v2" "内容"

# 不提供内容，创建空文档
siyuan create --path "AI/项目/空文档"

# 创建多级空目录（所有层级都是空文档）
siyuan create --path "AI/项目/目录1/目录2/最终目录"
```

### 模式3：在目录下创建（--path 末尾有 /）

```bash
siyuan create --path "笔记本/目录/" <title> [content]
```

| 位置参数 | 说明 |
|---------|------|
| 参数1 | 新文档标题 |
| 参数2 | 文档内容（可选） |

```bash
# 在指定目录下创建新文档
siyuan create --path "AI/项目/" "新需求文档" "文档内容"

# 在目录下创建空文档
siyuan create --path "AI/项目/" "空文档"
```

## 参数说明

| 参数                       | 类型      | 说明 |
| ------------------------ | ------- | ---- |
| `--parent-id, --parent, -p`  | string  | 父文档或笔记本 ID（与 --path 二选一） |
| `--path, -P`                 | string  | 文档路径。末尾无/表示创建该文档；末尾有/表示在该目录下创建 |
| `--title, -t`            | string  | 自定义标题（仅 --path 模式，覆盖路径中的标题） |
| `--file, -f`             | string  | 从文件读取内容（超长内容推荐） |
| `--force`                | boolean | 强制创建（忽略重名检测） |

## 功能特性

### 路径自动创建

使用 `--path` 时，中间目录不存在会自动创建（空内容）：

```bash
# 如果 A、B、C 不存在，会自动创建
# 最终创建 D 文档
siyuan create --path "笔记本/A/B/C/D" "内容"

# 目录结构：
# 笔记本/
# └── A/        (空，自动创建)
#     └── B/    (空，自动创建)
#         └── C/  (空，自动创建)
#             └── D  (有内容)
```

### 重名检测

创建文档前会自动检测目标位置是否存在同名文档：

```bash
# 检测到重名时的返回
# {
#   "success": false,
#   "error": "文档已存在",
#   "message": "文档 \"AI/测试\" 已存在 (ID: xxx)。使用 --force 强制创建。",
#   "existingId": "xxx"
# }

# 正常创建（检测重名）
siyuan create --path "AI/测试" "内容"

# 强制创建（跳过重名检测，允许重名）
siyuan create --path "AI/测试" "内容" --force
```

### 换行符处理

支持使用 `\n` 表示换行，系统会自动转换：

```bash
# 创建多行内容文档
siyuan create "多行文档" "第一行\n第二行\n第三行"

# 创建带格式的文档
siyuan create "格式文档" "# 标题\n\n段落内容\n\n- 列表1\n- 列表2"
```

**重要**：Markdown 语法要求标题、列表等块级元素前必须有空行：

```bash
# ❌ 错误 - 标题不会被正确解析
siyuan create "标题" "内容。## 二级标题 内容"

# ✅ 正确 - 使用 \n\n 换行
siyuan create "标题" "内容。\n\n## 二级标题\n内容"
```

## 使用示例

### 基本创建

```bash
# 创建空文档
siyuan create "我的文档" --parent-id <notebookId>

# 创建带内容的文档
siyuan create "我的文档" "文档内容" --parent-id <notebookId>
```

### 多级目录创建

```bash
# 创建完整的多级目录结构
siyuan create --path "AI/项目/模块A/功能B" "功能B的说明"

# 只创建目录结构（全部为空文档）
siyuan create --path "AI/项目/模块A/功能B"
```

### 在现有目录下创建

```bash
# 在现有目录下创建多个文档
siyuan create --path "AI/项目/" "需求文档" "需求内容"
siyuan create --path "AI/项目/" "设计文档" "设计内容"
siyuan create --path "AI/项目/" "测试文档" "测试内容"
```

### 复杂内容文档

```bash
# 创建带完整 Markdown 格式的文档
siyuan create --path "AI/项目/技术文档" "# 概述\n\n项目概述内容...\n\n## 架构设计\n\n架构说明...\n\n### 前端\n\n前端架构...\n\n### 后端\n\n后端架构...\n\n## API 列表\n\n- 用户接口\n- 数据接口\n- 管理接口"
```

## 模式选择建议

| 场景 | 推荐模式 | 示例 |
|------|---------|------|
| 简单创建，已知父ID | 模式1 | `create "标题" --parent-id <id>` |
| 创建多级目录 | 模式2 | `create --path "A/B/C/D"` |
| 在目录下批量创建 | 模式3 | `create --path "A/B/" "文档1"` |
| 需要自定义标题 | 模式2 + --title | `create --path "A/B" --title "自定义"` |

## 注意事项

1. **参数互斥**：`--parent-id` 与 `--path` 不能同时使用
2. **超长内容**：推荐使用 `--file` 参数从文件读取，或使用 Shell 命令替换
3. **标题斜杠**：标题中的 `/` 会自动转换为全角 `／`
4. **重名检测**：默认检测同名文档，使用 `--force` 可强制创建
5. **Windows 编码**：PowerShell 命令替换需使用 `Get-Content -Raw -Encoding UTF8`，推荐直接用 `--file`

## 相关文档

- [更新文档命令](update.md)
- [最佳实践](../advanced/best-practices.md)
- [删除文档命令](delete.md)
