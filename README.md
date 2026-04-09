# Siyuan Skill

[![GitHub](https://img.shields.io/badge/GitHub-Source-green.svg)](https://github.com/dazexcl/siyuan-skill)
[![Version](https://img.shields.io/badge/version-2.1.0-blue.svg)](https://github.com/dazexcl/siyuan-skill)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/dazexcl/siyuan-skill)
[![Node](https://img.shields.io/badge/node->=14-green.svg)](https://github.com/dazexcl/siyuan-skill)
[![Features](https://img.shields.io/badge/features-Vector%20Search-blue.svg)](https://github.com/dazexcl/siyuan-skill)
[![Features](https://img.shields.io/badge/features-NLP-orange.svg)](https://github.com/dazexcl/siyuan-skill)

> **思源笔记命令行工具** - 为 AI Agent 和人类用户提供笔记本管理、文档操作、内容搜索、块控制等功能。

`纯Node环境` `无外部依赖` `开箱即用` `Agent友好` `灵活拔插` `黑白名单` `渐进式披露`

## 功能概述

- **文档管理**：创建、更新、删除、移动、重命名文档
- **块操作**：精确控制文档块的增删改查
- **搜索功能**：关键词搜索、语义搜索、混合搜索
- **权限控制**：基于笔记本的白名单/黑名单管理
- **删除保护**：多层保护机制防止误删除
- **向量索引**：支持语义搜索（需配置 Qdrant）
- **NLP 分析**：本地化文本分析（实验性功能）

## 版本更新

### v2.0.0 重大重构

**核心变更**：
- **架构重构**：从统一入口 `siyuan.js` 改为独立脚本 `scripts/` 目录
- **目录重组**：优化项目结构，移除复杂管理器层级
- **代码简化**：净减少 10,906 行代码（+7,146 / -18,052）
- **命令变更**：所有命令通过 `node scripts/<command>.js` 执行

**主要优势**：
- 简化架构，移除复杂管理器
- 独立脚本，每个功能对应可执行文件
- 减少依赖，移除 Jest 测试框架
- 优化文档，提升实用性

**破坏性变更**：
- 命令执行方式变更：`node siyuan.js` → `node scripts/<command>.js`
- 全局 `siyuan` 命令移除
- 测试框架从 Jest 迁移到自定义框架

> 📋 详细变更内容参见：[升级日志](CHANGELOG.md)

### v2.1.0 检索功能统一优化

**核心改进**：
- **数据结构统一**：所有搜索模式（SQL/语义/混合/重排）返回统一格式
- **字段命名标准化**：统一使用 `notebookId`，废弃 `box` 字段
- **分数结构优化**：引入结构化 `scores` 对象，清晰展示各类分数
- **顶层分数字段**：添加顶层 `score` 字段，方便快速访问主要分数
- **新增 ScoreCalculator**：专门的分数计算类，统一分数计算逻辑
- **搜索来源标识**：每个结果包含 `source` 字段（sql/vector/hybrid）

**主要优势**：
- 消除字段不一致问题，提高代码可维护性
- 统一的分数结构，便于理解和扩展
- 向后兼容，保留旧字段逐步迁移
- 完善的单元测试，确保功能稳定性

**数据结构示例**：
```javascript
{
  id: "文档ID",
  score: 0.6327913679999999,    // 顶层主要分数（方便访问）
  notebookId: "笔记本ID",
  content: "内容",
  title: "标题",
  source: "sql",                // 搜索来源
  scores: {
    relevance: 0.015687263556116014,  // 相关性分数
    vector: 0.6327913679999999,       // 向量搜索分数（已组合）
    sql: null,                         // SQL搜索分数
    rerank: 0.85,                      // 重排分数
    final: 0.83                        // 最终综合分数
  }
}
```

> 📋 详细使用指南：[向量搜索文档](references/advanced/vector-search.md) | [基础用法示例](examples/basic-usage.md)

## 运行要求

| 要求          | 版本        | 说明                                   |
| ----------- | --------- | ------------------------------------ |
| **Node.js** | >= 14.0.0 | 必需                                   |
| **思源笔记**    | >= 3.6.0  | 运行中的本地实例（推荐 `http://localhost:6806`） |

## 快速开始

### 1. 安装 Skill

```bash
# 克隆仓库到 Skills 目录
cd ~/skills
git clone https://github.com/dazexcl/siyuan-skill.git
cd siyuan-skill

# 验证安装
node scripts/notebooks.js
```

### 2. 获取凭证

```bash
# 获取 API Token：打开思源笔记 → 设置 → 关于
# 获取笔记本 ID
```

### 3. 配置环境变量

```bash
export SIYUAN_BASE_URL="http://localhost:6806"
export SIYUAN_TOKEN="你的 API token"
export SIYUAN_DEFAULT_NOTEBOOK="默认笔记本 ID"
```

### 4. 验证连接

```bash
node scripts/notebooks.js
```

## 使用方法

### 运行方式

```bash
# 方式1：进入技能目录运行
cd skills/siyuan-skill
node scripts/<command> [options]

# 方式2：直接指定路径运行
node <skills-directory>/siyuan-skill/scripts/<command> [options]
```

### 常用命令

#### 笔记本与文档操作

```bash
# 查看笔记本列表
node scripts/notebooks.js

# 查看文档结构
node scripts/structure.js <notebookId>

# 获取文档内容
node scripts/content.js <docId>

# 创建文档
node scripts/create.js "文档标题" --parent-id <parentId>
node scripts/create.js --path "/笔记本/目录/文档名" --content "内容"

# 更新文档
node scripts/update.js <docId> --content "新内容"

# 删除文档
node scripts/delete.js <docId>

# 移动文档
node scripts/move.js <docId> <targetParentId>

# 重命名文档
node scripts/rename.js <docId> "新标题"
```

#### 块操作

```bash
# 获取块信息
node scripts/block-get.js <blockId>

# 插入块
node scripts/block-insert.js <parentId> "块内容"

# 更新块
node scripts/block-update.js <blockId> "新内容"

# 删除块
node scripts/block-delete.js <blockId>

# 移动块
node scripts/block-move.js <blockId> --previous-id <targetId>
```

#### 搜索与索引

```bash
# 关键词搜索
node scripts/search.js "关键词"

# 语义搜索（需配置向量服务）
node scripts/search.js "查询内容" --mode semantic

# 混合搜索
node scripts/search.js "查询内容" --mode hybrid

# 启用重排
node scripts/search.js "查询内容" --mode hybrid --enable-rerank

# 权重调整
node scripts/search.js "查询内容" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2

# 向量索引
node scripts/index.js
node scripts/index.js --notebook <notebookId>
node scripts/index.js --force
```

> 📋 详细搜索说明：[向量搜索文档](references/advanced/vector-search.md)

#### 属性与标签

```bash
# 设置块属性
node scripts/block-attrs.js <blockId> --set "key=value"

# 管理标签
node scripts/tags.js <blockId> --add "标签1,标签2"
node scripts/tags.js <blockId> --get
```

## 配置说明

### 快速配置

创建 `config.json` 文件：

```json
{
  "baseURL": "http://localhost:6806",
  "token": "your-api-token-here",
  "defaultNotebook": "your-notebook-id-here"
}
```

### 环境变量（可选）

也可以使用环境变量配置：

```bash
SIYUAN_BASE_URL="http://localhost:6806"
SIYUAN_TOKEN="your-api-token-here"
SIYUAN_DEFAULT_NOTEBOOK="your-notebook-id-here"
```

> 📋 完整配置说明参见：[配置文档](references/config/advanced.md)

## 核心特性

### 权限管理

支持三种权限模式：

| 模式          | 说明         | 适用场景    |
| ----------- | ---------- | ------- |
| `all`       | 无限制访问所有笔记本 | 开发/测试环境 |
| `whitelist` | 只允许访问指定笔记本 | 生产环境    |
| `blacklist` | 禁止访问指定笔记本  | 受限访问    |

> 🔒 详细权限说明参见：[权限管理文档](references/advanced/permission.md)

### 删除保护

多层保护机制：

1. **全局安全模式** - 默认启用，禁止所有删除操作
2. **文档保护标记** - 通过 `protect` 命令设置
3. **删除确认机制** - 需要确认文档标题

```bash
# 设置文档保护
node scripts/protect.js <docId> --enable

# 移除文档保护
node scripts/protect.js <docId> --remove
```

> 📋 详细说明参见：[删除保护文档](references/advanced/delete-protection.md)

### 向量搜索

支持语义搜索和混合搜索，需要配置 Qdrant 和 Ollama：

```bash
# 部署 Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

# 拉取 Embedding 模型
ollama pull nomic-embed-text

# 索引文档
node scripts/index.js --notebook <notebookId>

# 语义搜索
node scripts/search.js "查询内容" --mode semantic
```

> 📋 详细配置参见：[向量搜索文档](references/advanced/vector-search.md)

## 文档参考

### 快速入门

- [基础用法示例](examples/basic-usage.md) - 常用命令示例
- [文档工作流](examples/document-workflow.md) - 文档操作完整流程
- [块操作指南](examples/block-operations.md) - 块级操作详解

### 详细文档

- [快速参考](references/quick-reference.md) - 命令决策表和常见错误预防
- [配置说明](references/config/setup.md) - 环境变量和配置文件
- [高级配置](references/config/advanced.md) - 完整配置选项
- [安全文档](references/advanced/security.md) - 安全最佳实践
- [最佳实践](references/advanced/best-practices.md) - 使用建议和技巧
- [书写规范](references/advanced/writing-guide.md) - 内容书写规范

### 功能文档

- [向量搜索](references/advanced/vector-search.md) - 向量搜索配置和使用
- [删除保护](references/advanced/delete-protection.md) - 删除保护机制说明
- [使用指南](references/advanced/usage-guide.md) - 故障排除和安全审计

### API 参考

- [思源笔记 API](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md) - 官方 API 文档

## 常见问题

### 连接问题

| 错误                | 原因       | 解决方案            |
| ----------------- | -------- | --------------- |
| `ECONNREFUSED`    | 服务未启动    | 检查思源笔记是否运行      |
| `401 Unauthorized` | Token 无效 | 检查 `SIYUAN_TOKEN` |

### 操作问题

| 问题              | 原因       | 解决方案                  |
| --------------- | -------- | --------------------- |
| 删除被阻止          | 安全模式     | 修改配置或使用 `protect.js --remove` |
| 文档已存在          | 重名检测     | 使用 `--force` 参数强制创建     |
| 权限不足           | 权限模式限制   | 检查权限配置和笔记本白名单          |

### 向量搜索问题

| 问题                  | 原因       | 解决方案            |
| ------------------- | -------- | --------------- |
| 语义搜索不工作          | 服务未配置    | 配置 `QDRANT_URL` 和 `OLLAMA_BASE_URL` |
| 索引失败              | Embedding 服务未启动 | 检查 Ollama 服务状态 |

## 安全建议

- 仅连接本地实例 `http://localhost:6806`
- 妥善保管 API Token
- 生产环境使用白名单权限模式
- 启用删除保护机制

> 🔒 详细安全信息参见：[安全文档](references/advanced/security.md)

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请提交 [Issue](https://github.com/dazexcl/siyuan-skill/issues)。
