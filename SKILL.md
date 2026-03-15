---
name: "siyuan-skill"
version: "1.6.8"
description: "思源笔记命令行工具，提供便捷的命令行操作方式，支持笔记本管理、文档操作、内容搜索、块控制等功能"
skillType: "cli"
runtime: "node"
runtimeVersion: ">=14.0.0"
installType: "executable"
required_env_vars:
  - name: "SIYUAN_BASE_URL"
    description: "思源笔记 API 地址"
    required: true
    example: "http://localhost:6806"
  - name: "SIYUAN_TOKEN"
    description: "API 认证令牌"
    required: true
  - name: "SIYUAN_DEFAULT_NOTEBOOK"
    description: "默认笔记本 ID"
    required: true
optional_env_vars:
  - name: "SIYUAN_PERMISSION_MODE"
    description: "权限模式 (all/whitelist/blacklist)"
    default: "all"
  - name: "QDRANT_URL"
    description: "Qdrant 向量数据库地址（语义搜索需要）"
  - name: "OLLAMA_BASE_URL"
    description: "Ollama 服务地址（语义搜索需要）"
---

# Siyuan Skill

**思源笔记 CLI 工具** - 为 AI Agent 提供笔记本管理、文档操作、内容搜索、块控制等功能。

## 环境变量

| 变量 | 必需 | 说明 |
|------|------|------|
| `SIYUAN_BASE_URL` | ✅ | API 地址，建议 `http://localhost:6806` |
| `SIYUAN_TOKEN` | ✅ | API 令牌 |
| `SIYUAN_DEFAULT_NOTEBOOK` | ✅ | 默认笔记本 ID |
| `SIYUAN_PERMISSION_MODE` | ❌ | 权限模式，默认 `all` |

---

# 重要约束

- **必须使用 CLI 命令操作思源笔记**
- **禁止自动修改配置文件和环境变量**

---

# 快速开始

```bash
node siyuan.js <command> [options]
siyuan help <command>  # 查看命令帮助
```

---

# 命令列表

## 常用命令

| 命令 | 别名 | 说明 |
|------|------|------|
| `notebooks` | `nb` | 获取笔记本列表 |
| `structure` | `ls` | 获取文档结构 |
| `content` | `cat` | 获取文档内容 |
| `create` | `new` | 创建文档（自动重名检测） |
| `update` | `edit`, `bu` | 更新文档/块内容 |
| `delete` | `rm` | 删除文档（受保护） |
| `protect` | - | 设置/移除文档保护 |
| `move` | `mv` | 移动文档（自动重名检测） |
| `rename` | - | 重命名文档（自动重名检测） |
| `search` | `find` | 搜索内容 |
| `convert` | `path` | 转换 ID 和路径 |
| `block-attrs` | `ba`, `attrs` | 设置块/文档属性 |
| `tags` | `st` | 设置标签 |
| `exists` | `check` | 检查文档是否存在 |

## 块操作命令

| 命令 | 别名 | 说明 |
|------|------|------|
| `block-insert` | `bi` | 插入块 |
| `block-update` | `bu` | 更新块 |
| `block-delete` | `bd` | 删除块（仅限普通块） |
| `block-move` | `bm` | 移动块 |
| `block-get` | `bg` | 获取块信息 |
| `block-fold` | `bf`, `buu` | 折叠/展开块 |

> **block-delete 限制**：此命令仅用于删除普通块。如果传入文档 ID，会返回错误并提示使用 `delete` 命令。

---

# 重名检测

以下命令在执行前会自动检测目标位置是否存在同名文档：

| 命令 | 检测时机 | 冲突处理 |
|------|----------|----------|
| `create` | 创建前 | 返回错误，使用 `--force` 强制创建 |
| `move` | 移动前 | 返回错误，使用 `--new-title` 指定新标题 |
| `rename` | 重命名前 | 返回错误，需更换新标题 |

**示例：**

```bash
# 检测到冲突
siyuan create "文档标题" "内容"
# 返回: 在目标位置已存在标题为"文档标题"的文档，请使用 --force 参数强制创建

# 强制创建同名文档
siyuan create "文档标题" "内容" --force

# 移动时检测到冲突
siyuan mv <docId> <targetParentId>
# 返回: 在目标位置已存在同名文档，请使用 --new-title 参数指定新标题

# 使用新标题移动
siyuan mv <docId> <targetParentId> --new-title "新标题"
```

