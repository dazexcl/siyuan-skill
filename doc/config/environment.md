# 环境变量配置

环境变量配置优先级最高，可覆盖 `config.json` 中的设置。

## 必需环境变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `SIYUAN_BASE_URL` | 思源笔记 API 地址 | `http://localhost:6806` |
| `SIYUAN_TOKEN` | API 认证令牌 | 从思源设置中获取 |
| `SIYUAN_DEFAULT_NOTEBOOK` | 默认笔记本 ID | `20260227231831-yq1lxq2` |

## 可选环境变量

### 权限控制

| 变量 | 说明 | 可选值 |
|------|------|--------|
| `SIYUAN_PERMISSION_MODE` | 权限模式 | `all` / `whitelist` / `blacklist` |
| `SIYUAN_NOTEBOOK_LIST` | 笔记本 ID 列表 | `id1,id2,id3` |

### 功能开关

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SIYUAN_ENABLE_CACHE` | 启用缓存 | `true` |
| `SIYUAN_CACHE_EXPIRY` | 缓存过期时间（毫秒） | `300000` |
| `SIYUAN_DEBUG_MODE` | 调试模式 | `false` |

### 删除保护

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SIYUAN_DELETE_SAFE_MODE` | 安全模式（禁止删除） | `true` |
| `SIYUAN_DELETE_REQUIRE_CONFIRMATION` | 删除确认 | `false` |

### TLS 安全

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `SIYUAN_TLS_ALLOW_SELF_SIGNED` | 允许自签名证书 | `false` |
| `SIYUAN_TLS_ALLOWED_HOSTS` | 允许自签名证书的主机 | `localhost` |

### 向量搜索（可选）

| 变量 | 说明 | 示例 |
|------|------|------|
| `QDRANT_URL` | Qdrant 服务地址 | `http://localhost:6333` |
| `QDRANT_API_KEY` | Qdrant API 密钥 | `your-api-key` |
| `OLLAMA_BASE_URL` | Ollama 服务地址 | `http://localhost:11434` |
| `OLLAMA_EMBED_MODEL` | Embedding 模型 | `nomic-embed-text` |

## 配置示例

### Bash / Zsh

```bash
# 必需配置
export SIYUAN_BASE_URL="http://localhost:6806"
export SIYUAN_TOKEN="your-api-token"
export SIYUAN_DEFAULT_NOTEBOOK="20260227231831-yq1lxq2"

# 权限配置（白名单模式）
export SIYUAN_PERMISSION_MODE="whitelist"
export SIYUAN_NOTEBOOK_LIST="20260227231831-yq1lxq2"
```

### PowerShell

```powershell
$env:SIYUAN_BASE_URL="http://localhost:6806"
$env:SIYUAN_TOKEN="your-api-token"
$env:SIYUAN_DEFAULT_NOTEBOOK="20260227231831-yq1lxq2"
```

## 配置优先级

1. **环境变量**（最高）
2. **config.json 配置文件**
3. **代码默认值**（最低）

## 获取配置信息

1. API Token：思源笔记 → 设置 → 关于 → API Token
2. 笔记本 ID：`siyuan notebooks`

## SIYUAN_NOTEBOOK_LIST 格式

```bash
# 逗号分隔（推荐）
SIYUAN_NOTEBOOK_LIST="id1,id2,id3"

# JSON 数组
SIYUAN_NOTEBOOK_LIST='["id1","id2","id3"]'

# 单个 ID
SIYUAN_NOTEBOOK_LIST="id1"
```
