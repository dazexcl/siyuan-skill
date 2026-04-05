# 安全配置

## 删除保护

**默认禁止删除文档**。如需启用删除功能，**必须由用户手动**在 `config.json` 中配置。

> ⚠️ **Agent 禁止自动修改此配置**

### 保护层级

1. **全局安全模式** - `SIYUAN_DELETE_SAFE_MODE` 环境变量控制
2. **文档保护标记** - 通过 `protect` 命令设置
3. **删除确认机制** - `SIYUAN_DELETE_REQUIRE_CONFIRMATION` 控制

> 💡 如删除被阻止，应告知用户修改配置或使用 `protect --remove` 移除文档保护标记

## 配置只读保护

本技能采用**配置只读**设计原则：

- 所有敏感配置（token、API 密钥等）**仅通过环境变量或 config.json 读取**
- 技能本身**不提供任何配置写入能力**
- 配置变更需要用户**手动修改**环境变量或配置文件

## Token 处理

- `SIYUAN_TOKEN` **仅从环境变量或 config.json 读取**
- 技能本身**绝不修改或写入 token**
- Token 变更需要用户手动操作

## 连接安全

- 推荐仅使用本地实例 (`http://localhost:6806`)
- 推荐使用 `whitelist` 权限模式
- 如需远程连接，确保网络隔离

## 可选功能安全

- `QDRANT_URL`、`OLLAMA_BASE_URL` 为**可选配置**
- 如不需要向量搜索/NLP 功能，**无需配置**这些变量
- 不配置时，技能将使用基础的 SQL 搜索模式

## 环境变量一览

| 变量 | 必需 | 说明 |
|------|------|------|
| `SIYUAN_BASE_URL` | ✅ | API 地址 |
| `SIYUAN_TOKEN` | ✅ | API 令牌 |
| `SIYUAN_DEFAULT_NOTEBOOK` | ✅ | 默认笔记本ID |
| `SIYUAN_TIMEOUT` | ❌ | 请求超时（ms） |
| `SIYUAN_PERMISSION_MODE` | ❌ | 权限模式 |
| `SIYUAN_DELETE_SAFE_MODE` | ❌ | 删除安全模式 |
| `SIYUAN_DELETE_REQUIRE_CONFIRMATION` | ❌ | 删除确认 |
| `QDRANT_URL` | ❌ | 向量数据库地址 |
| `OLLAMA_BASE_URL` | ❌ | Ollama API 地址 |
