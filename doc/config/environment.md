# 环境变量配置

环境变量配置优先级最高，可以覆盖配置文件中的设置。

## 概述

### 基础连接配置

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `SIYUAN_BASE_URL` | 思源笔记 API 地址 | `http://127.0.0.1:6806` |
| `SIYUAN_TOKEN` | API 认证令牌 | `your-api-token` |
| `SIYUAN_TIMEOUT` | 请求超时时间（毫秒） | `10000` |

### 默认值配置

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `SIYUAN_DEFAULT_NOTEBOOK` | 默认笔记本 ID | `20260227231831-yq1lxq2` |
| `SIYUAN_DEFAULT_FORMAT` | 默认输出格式 | `markdown` |

### 权限配置

| 环境变量 | 说明 | 可选值 |
|---------|------|--------|
| `SIYUAN_PERMISSION_MODE` | 权限模式 | `all` / `whitelist` / `blacklist` |
| `SIYUAN_NOTEBOOK_LIST` | 笔记本 ID 列表 | `id1,id2,id3` 或 `["id1","id2"]` |

### 功能配置

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `SIYUAN_ENABLE_CACHE` | 是否启用缓存 | `true` / `false` |
| `SIYUAN_ENABLE_SYNC` | 是否启用同步 | `true` / `false` |
| `SIYUAN_ENABLE_LOGGING` | 是否启用日志 | `true` / `false` |
| `SIYUAN_DEBUG_MODE` | 是否启用调试模式 | `true` / `false` |
| `SIYUAN_CACHE_EXPIRY` | 缓存过期时间（毫秒） | `300000` |

### 向量搜索配置

| 环境变量 | 说明 | 示例 |
|---------|------|------|
| `QDRANT_URL` | Qdrant 服务地址 | `http://127.0.0.1:6333` |
| `QDRANT_API_KEY` | Qdrant API 密钥 | `your-api-key` |
| `QDRANT_COLLECTION_NAME` | 集合名称 | `siyuan_notes` |
| `OLLAMA_BASE_URL` | Ollama 服务地址 | `http://127.0.0.1:11434` |
| `OLLAMA_EMBED_MODEL` | Embedding 模型名称 | `nomic-embed-text` |

## 配置示例

### Bash / Zsh

```bash
# 基础配置
export SIYUAN_BASE_URL="http://127.0.0.1:6806"
export SIYUAN_TOKEN="your-api-token"
export SIYUAN_DEFAULT_NOTEBOOK="20260227231831-yq1lxq2"

# 权限配置（白名单模式）
export SIYUAN_PERMISSION_MODE="whitelist"
export SIYUAN_NOTEBOOK_LIST="20260227231831-yq1lxq2,20260308012748-i6sgf0p"

# 向量搜索配置
export QDRANT_URL="http://127.0.0.1:6333"
export OLLAMA_BASE_URL="http://127.0.0.1:11434"
export OLLAMA_EMBED_MODEL="nomic-embed-text"
```

### PowerShell

```powershell
# 基础配置
$env:SIYUAN_BASE_URL="http://127.0.0.1:6806"
$env:SIYUAN_TOKEN="your-api-token"
$env:SIYUAN_DEFAULT_NOTEBOOK="20260227231831-yq1lxq2"

# 权限配置（白名单模式）
$env:SIYUAN_PERMISSION_MODE="whitelist"
$env:SIYUAN_NOTEBOOK_LIST="20260227231831-yq1lxq2,20260308012748-i6sgf0p"
```

### 配置文件（config.json）

```json
{
  "baseURL": "http://127.0.0.1:6806",
  "token": "your-api-token",
  "timeout": 10000,
  "defaultNotebook": "20260227231831-yq1lxq2",
  "defaultFormat": "markdown",
  "permissionMode": "whitelist",
  "notebookList": ["20260227231831-yq1lxq2"],
  "enableCache": true,
  "enableSync": false,
  "enableLogging": true,
  "debugMode": false,
  "qdrant": {
    "url": "http://127.0.0.1:6333",
    "apiKey": "",
    "collectionName": "siyuan_notes"
  },
  "embedding": {
    "model": "nomic-embed-text",
    "dimension": 768,
    "batchSize": 10,
    "baseUrl": "http://127.0.0.1:11434"
  }
}
```

## 配置优先级

1. **环境变量**（最高）- `SIYUAN_*` 系列环境变量
2. **配置文件** - `config.json`
3. **默认配置**（最低）- 代码中的默认值

## 获取配置信息

1. 打开思源笔记 → 设置 → 关于 → 复制 API Token
2. 使用 `siyuan notebooks` 获取笔记本 ID

## SIYUAN_NOTEBOOK_LIST 格式说明

支持多种格式：

```bash
# 逗号分隔（推荐）
SIYUAN_NOTEBOOK_LIST="id1,id2,id3"

# JSON 数组
SIYUAN_NOTEBOOK_LIST='["id1","id2","id3"]'

# 单个 ID
SIYUAN_NOTEBOOK_LIST="id1"
```
