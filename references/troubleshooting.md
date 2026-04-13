# 问题解决索引

本文档按**问题类型**组织，帮助你快速找到解决方案。

## 🔴 权限与连接问题

### 问题：连接失败 `ECONNREFUSED`

**错误信息**：
```
错误: 连接思源笔记失败: connect ECONNREFUSED 127.0.0.1:6806
```

**原因**：思源笔记未运行或地址配置错误

**解决方案**：
1. 确认思源笔记正在运行
2. 检查 `SIYUAN_BASE_URL` 配置
3. 详细排查：[配置说明 - 连接配置](config/setup.md#连接配置)

---

### 问题：认证失败 `401 Unauthorized`

**错误信息**：
```
错误: 401 Unauthorized
```

**原因**：API Token 无效

**解决方案**：
1. 在思源笔记中重新获取 API Token（设置 → 关于）
2. 更新 `SIYUAN_TOKEN` 环境变量
3. 详细配置：[配置说明 - 认证配置](config/setup.md#认证配置)

---

### 问题：权限不足

**错误信息**：
```
错误: 权限不足
错误: 笔记本不在白名单中
```

**原因**：权限模式限制

**解决方案**：
1. 检查 `SIYUAN_PERMISSION_MODE` 配置
2. 如果是 `whitelist`，添加笔记本到 `SIYUAN_NOTEBOOK_LIST`
3. 详细配置：[配置说明 - 权限配置](config/setup.md#权限配置)

---

## 🟡 文档操作问题

### 问题：删除被阻止

**错误信息**：
```
错误: 全局安全模式已启用，禁止删除任何文档
```

**原因**：删除保护机制已启用

**解决方案**：
1. 确认是否真的需要删除（生产环境建议保留保护）
2. 修改 `config.json` 中的 `deleteProtection` 配置
3. 使用 `protect.js --remove` 移除文档保护标记
4. 详细说明：[删除保护文档](advanced/delete-protection.md)

---

### 问题：文档已存在

**错误信息**：
```
错误: 文档 "/笔记本/文档名" 已存在 (ID: xxx)，使用 --force 强制创建
```

**原因**：路径下已存在同名文档

**解决方案**：
1. 检查是否真的需要创建新文档
2. 如果是更新现有文档，使用 `update.js` 命令
3. 如果必须创建，使用 `--force` 参数强制创建
4. 详细说明：[快速参考 - 常见错误与解决](quick-reference.md#常见错误与解决)

---

### 问题：ID 类型错误

**错误信息**：
```
错误: 参数类型错误
错误: 传入的ID是子块，不是文档。请使用 block-update 命令更新块内容
```

**原因**：混淆了文档 ID 和块 ID

**解决方案**：
1. 确认你要操作的是文档还是块
2. 文档操作用 `update.js` / `delete.js` / `move.js` / `rename.js`
3. 块操作用 `block-update.js` / `block-delete.js` / `block-move.js`
4. 详细说明：[快速参考 - ID 类型区分](quick-reference.md#id-类型区分)

---

### 问题：需要确认文档标题

**错误信息**：
```
错误: 需要确认文档标题
请使用 --confirm-title "文档标题" 确认删除
```

**原因**：删除保护机制要求确认标题

**解决方案**：
1. 获取文档标题：`info.js <docId>`
2. 使用确认标题删除：`delete.js <docId> --confirm-title "文档标题"`
3. 或修改配置关闭确认要求
4. 详细说明：[删除保护文档](advanced/delete-protection.md)

---

### 问题：文档被保护

**错误信息**：
```
错误: 该文档已被保护，无法删除
```

**原因**：文档设置了保护标记

**解决方案**：
1. 使用 `protect.js <docId> --remove` 移除保护标记
2. 详细说明：[删除保护文档](advanced/delete-protection.md)

---

## 🟢 内容格式问题

### 问题：内部链接格式错误

**现象**：创建的文档中，链接无法点击或显示为普通文本

**原因**：使用了标准 Markdown 链接格式，而非思源笔记的内部链接格式

**解决方案**：
1. 正确格式：`((id "锚文本"))`
2. 错误格式：`[文本](id)`
3. 详细说明：[格式标准 - 引用语法](format-standard.md#引用语法)

---

### 问题：内容格式混乱

**现象**：所有内容在一行，没有换行或段落分隔

**原因**：没有使用正确的换行符

**解决方案**：
1. 换行使用 `\\n`
2. 段落分隔使用 `\\n\\n`
3. 详细说明：[格式标准 - 换行规则](format-standard.md#换行规则)

---

### 问题：块属性格式错误

**现象**：设置的块属性不生效

**原因**：属性格式不正确

**解决方案**：
1. 正确格式：`内容{: name="命名" alias="别名" memo="备注"}`
2. 详细说明：[格式标准 - 内容块属性](format-standard.md#内容块属性)

---

## 🔵 搜索与索引问题

### 问题：语义搜索不工作

**错误信息**：
```
错误: Qdrant 连接失败
错误: Ollama 服务不可用
```

**原因**：向量服务未配置或未启动

**解决方案**：
1. 检查 `QDRANT_URL` 和 `OLLAMA_BASE_URL` 配置
2. 确认 Qdrant 和 Ollama 服务正在运行
3. 拉取 Embedding 模型：`ollama pull nomic-embed-text`
4. 详细配置：[向量搜索文档 - 环境配置](advanced/vector-search.md#环境配置)

---

### 问题：搜索结果不准确

**现象**：搜索结果与查询内容不相关

**原因**：搜索模式或权重配置不当

**解决方案**：
1. 尝试不同的搜索模式：`--mode keyword/semantic/hybrid`
2. 调整混合搜索权重：`--dense-weight` / `--sparse-weight`
3. 启用重排：`--enable-rerank`
4. 详细说明：[向量搜索文档 - 参数调优](advanced/vector-search.md#参数调优)

---

### 问题：索引失败

**错误信息**：
```
错误: 获取笔记本文档失败
错误: 获取文档的分块失败
```

**原因**：文档内容过长或结构复杂

**解决方案**：
1. 检查文档是否包含大量内容
2. 使用 `--max-depth` 限制递归深度
3. 详细说明：[向量搜索文档 - 索引配置](advanced/vector-search.md#索引配置)

---

## 🟣 块操作问题

### 问题：块更新失败

**错误信息**：
```
错误: 传入的ID是文档，不是块。请使用 update 命令更新文档内容
```

**原因**：使用了文档 ID 而非块 ID

**解决方案**：
1. 确认你要更新的是块还是整个文档
2. 获取块 ID：使用 `info.js <docId>` 查看块结构
3. 详细说明：[块操作指南](../examples/block-operations.md)

---

### 问题：块插入失败

**错误信息**：
```
错误: 无法插入块
```

**原因**：父 ID 不正确或权限不足

**解决方案**：
1. 确认父 ID 是有效的文档 ID 或块 ID
2. 检查权限配置
3. 详细说明：[块操作指南](../examples/block-operations.md)

---

## 🟠 配置问题

### 问题：配置文件未找到

**错误信息**：
```
错误: 找不到配置文件 config.json
```

**原因**：config.json 文件不存在

**解决方案**：
1. 复制 `assets/config-template.json` 为 `config.json`
2. 填写正确的配置信息
3. 详细说明：[配置说明 - 基础配置](config/setup.md#基础配置)

---

### 问题：环境变量未设置

**错误信息**：
```
错误: SIYUAN_TOKEN 未设置
```

**原因**：必需的环境变量未配置

**解决方案**：
1. 设置环境变量：`export SIYUAN_TOKEN="your-token"`
2. 或在 config.json 中配置
3. 详细说明：[配置说明 - 环境变量](config/environment.md)

---

## 📚 快速查找

### 按错误信息查找

| 错误信息关键字 | 查看文档 |
|-------------|---------|
| `ECONNREFUSED` | [配置说明 - 连接配置](config/setup.md#连接配置) |
| `401 Unauthorized` | [配置说明 - 认证配置](config/setup.md#认证配置) |
| `权限不足` | [配置说明 - 权限配置](config/setup.md#权限配置) |
| `安全模式已启用` | [删除保护文档](advanced/delete-protection.md) |
| `文档已存在` | [快速参考 - 常见错误与解决](quick-reference.md#常见错误与解决) |
| `参数类型错误` | [快速参考 - ID 类型区分](quick-reference.md#id-类型区分) |
| `Qdrant 连接失败` | [向量搜索文档 - 环境配置](advanced/vector-search.md#环境配置) |
| `Ollama 服务不可用` | [向量搜索文档 - 环境配置](advanced/vector-search.md#环境配置) |
| `配置文件未找到` | [配置说明 - 基础配置](config/setup.md#基础配置) |
| `环境变量未设置` | [配置说明 - 环境变量](config/environment.md) |

### 按任务场景查找

| 场景 | 查看文档 |
|------|---------|
| 首次使用 | [SKILL.md](../SKILL.md) |
| 创建文档 | [文档工作流示例](../examples/document-workflow.md) |
| 更新文档 | [基础用法示例](../examples/basic-usage.md#修改文档) |
| 搜索内容 | [向量搜索文档](advanced/vector-search.md) |
| 删除文档 | [删除保护文档](advanced/delete-protection.md) |
| 格式问题 | [格式标准](format-standard.md) |
| 权限问题 | [配置说明](config/setup.md) |
| 块操作 | [块操作指南](../examples/block-operations.md) |

---

> 💡 **提示**：如果你遇到的问题不在此列表中，请查看 [快速参考](quick-reference.md) 或 [规范索引](spec-index.md)