**手动检查文档是否存在：**

```bash
# 通过标题检查
siyuan exists --title "文档标题" [--parent-id <父文档ID>]

# 通过路径检查
siyuan exists --path "/目录/文档标题"

# 返回示例
# 存在: { "exists": true, "id": "xxx", "path": "/xxx" }
# 不存在: { "exists": false }
```

---

# 删除保护

**默认禁止删除**，需在 `config.json` 中配置：

```json
{
  "deleteProtection": {
    "safeMode": false,
    "requireConfirmation": true
  }
}
```

保护层级：全局安全模式 → 文档保护标记 → 删除确认机制

---

# 最佳实践

## 内容修改

```bash
# ✅ 推荐：直接更新
siyuan update <docId> "新内容"
siyuan bu <blockId> "新内容"

# ❌ 不推荐：删除再新建（丢失属性、引用）
```

## 属性设置

```bash
# ✅ 推荐：使用命令设置
siyuan ba <docId> --set "status=published"
siyuan st <docId> --tags "重要,待审核"

# ❌ 不推荐：在内容中添加 Front Matter
```

## 文档格式

```bash
# ✅ 正确：使用 \n 换行
siyuan create "标题" "第一段\n\n## 二级标题\n内容"

# ❌ 错误：所有内容在一行
siyuan create "标题" "第一段## 二级标题 内容"
```

## 内容规范

- 内容从正文开始，标题通过命令指定
- **不要在正文中包含标题块**（如 `# 标题`），标题由命令参数单独指定
- **不要在正文中包含 Front Matter 块**（如 `---\ntitle: xxx\n---`），元数据通过属性命令设置
- 写入使用 Markdown 格式
- kramdown 格式仅用于读取

---

# 高级功能

## 向量搜索（可选）

需部署 Qdrant + Ollama，配置环境变量：
- `QDRANT_URL`
- `OLLAMA_BASE_URL`

### 搜索模式

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `legacy`（默认） | SQL LIKE 精确匹配 | 精确关键词搜索 |
| `keyword` | 稀疏向量（BM25）+ N-gram | 关键词匹配，支持未登录词 |
| `semantic` | 稠密向量（语义） | 同义词、概念关联 |
| `hybrid` | 稠密 + 稀疏 | 综合搜索 |

### 搜索示例

```bash
# 默认 Legacy 模式（精确匹配）
siyuan search "关键词"

# 关键词搜索（支持 N-gram）
siyuan search "长颈鹿" --mode keyword

# 语义搜索
siyuan search "人工智能" --mode semantic

# 混合搜索
siyuan search "AI" --mode hybrid
```

## NLP 分析

```bash
siyuan nlp "文本" --tasks tokenize,keywords
```

---

# 安全建议

- 仅将 `SIYUAN_BASE_URL` 设置为本地实例（`http://localhost:6806`）
- 推荐使用 `whitelist` 权限模式限制可访问的笔记本
- 生产环境不启用 `DEBUG` 环境变量
- 敏感信息（token、password、apiKey）在日志中自动脱敏
- TLS 证书验证默认启用
- **SQL 注入防护**：搜索功能已实现完整的参数转义和验证

## 搜索安全特性

| 特性 | 说明 |
|------|------|
| 查询转义 | 所有搜索查询都经过 `escapeSql` 转义 |
| ID 验证 | 笔记本/文档 ID 必须符合 14-32 位字母数字格式 |
| 类型白名单 | 类型参数只接受预定义值 |
| 权重归一化 | 权重参数自动归一化到 0-1 范围 |
| 并发控制 | 批量请求最多 5 个并发，每批 10 个结果 |

## 程序化 API

本 skill 导出 `createSkill` 和 `executeSingleCommand` 函数供高级用户使用：

```javascript
const { createSkill } = require('./index.js');
const skill = createSkill({ baseURL: 'http://localhost:6806', token: 'xxx' });
```

> ⚠️ 程序化 API 仅供高级用户在受控环境中使用。普通 AI Agent 应仅使用 CLI 命令。

---

# 参考文档

- [命令详细文档](doc/commands/)
- [配置文档](doc/config/)
- [高级功能](doc/advanced/)
- [思源笔记 API](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)
