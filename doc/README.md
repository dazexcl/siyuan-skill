# 文档地图

本目录包含 siyuan-skill 的详细文档，按功能分类组织。

## 📂 目录结构

```
doc/
├── commands/           # 命令详细文档
│   ├── search.md      # 搜索命令详解
│   ├── create.md      # 创建文档命令详解
│   ├── update.md      # 更新文档命令详解
│   ├── delete.md      # 删除文档命令详解
│   ├── move.md        # 移动文档命令详解
│   ├── convert.md     # 转换ID和路径命令详解
│   ├── notebooks.md   # 获取笔记本列表命令详解
│   ├── index.md       # 索引文档命令详解
│   └── nlp.md         # NLP分析命令详解
│
├── advanced/          # 高级主题文档
│   ├── vector-search.md  # 向量搜索配置
│   └── best-practices.md # 最佳实践
│
└── config/            # 配置文档
    ├── environment.md # 环境变量配置
    └── advanced.md    # 高级配置
```

## 🚀 快速导航

### 命令文档

**文档操作**
- [创建文档](commands/create.md) - 创建新文档，支持自动换行符处理
- [更新文档](commands/update.md) - 更新文档内容
- [删除文档](commands/delete.md) - 删除文档
- [移动文档](commands/move.md) - 移动文档位置

**搜索功能**
- [搜索内容](commands/search.md) - 支持向量搜索、语义搜索、关键词搜索

**其他命令**
- [获取笔记本列表](commands/notebooks.md) - 查看所有笔记本
- [转换ID和路径](commands/convert.md) - ID和路径互转
- [索引文档](commands/index.md) - 向量数据库索引
- [NLP分析](commands/nlp.md) - 文本分析功能

### 高级主题

- [向量搜索配置](advanced/vector-search.md) - Qdrant 和 Ollama 配置指南
- [最佳实践](advanced/best-practices.md) - 使用建议和注意事项

### 配置文档

- [环境变量配置](config/environment.md) - 环境变量说明
- [高级配置](config/advanced.md) - 详细配置选项

## 💡 使用建议

1. **新手入门**：先阅读 [SKILL.md](../SKILL.md) 了解核心概念
2. **命令使用**：根据需要查看对应命令的详细文档
3. **高级功能**：需要向量搜索等功能时查看高级主题文档
4. **配置优化**：根据实际需求调整配置参数

## 📖 文档约定

- 所有命令文档都包含：命令格式、参数说明、使用示例、注意事项
- 高级主题文档提供详细的配置步骤和故障排除
- 配置文档包含完整的配置项说明和示例

## 🔗 相关链接

- [返回主文档](../SKILL.md)
- [思源笔记 API 文档](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)
- [思源笔记用户指南](https://github.com/siyuan-note/siyuan/blob/master/README_zh_CN.md)
