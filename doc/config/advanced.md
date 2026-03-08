# 高级配置

思源笔记命令行工具的高级配置选项。

## 配置文件结构

完整的 `config.json` 配置文件示例：

```json
{
  "baseURL": "http://127.0.0.1:6806",
  "token": "your-api-token-here",
  "timeout": 10000,
  "defaultNotebook": "your-notebook-id-here",
  "defaultFormat": "markdown",
  "permissionMode": "all",
  "notebookList": [],
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
    "batchSize": 8,
    "baseUrl": "http://127.0.0.1:11434"
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

### 1. 基础连接配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `baseURL` | string | ✅ | `http://127.0.0.1:6806` | 思源笔记 API 地址 |
| `token` | string | ✅ | `""` | API 认证令牌 |
| `timeout` | number | ❌ | `10000` | 请求超时时间（毫秒） |

### 2. 默认值配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `defaultNotebook` | string | ❌ | `null` | 默认笔记本 ID |
| `defaultFormat` | string | ❌ | `markdown` | 默认输出格式（markdown/text/html） |

### 3. 权限配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `permissionMode` | string | ❌ | `all` | 权限模式：`all`/`whitelist`/`blacklist` |
| `notebookList` | array | ❌ | `[]` | 笔记本 ID 列表 |

**权限模式说明**：
- `all` - 无限制访问所有笔记本
- `whitelist` - 只允许访问 `notebookList` 中的笔记本
- `blacklist` - 禁止访问 `notebookList` 中的笔记本

### 4. 功能配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `enableCache` | boolean | ❌ | `true` | 是否启用缓存 |
| `enableSync` | boolean | ❌ | `false` | 是否启用同步 |
| `enableLogging` | boolean | ❌ | `true` | 是否启用日志 |
| `debugMode` | boolean | ❌ | `false` | 是否启用调试模式 |

### 5. Qdrant 向量数据库配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `qdrant.url` | string | ❌ | `null` | Qdrant 服务地址 |
| `qdrant.apiKey` | string | ❌ | `""` | Qdrant API 密钥 |
| `qdrant.collectionName` | string | ❌ | `siyuan_notes` | 集合名称 |

### 6. Embedding 模型配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `embedding.model` | string | ❌ | `nomic-embed-text` | Embedding 模型名称 |
| `embedding.dimension` | number | ❌ | `768` | 向量维度 |
| `embedding.batchSize` | number | ❌ | `8` | 批处理大小 |
| `embedding.baseUrl` | string | ❌ | `null` | Embedding 服务地址 |

### 7. 混合搜索配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `hybridSearch.denseWeight` | number | ❌ | `0.7` | 语义搜索权重（0-1） |
| `hybridSearch.sparseWeight` | number | ❌ | `0.3` | 关键词搜索权重（0-1） |
| `hybridSearch.limit` | number | ❌ | `20` | 搜索结果数量限制 |

**说明**：`denseWeight + sparseWeight` 应该等于 1。

### 8. NLP 配置

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|---------|------|--------|----------|------|
| `nlp.language` | string | ❌ | `zh` | NLP 语言（zh/en） |
| `nlp.extractEntities` | boolean | ❌ | `true` | 是否提取实体 |
| `nlp.extractKeywords` | boolean | ❌ | `true` | 是否提取关键词 |

## 配置验证

### 验证配置文件

```bash
# 验证配置文件格式
node -e "console.log(JSON.parse(require('fs').readFileSync('config.json', 'utf8')))"

# 测试连接
siyuan notebooks
```

### 常见配置错误

1. **JSON 格式错误**
```json
// 错误：缺少逗号
{
  "baseURL": "http://127.0.0.1:6806"
  "token": "your-token"
}

// 正确
{
  "baseURL": "http://127.0.0.1:6806",
  "token": "your-token"
}
```

2. **路径格式错误**
```json
// 错误：Windows 路径使用反斜杠
{
  "baseURL": "http:\\127.0.0.1:6806"
}

// 正确：使用正斜杠
{
  "baseURL": "http://127.0.0.1:6806"
}
```

3. **类型错误**
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

## 配置最佳实践

1. **敏感信息**：Token 等敏感信息建议使用环境变量
2. **配置备份**：定期备份配置文件
3. **版本控制**：将配置文件加入 .gitignore
4. **配置验证**：修改配置后验证格式和连接
5. **权限控制**：生产环境建议使用 whitelist 或 blacklist 模式

## 相关文档
- [环境变量配置](environment.md)
- [最佳实践](../advanced/best-practices.md)
- [向量搜索配置](../advanced/vector-search.md)
