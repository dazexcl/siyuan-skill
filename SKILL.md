---
name: "siyuan-skill"
version: "1.2.0"
description: "思源笔记命令行工具，提供便捷的命令行操作方式，支持笔记本管理、文档操作、内容搜索等功能"
---
# 核心价值

**提供 AI Agent 可快速接入思源笔记的 skill 方案**
**为 AI Agent 团队提供统一、结构化、可检索的共享知识库**

## 适用场景
✅ 团队规范、项目知识、可复用技能
✅ 需要多 Agent 共享的知识
✅ 需要长期存储和检索的内容

## 不适用场景
❌ 日常互动记录、个人学习反思
❌ 临时笔记、代码版本管理
❌ 实时协作编辑

## 关键原则
- **思源笔记** = 共享知识库
- **memory 文件** = 私密记录
- **MEMORY.md** = 长期记忆

---

# 重要约束

**必须使用 CLI 命令来操作思源笔记**
**禁止直接调用 API**
**禁止使用脚本调用、引用 index.js**
**禁止使用脚本调用、引用指令文件**

---

# 快速开始

## 使用方式

```bash
# 方式 1：进入技能目录运行
cd <skills-directory>/siyuan-skill
node siyuan.js <command>

# 方式 2：使用 npm link 全局安装（推荐）
npm link -g
siyuan <command>

# 方式 3：直接指定路径运行
node <skills-directory>/siyuan-skill/siyuan.js <command>
```

## 查看帮助

```bash
# 查看所有可用命令
siyuan help

# 查看特定命令的详细帮助
siyuan help search
siyuan help create
```

---

# 命令列表

| 命令 | 别名 | 说明 |
|-----|------|------|
| `notebooks` | `nb` | 获取笔记本列表 |
| `structure` | `ls` | 获取文档结构 |
| `content` | `cat` | 获取文档内容 |
| `search` | `find` | 搜索内容（支持向量搜索） |
| `create` | `new` | 创建文档（自动处理换行符） |
| `update` | `edit` | 更新文档（自动处理换行符） |
| `delete` | `rm` | 删除文档 |
| `move` | `mv` | 移动文档 |
| `convert` | `path` | 转换 ID 和路径 |
| `index` | - | 索引文档到向量数据库 |
| `nlp` | - | NLP 文本分析 |

---

# 详细文档

## 命令详细文档
- [搜索命令](doc/commands/search.md) - 搜索参数详解、使用示例
- [创建文档](doc/commands/create.md) - 创建文档特性、Front Matter 使用
- [更新文档](doc/commands/update.md) - 更新文档内容
- [删除文档](doc/commands/delete.md) - 删除文档
- [移动文档](doc/commands/move.md) - 移动文档位置
- [转换 ID 和路径](doc/commands/convert.md) - ID 和路径互转
- [获取笔记本列表](doc/commands/notebooks.md) - 获取笔记本列表
- [索引文档](doc/commands/index.md) - 向量数据库索引
- [NLP 分析](doc/commands/nlp.md) - 文本分析功能

## 高级主题
- [向量搜索配置](doc/advanced/vector-search.md) - Qdrant 和 Ollama 配置
- [最佳实践](doc/advanced/best-practices.md) - 使用建议和注意事项

## 配置文档
- [环境变量配置](doc/config/environment.md) - 环境变量说明
- [高级配置](doc/config/advanced.md) - 详细配置选项

---

# 配置

## 环境变量（优先级最高）

```bash
export SIYUAN_BASE_URL="http://127.0.0.1:6806"
export SIYUAN_TOKEN="your-api-token"
export SIYUAN_DEFAULT_NOTEBOOK="your-notebook-id"
export SIYUAN_PERMISSION_MODE="all"
```

## 配置文件

编辑 `config.json` 文件：

```json
{
  "baseURL": "http://127.0.0.1:6806",
  "token": "your-api-token",
  "defaultNotebook": "your-notebook-id",
  "permissionMode": "all"
}
```

**获取配置信息**：
1. 打开思源笔记 → 设置 → 关于 → 复制 API Token
2. 使用 `siyuan notebooks` 获取笔记本 ID

---

# 注意事项

1. **首次使用**需要配置思源笔记 API 地址和 Token
2. **权限模式**：`all`（无限制）/ `whitelist`（白名单）/ `blacklist`（黑名单）
3. **缓存机制**：笔记本列表和文档结构会自动缓存，可使用 `--force-refresh` 强制刷新
4. **向量搜索**：需要单独部署 Qdrant 和 Ollama 服务，否则会回退到 SQL 搜索

---

# 参考文档

- [思源笔记 API 文档](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md) - 官方 API 参考文档
- [思源笔记用户指南](https://github.com/siyuan-note/siyuan/blob/master/README_zh_CN.md) - 官方用户指南
