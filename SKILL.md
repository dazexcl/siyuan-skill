---
name: "siyuan-skill"
version: "1.5.0"
description: "思源笔记命令行工具，提供便捷的命令行操作方式，支持笔记本管理、文档操作、内容搜索、块控制等功能"
---
# 核心价值

**提供 AI Agent 可快速接入思源笔记的 skill 方案**

## 适用场景
✅ 团队规范、项目知识、可复用技能
✅ 需要多 Agent 共享的知识
✅ 需要长期存储和检索的内容

## 不适用场景
❌ 日常互动记录、个人学习反思
❌ 临时笔记、代码版本管理
❌ 实时协作编辑

---

# 重要约束

**必须使用 CLI 命令来操作思源笔记** 

**禁止自动修改配置文件与本技能相关环境变量配置** 

**禁止直接调用 API** 

**禁止使用脚本调用、引用 index.js** 

**禁止使用脚本调用、引用指令文件** 

**遇到问题优先查阅文档，禁止直接读取源码**

---

# 问题导向文档导航

> ⚠️ **重要**：遇到以下问题时，请直接查阅对应文档，不要读取源码

| 问题类型 | 查阅文档 | 说明 |
|----------|----------|------|
| 如何创建文档 | [doc/commands/create.md](doc/commands/create.md) | 创建命令详解 |
| 如何更新文档 | [doc/commands/update.md](doc/commands/update.md) | 更新命令详解 |
| 如何删除文档 | [doc/commands/delete.md](doc/commands/delete.md) | 删除命令详解 |
| 删除被阻止 | [doc/advanced/delete-protection.md](doc/advanced/delete-protection.md) | 删除保护机制 |
| 如何保护文档 | [doc/commands/protect.md](doc/commands/protect.md) | 文档保护命令 |
| 如何搜索内容 | [doc/commands/search.md](doc/commands/search.md) | 搜索命令详解 |
| 搜索结果不准确 | [doc/advanced/vector-search.md](doc/advanced/vector-search.md) | 向量搜索配置 |
| 块操作问题 | [doc/commands/block-control.md](doc/commands/block-control.md) | 块控制命令详解 |
| 配置环境变量 | [doc/config/environment.md](doc/config/environment.md) | 环境变量配置 |
| 高级配置 | [doc/config/advanced.md](doc/config/advanced.md) | 详细配置选项 |
| 使用最佳实践 | [doc/advanced/best-practices.md](doc/advanced/best-practices.md) | 最佳实践指南 |
| 命令参数说明 | `siyuan help <command>` | CLI 帮助命令 |

---

# 快速开始

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

# 查看特定命令帮助
siyuan help <command>
```

---

# 命令列表

**常用命令**：
| 命令 | 别名 | 说明 |
|------|------|------|
| `notebooks` | `nb` | 获取笔记本列表 |
| `create` | `new` | 创建文档 |
| `update` | `edit` | 更新文档 |
| `delete` | `rm` | 删除文档（受保护） |
| `protect` | - | 设置/移除文档保护 |
| `search` | `find` | 搜索内容 |
| `move` | `mv` | 移动文档 |
| `convert` | `path` | 转换 ID 和路径 |
| `index` | - | 索引到向量数据库 |
| `content` | `cat` | 获取文档内容 |

**块控制命令**：
| 命令 | 别名 | 说明 |
|------|------|------|
| `block-insert` | `bi` | 插入块 |
| `block-update` | `bu` | 更新块 |
| `block-delete` | `bd` | 删除块 |
| `block-move` | `bm` | 移动块 |
| `block-get` | `bg` | 获取块信息 |
| `block-attrs` | `ba` | 管理块属性 |
| `block-fold` | `bf` | 折叠/展开块 |

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

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `safeMode` | `true` | 禁止所有删除 |
| `requireConfirmation` | `false` | 删除需确认标题 |

**保护层级**：全局安全模式 → 文档保护标记 → 删除确认机制

---

# 更新方式选择

| 场景 | 推荐方式 |
|------|----------|
| 创建/重写文档 | `edit` 全文档更新 |
| 局部修改 | `bu` 块更新 ✅ |
| 保留块属性 | `bu` 块更新 ✅ |

**注意**：文档本身也是一种块，`edit` 和 `bu` 本质调用相同 API。

---

# 注意事项

1. **权限模式**：`all` / `whitelist` / `blacklist`
2. **缓存**：使用 `--force-refresh` 强制刷新
3. **向量搜索**：需部署 Qdrant + Ollama，否则回退 SQL 搜索

---

# 参考文档

- [思源笔记 API 文档](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)
- [思源笔记用户指南](https://github.com/siyuan-note/siyuan/blob/master/README_zh_CN.md)
- [命令详细文档](doc/commands/)
- [高级功能文档](doc/advanced/)
- [配置文档](doc/config/)
