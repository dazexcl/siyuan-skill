# 环境变量配置

配置思源笔记环境变量，优先级最高，## 禂述

- `SIyuan_base_url` - 思源笔记 API 地址
- `siyuan_token` - API 认证令牌
- `siyuan_default_notebook` - 默认笔记本 ID
- `siyuan_permission_mode` - 权限模式

- `siyuan_timeout` - 请求超时时间
- `siyuan_default_format` - 默认输出格式
- `siyuan_enable_cache` - 是否启用缓存
- `siyuan_enable_sync` - 是否启用同步
- `siyuan_enableLogging` - 是否启用日志
- `siyuan_debugMode` - 是否启用调试模式

- `siyuan_notebookList` - 笔记本 ID 列表（配合权限模式使用）
- `siyuan_cacheExpiry` - 缓存过期时间（毫秒）
- `siyuan_defaultPermissionMode` - 权限模式：all（无限制）、whitelist（白名单）、blacklist（黑名单）

## 配置示例

```json
{
  "baseURL": "http://127.0.0.1:6806",
  "token": "your-api-token-here",
  "timeout": 10000,
  "defaultNotebook": "your-notebook-id",
  "defaultFormat": "markdown",
  "permissionMode": "all",
  "notebookList": [],
  "enableCache": true,
  "enableSync": false,
  "enableLogging": true,
  "debugMode": false
}
```

**获取方式**：
1. 打开思源笔记 → 设置 → 关于 → 复制 API Token
2. 使用 `siyuan notebooks` 获取笔记本 ID

