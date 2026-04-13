# 规范文档索引

本文档提供 siyuan-skill 所有规范文档的快速导航。

## 📋 必读文档（Agent 首次使用）

| 文档 | 位置 | 内容 | 优先级 |
|------|------|------|--------|
| **SKILL.md** | 根目录 | 核心规则、快速开始、关键限制 | ⭐⭐⭐ |
| **格式标准** | [format-standard.md](format-standard.md) | 内部链接、块语法、排版、嵌入块 | ⭐⭐⭐ |
| **快速参考** | [quick-reference.md](quick-reference.md) | 命令决策表、ID类型区分、错误预防 | ⭐⭐⭐ |
| **问题解决索引** | [troubleshooting.md](troubleshooting.md) | 按错误信息和任务场景的问题索引 | ⭐⭐⭐ |

## 🔧 配置文档

| 文档 | 位置 | 内容 |
|------|------|------|
| 环境变量 | [config/environment.md](config/environment.md) | 环境变量说明 |
| 基础配置 | [config/setup.md](config/setup.md) | config.json 配置文件 |
| 高级配置 | [config/advanced.md](config/advanced.md) | 完整配置选项 |

## 🚀 进阶文档

| 文档 | 位置 | 内容 |
|------|------|------|
| 最佳实践 | [advanced/best-practices.md](advanced/best-practices.md) | 使用建议和技巧 |
| 使用指南 | [advanced/usage-guide.md](advanced/usage-guide.md) | 故障排除和安全审计 |
| 安全文档 | [advanced/security.md](advanced/security.md) | 安全最佳实践 |
| 删除保护 | [advanced/delete-protection.md](advanced/delete-protection.md) | 删除保护机制 |
| 向量搜索 | [advanced/vector-search.md](advanced/vector-search.md) | 语义搜索配置 |
| 脚本规范 | [advanced/script-guidelines.md](advanced/script-guidelines.md) | 脚本编写规范 |

## 📖 示例文档

| 文档 | 位置 | 内容 |
|------|------|------|
| 基础用法 | [examples/basic-usage.md](../examples/basic-usage.md) | 常用命令示例 |
| 文档工作流 | [examples/document-workflow.md](../examples/document-workflow.md) | 文档操作完整流程 |
| 块操作指南 | [examples/block-operations.md](../examples/block-operations.md) | 块级操作详解 |

## 🎯 快速查找

### 我想...

| 需求 | 查看文档 |
|------|---------|
| 了解如何使用这个 Skill | [SKILL.md](../SKILL.md) |
| 查看命令列表和用法 | [quick-reference.md](quick-reference.md) |
| 确认内部链接格式 | [format-standard.md](format-standard.md#引用语法) |
| 了解如何配置 | [config/setup.md](config/setup.md) |
| 解决连接问题 | [config/setup.md](config/setup.md#连接配置) |
| 解决权限问题 | [config/setup.md](config/setup.md#权限配置) |
| 解决搜索问题 | [advanced/vector-search.md](advanced/vector-search.md) |
| 解决删除问题 | [advanced/delete-protection.md](advanced/delete-protection.md) |
| 查看最佳实践 | [advanced/best-practices.md](advanced/best-practices.md) |
| 遇到错误不知道怎么解决 | [troubleshooting.md](troubleshooting.md) |

### 按问题类型查找

| 问题类型 | 查看文档 |
|---------|---------|
| 权限与连接问题 | [troubleshooting.md - 权限与连接问题](troubleshooting.md#权限与连接问题) |
| 文档操作问题 | [troubleshooting.md - 文档操作问题](troubleshooting.md#文档操作问题) |
| 内容格式问题 | [troubleshooting.md - 内容格式问题](troubleshooting.md#内容格式问题) |
| 搜索与索引问题 | [troubleshooting.md - 搜索与索引问题](troubleshooting.md#搜索与索引问题) |
| 块操作问题 | [troubleshooting.md - 块操作问题](troubleshooting.md#块操作问题) |
| 配置问题 | [troubleshooting.md - 配置问题](troubleshooting.md#配置问题) |

### 按错误信息查找

| 错误信息关键字 | 查看文档 |
|-------------|---------|
| `ECONNREFUSED` | [config/setup.md - 连接配置](config/setup.md#连接配置) |
| `401 Unauthorized` | [config/setup.md - 认证配置](config/setup.md#认证配置) |
| `权限不足` | [config/setup.md - 权限配置](config/setup.md#权限配置) |
| `安全模式已启用` | [advanced/delete-protection.md](advanced/delete-protection.md) |
| `文档已存在` | [quick-reference.md - 常见错误与解决](quick-reference.md#常见错误与解决) |
| `参数类型错误` | [quick-reference.md - ID 类型区分](quick-reference.md#id-类型区分) |
| `Qdrant 连接失败` | [advanced/vector-search.md - 环境配置](advanced/vector-search.md#环境配置) |
| `Ollama 服务不可用` | [advanced/vector-search.md - 环境配置](advanced/vector-search.md#环境配置) |

---

**提示**：所有文档路径相对于 `references/` 目录，根目录文档（如 SKILL.md）需要使用 `../` 前缀
