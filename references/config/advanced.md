# config.json 配置文件

完整的配置文件结构和各配置项详解。

## 完整配置示例

```json
{
  "baseURL": "http://localhost:6806",
  "token": "your-api-token-here",
  "timeout": 10000,
  "defaultNotebook": "your-notebook-id-here",
  "permissionMode": "all",
  "notebookList": [],
  "deleteProtection": {
    "safeMode": true,
    "requireConfirmation": false
  },
  "tls": {
    "allowSelfSignedCerts": false,
    "allowedHosts": ["localhost"]
  },
  "qdrant": {
    "url": "http://localhost:6333",
    "apiKey": "",
    "collectionName": "siyuan_notes"
  },
  "embedding": {
    "model": "nomic-embed-text",
    "dimension": 768,
    "batchSize": 8,
    "baseUrl": "http://localhost:11434"
  },
  "hybridSearch": {
    "denseWeight": 0.7,
    "sparseWeight": 0.3,
    "limit": 20
  },
  "nlp": {
    "language": "zh",
    "extractEntities": true,
    "extractKeywords": true
  }
}
```

## 配置项详解

### 基础连接

| 配置项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `baseURL` | string | `http://localhost:6806` | API 地址 |
| `token` | string | `""` | API 令牌 |
| `timeout` | number | `10000` | 请求超时（毫秒） |

### 权限控制

| 配置项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `defaultNotebook` | string | `null` | 默认笔记本 ID |
| `permissionMode` | string | `all` | 权限模式：all/whitelist/blacklist |
| `notebookList` | array | `[]` | 笔记本 ID 列表 |

**权限模式说明**：
- `all` - 无限制
- `whitelist` - 仅允许列表中的笔记本
- `blacklist` - 禁止列表中的笔记本

### 删除保护

| 配置项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `deleteProtection.safeMode` | boolean | `true` | 安全模式（禁止删除） |
| `deleteProtection.requireConfirmation` | boolean | `false` | 删除确认 |

### TLS 安全

| 配置项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `tls.allowSelfSignedCerts` | boolean | `false` | 允许自签名证书 |
| `tls.allowedHosts` | array | `["localhost"]` | 允许自签名证书的主机 |

### 向量搜索（可选）

| 配置项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `qdrant.url` | string | `null` | Qdrant 地址 |
| `qdrant.apiKey` | string | `""` | Qdrant API 密钥 |
| `qdrant.collectionName` | string | `siyuan_notes` | 集合名称 |

### Embedding（可选）

| 配置项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `embedding.model` | string | `nomic-embed-text` | 模型名称 |
| `embedding.dimension` | number | `768` | 向量维度 |
| `embedding.batchSize` | number | `8` | 批处理大小 |
| `embedding.baseUrl` | string | `null` | Ollama 地址 |

### 混合搜索（可选）

| 配置项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `hybridSearch.denseWeight` | number | `0.7` | 语义权重 |
| `hybridSearch.sparseWeight` | number | `0.3` | 关键词权重 |
| `hybridSearch.limit` | number | `20` | 结果数量 |

> 注：`denseWeight + sparseWeight` 应等于 1

### NLP（可选）

| 配置项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `nlp.language` | string | `zh` | 语言（zh/en） |
| `nlp.extractEntities` | boolean | `true` | 提取实体 |
| `nlp.extractKeywords` | boolean | `true` | 提取关键词 |

## 配置验证

```bash
# 验证 JSON 格式
node -e "console.log(JSON.parse(require('fs').readFileSync('config.json', 'utf8')))"

# 测试连接
node scripts/notebooks.js
```

## 常见错误

### 1. JSON 格式错误

```json
// 错误：缺少逗号
{
  "baseURL": "http://localhost:6806"
  "token": "your-token"
}

// 正确
{
  "baseURL": "http://localhost:6806",
  "token": "your-token"
}
```

### 2. 路径格式错误

```json
// 错误：Windows 路径使用反斜杠
{
  "baseURL": "http:\\localhost:6806"
}

// 正确：使用正斜杠
{
  "baseURL": "http://localhost:6806"
}
```

### 3. 类型错误

```json
// 错误：数字使用字符串
{
  "timeout": "10000"
}

// 正确：使用数字类型
{
  "timeout": 10000
}
```

## 安全声明

### 配置只读保护

本技能采用**配置只读**设计原则。ConfigManager 不提供任何配置写入方法。

**安全设计**：
- 所有敏感配置（token、API密钥等）仅通过环境变量或 config.json 读取
- 技能本身不提供任何配置写入能力
- 配置变更需要用户手动修改环境变量或配置文件

### 环境变量优先级

| 环境变量 | 对应配置项 | 说明 |
|----------|-----------|------|
| `SIYUAN_BASE_URL` | `baseURL` | API 地址 |
| `SIYUAN_TOKEN` | `token` | API 令牌 |
| `SIYUAN_DEFAULT_NOTEBOOK` | `defaultNotebook` | 默认笔记本 |
| `SIYUAN_PERMISSION_MODE` | `permissionMode` | 权限模式 |
| `SIYUAN_NOTEBOOK_LIST` | `notebookList` | 笔记本列表 |

环境变量优先级高于配置文件，推荐使用环境变量管理敏感配置。

## 配置最佳实践

1. **敏感信息**：Token 等敏感信息建议使用环境变量
2. **配置备份**：定期备份配置文件
3. **配置验证**：修改配置后验证格式和连接
4. **权限控制**：生产环境建议使用 whitelist 或 blacklist 模式

## 相关文档
- [环境变量配置](environment.md)
- [最佳实践](../advanced/best-practices.md)
- [向量搜索配置](../advanced/vector-search.md)
