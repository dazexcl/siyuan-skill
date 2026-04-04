# 文档工作流示例

## 场景：创建并编辑一个项目文档

### 步骤 1: 检查是否存在

```bash
node scripts/exists.js --title "项目计划" --parent-id <parentId>

# 或使用路径检查
node scripts/exists.js --path "/笔记本/目录/项目计划"
```

### 步骤 2: 创建文档

```bash
node scripts/create.js "项目计划" --content "# 项目计划

## 目标
- 目标1
- 目标2

## 时间线
| 阶段 | 时间 |
|------|------|
| 需求分析 | 1周 |" --parent-id <parentId>

# 或使用路径创建
node scripts/create.js --path "/笔记本/目录/项目计划" --content "# 项目计划..."
```

### 步骤 3: 添加标签和属性

```bash
# 添加标签
node scripts/tags.js <docId> --add "项目,计划,重要"

# 设置自定义属性
node scripts/block-attrs.js <docId> --set "status=draft"

# 设置图标
node scripts/icon.js <docId> 1f4cb
```

### 步骤 4: 后续修改

```bash
# 获取当前内容
node scripts/content.js <docId>

# 全文更新
node scripts/update.js <docId> --content "# 更新后的内容..."

# 从文件更新
node scripts/update.js <docId> --file updated.md

# 或只更新某个块
node scripts/block-update.js <blockId> --content "新的块内容"
```

## 场景：批量整理文档

```bash
# 查看笔记本结构
node scripts/structure.js <notebookId> --depth -1

# 搜索需要整理的文档
node scripts/search.js "待整理" --mode keyword

# 移动文档到新位置
node scripts/move.js <docId> --target <targetParentId>

# 重命名
node scripts/rename.js <docId> "新名称"

# 强制重命名（忽略重名检测）
node scripts/rename.js <docId> "已存在的名称" --force
```

## 场景：保护重要文档

```bash
# 设置保护标记
node scripts/protect.js <docId>

# 移除保护标记
node scripts/protect.js <docId> --remove
```

## 场景：使用向量搜索

```bash
# 语义搜索（需配置 Qdrant + Ollama）
node scripts/search.js "人工智能应用" --mode semantic

# 混合搜索
node scripts/search.js "人工智能应用" --mode hybrid

# 索引文档到向量库
node scripts/index-docs.js --notebook <notebookId>
node scripts/index-docs.js --doc-ids <docId1>,<docId2>
```
