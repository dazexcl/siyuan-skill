# Siyuan Skill 安装说明

> 适用于通用 AI 工具（OpenClaw、Trae、Claude Desktop、Cursor 等）的 Skill 安装指南

***

## 前置条件

| 要求          | 版本        | 说明       |
| ----------- | --------- | -------- |
| **Node.js** | >= 14.0.0 | 必需       |
| **思源笔记**    | >= 3.6.0   | 运行中的本地实例 |

***

## 安装步骤

### 步骤 1：获取 Skill 文件

**方式 A：Git 克隆（推荐）**

```bash
# 进入对应 AI 工具的 skills 目录

# OpenClaw
cd ~/.openclaw/skills

# Trae
cd ~/.trae/skills

# Claude Desktop (macOS)
cd ~/Library/Application\ Support/Claude/claude-desktop/skills

# Claude Desktop (Windows)
cd %APPDATA%\Claude\claude-desktop\skills

# Cursor
cd ~/.cursor/skills

# 克隆仓库
git clone https://github.com/dazexcl/siyuan-skill.git
```

**方式 B：手动复制**

将 `siyuan-skill` 目录复制到你的 AI 工具的 skills 目录中。

### 步骤 2：获取思源笔记凭证

**获取 API Token：**

1. 打开思源笔记
2. 进入 **设置 → 关于**
3. 复制 **API Token**

**获取笔记本 ID：**

> **注意：** 需要先配置好环境变量或 config.json，才能运行命令。

```bash
cd siyuan-skill

# 方式1：临时设置环境变量后运行（Windows PowerShell）
$env:SIYUAN_BASE_URL="http://localhost:6806"; $env:SIYUAN_TOKEN="你的token"; node siyuan.js notebooks

# 方式2：临时设置环境变量后运行（macOS/Linux）
SIYUAN_BASE_URL="http://localhost:6806" SIYUAN_TOKEN="你的token" node siyuan.js notebooks

# 方式3：先创建 config.json，再运行
cp config.example.json config.json
# 编辑 config.json 填入 token，然后运行
node siyuan.js notebooks
```

### 步骤 3：配置环境变量

在你的 AI 工具配置中添加以下环境变量：

```bash
# 必需配置
SIYUAN_BASE_URL=http://localhost:6806
SIYUAN_TOKEN=你的API令牌
SIYUAN_DEFAULT_NOTEBOOK=你的笔记本ID

# 可选配置
SIYUAN_PERMISSION_MODE=all
```

**不同 AI 工具的配置方式：**

| AI 工具          | 配置位置                                           |
| -------------- | ---------------------------------------------- |
| OpenClaw       | `.openclaw/skills/` 目录或 `~/.openclaw/env` 环境变量 |
| Trae           | `.trae/rules/project_rules.md` 或系统环境变量         |
| Claude Desktop | `claude_desktop_config.json`                   |
| Cursor         | `.cursor/rules` 或系统环境变量                        |

### 步骤 4：验证安装

```bash
cd siyuan-skill
node siyuan.js notebooks
```

成功输出示例：

```json
{
  "success": true,
  "data": [
    { "id": "20260227231831-yq1lxq2", "name": "我的笔记本" }
  ]
}
```

***

## 配置文件方式（可选）

如果你更倾向于使用配置文件而非环境变量：

```bash
cd siyuan-skill
cp config.example.json config.json
```

编辑 `config.json`：

```json
{
  "baseURL": "http://localhost:6806",
  "token": "你的API令牌",
  "defaultNotebook": "你的笔记本ID"
}
```

> **注意：** 环境变量优先级高于配置文件。

***

## 高级功能配置（可选）

### 向量搜索（语义搜索）

如需启用语义搜索功能，需额外部署：

```bash
# 部署 Qdrant
docker run -d -p 6333:6333 qdrant/qdrant

# 部署 Ollama + 模型
ollama pull nomic-embed-text
```

添加环境变量：

```bash
QDRANT_URL=http://localhost:6333
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBED_MODEL=nomic-embed-text
```

***

## 目录结构

```
siyuan-skill/
├── siyuan.js          # CLI 入口文件
├── index.js           # Skill 主入口
├── config.js          # 配置管理
├── connector.js       # API 连接器
├── config.example.json # 配置示例
├── commands/          # 命令实现
├── lib/               # 核心库
├── utils/             # 工具函数
└── doc/               # 文档
```

***

## 常见问题

| 问题                 | 解决方案                     |
| ------------------ | ------------------------ |
| `ECONNREFUSED`     | 确保思源笔记正在运行               |
| `401 Unauthorized` | 检查 `SIYUAN_TOKEN` 是否正确   |
| `404 Not Found`    | 检查笔记本 ID 是否正确            |
| 命令找不到              | 确保在 `siyuan-skill` 目录下运行 |

***

## 快速测试命令

```bash
# 查看帮助
node siyuan.js help

# 获取笔记本列表
node siyuan.js notebooks

# 获取文档结构（需要指定笔记本ID或路径）
node siyuan.js structure <notebook-id>
node siyuan.js structure --path "/笔记本名"

# 搜索内容
node siyuan.js search "关键词"
```

***

## 安全建议

- 仅将 `SIYUAN_BASE_URL` 设置为本地实例（`http://localhost:6806`）
- 不要在公网环境暴露 API Token
- 生产环境推荐使用 `whitelist` 权限模式

***

## 相关文档

- [完整 README](README.md)
- [SKILL 配置](SKILL.md)
- [命令文档](doc/commands/)
- [配置说明](doc/config/)

***

## 获取帮助

- [GitHub Issues](https://github.com/dazexcl/siyuan-skill/issues)
- [思源笔记 API 文档](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)

