# 使用指南

本文档包含故障排除和安全审计说明。

> 📋 书写规范请参考 [书写指南](writing-guide.md)

---

## 故障排除

### 常见错误

| 错误 | 原因 | 解决方案 |
| --- | --- | --- |
| `ECONNREFUSED` | 服务未启动 | 检查思源笔记是否运行 |
| `401 Unauthorized` | Token 无效 | 检查 `SIYUAN_TOKEN` |
| `404 Not Found` | 文档不存在 | 检查 ID 或路径 |
| `403 Forbidden` | 权限不足 | 检查权限模式配置 |
| `删除被阻止` | 安全模式 | 配置 `deleteProtection` |
| `Qdrant API 错误: 409 Conflict` | 集合已存在 | 系统会继续使用现有集合 |

### 调试模式

```bash
# 启用调试输出
DEBUG=* node siyuan.js <command>
```

### 连接测试

```bash
# 测试 API 连接
node siyuan.js notebooks
```

---

## 安全审计

本工具完全开源，欢迎审计：

- **主要源码**：`connector.js`, `config.js`, `index.js`, `siyuan.js`
- **TLS 证书验证**：默认启用
- **日志脱敏**：Token/密码自动隐藏

### 安全建议

- 仅连接本地实例 `http://localhost:6806`
- 不要在公网环境暴露 API Token
- 生产环境推荐使用 `whitelist` 权限模式
