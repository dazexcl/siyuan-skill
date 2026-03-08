---
name: "siyuan-skill"
version: "1.3.2"
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
**禁止自动修改配置文件与本技能相关环境变量配置**
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

使用 `siyuan help` 查看所有可用命令和详细说明。

**常用命令**：
- `nb` - 获取笔记本列表
- `new` - 创建文档
- `edit` - 更新文档
- `rm` - 删除文档
- `find` - 搜索内容（支持向量搜索）
- `mv` - 移动文档
- `path` - 转换 ID 和路径
- `index` - 索引文档到向量数据库
- `nlp` - NLP 文本分析

详细命令文档请查看 [doc/commands/](doc/commands/) 目录。

---

# 配置

## 环境变量（优先级最高）

```bash
export SIYUAN_BASE_URL="http://127.0.0.1:6806"
export SIYUAN_TOKEN="your-api-token"
export SIYUAN_DEFAULT_NOTEBOOK="your-notebook-id"
export SIYUAN_PERMISSION_MODE="all"
export SIYUAN_NOTEBOOK_LIST="notebook-id1,notebook-id2"
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
5. **增量索引**：`index` 命令默认启用增量索引，只索引有变化的文档；使用 `--force` 强制重建或 `--no-incremental` 禁用增量

---

# 参考文档

- [思源笔记 API 文档](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md) - 官方 API 参考文档
- [思源笔记用户指南](https://github.com/siyuan-note/siyuan/blob/master/README_zh_CN.md) - 官方用户指南
