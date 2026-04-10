# info 命令使用指南

## 概述

`info` 命令用于获取文档或块的基础信息，包括 ID、标题、类型、路径、属性、标签、图标、时间等。

## 用法

```bash
node {baseDir}/scripts/info.js <id> [--raw] [-r] [-h] [--help]
```

### 参数

- `<id>`: 文档 ID 或块 ID

### 选项

- `-r, --raw`: 直接输出数据，不包裹响应对象
- `-h, --help`: 显示帮助信息

## 示例

### 基本用法

```bash
# 获取文档信息（默认格式）
node scripts/info.js 20260410031926-ktdfkek

# 输出：
{
  "success": true,
  "data": {
    "id": "20260410031926-ktdfkek",
    "name": null,
    "title": "test",
    "type": "d",
    "notebook": {
      "id": "20260227231831-yq1lxq2",
      "name": "AI"
    },
    "path": {
      "apath": "/AI/test",
      "storage": "/20260410031926-ktdfkek.sy",
      "hpath": "/test"
    },
    "attributes": {
      "aa": "aaa"
    },
    "rawAttributes": {},
    "tags": [],
    "icon": null,
    "updated": "20260410031933",
    "created": "20260410031926"
  },
  "message": "文档信息获取成功"
}
```

### 使用 --raw 选项

```bash
# 直接输出数据，不包裹响应对象
node scripts/info.js 20260410031926-ktdfkek --raw

# 输出：
{
  "id": "20260410031926-ktdfkek",
  "name": null,
  "title": "test",
  "type": "d",
  ...
}
```

### 获取块信息

```bash
# info 命令也支持块 ID
node scripts/info.js 20260327172226-7ribrqt

# 输出块信息（type: "i" 表示列表项）
{
  "success": true,
  "data": {
    "id": "20260327172226-7ribrqt",
    "name": "222",
    "title": null,
    "type": "i",
    ...
  }
}
```

## 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 文档/块 ID |
| `name` | string \| null | 块名称（从 attrs.name 获取） |
| `title` | string \| null | 标题（文档块从 content 获取，其他从 attrs.title 获取） |
| `type` | string | 类型（d=文档, l=列表, i=列表项, h=标题等） |
| `notebook` | object | 笔记本信息 |
| `notebook.id` | string | 笔记本 ID |
| `notebook.name` | string | 笔记本名称 |
| `path` | object | 路径信息 |
| `path.apath` | string | 绝对路径（/笔记本/路径/文档） |
| `path.storage` | string | 存储路径 |
| `path.hpath` | string | 文档路径 |
| `attributes` | object | 自定义属性（custom- 开头的属性，已去掉前缀） |
| `rawAttributes` | object | 其他属性（name、alias、memo、bookmark 等，不包含 id、title、type、icon、tags、updated、created） |
| `tags` | array | 标签数组 |
| `icon` | string \| null | 图标 |
| `updated` | string \| null | 更新时间 |
| `created` | string \| null | 创建时间 |

## 类型代码

思源笔记的块类型代码：

| 代码 | 类型 | 说明 |
|------|------|------|
| `d` | Document | 文档块 |
| `h` | Heading | 标题块 |
| `p` | Paragraph | 段落块 |
| `l` | List | 列表块 |
| `i` | List Item | 列表项 |
| `b` | Blockquote | 引用块 |
| `s` | Super Block | 超级块 |
| `c` | Code Block | 代码块 |
| `t` | Table | 表格 |
| `m` | Math Block | 数学公式块 |

## 与其他命令的区别

| 命令 | 职责 | 返回内容 |
|------|------|----------|
| `info` | 获取基础信息 | ID、标题、类型、路径、属性、标签、图标、时间 |
| `block-attrs` | 管理块属性 | 获取/设置/删除 name、alias、memo、bookmark 等 |
| `block-get` | 获取块内容 | kramdown/markdown 源码、子块列表 |

## 权限说明

- `info` 命令会检查笔记本权限
- 当 `permissionMode` 为 `whitelist` 时，只允许访问白名单中的笔记本
- 当 `permissionMode` 为 `blacklist` 时，禁止访问黑名单中的笔记本
- 详见 [安全文档](../references/advanced/security.md)

## API 调用

`info` 命令会调用以下 API：

1. `/api/filetree/getPathByID` - 获取文件路径
2. `/api/filetree/getHPathByID` - 获取人类可读路径
3. `/api/notebook/lsNotebooks` - 获取笔记本列表
4. `/api/query/sql` - 查询 blocks 表获取 type、content、updated、created
5. `/api/attr/getBlockAttrs` - 获取块属性

## 错误处理

### 无效 ID

```bash
node scripts/info.js invalid_id

# 输出：
{
  "success": false,
  "error": "未找到 ID 对应的文档：invalid_id",
  "message": "文档信息获取失败"
}
```

### 权限不足

```bash
node scripts/info.js 20260311152336-fm6hlbk

# 输出（假设不在白名单中）：
{
  "success": false,
  "error": "权限不足: 笔记本 20260308012748-i6sgf0p 不在白名单中",
  "message": "文档信息获取失败"
}
```

## 注意事项

1. `info` 命令支持文档 ID 和块 ID
2. `rawAttributes` 不包含与外层重复的字段（id、title、type、name、icon、tags、updated、created）
3. `attributes` 只包含 custom- 开头的属性，并已去掉 custom- 前缀
4. 使用 `--raw` 选项时，成功和失败都会直接输出数据/错误消息，不包裹响应对象
