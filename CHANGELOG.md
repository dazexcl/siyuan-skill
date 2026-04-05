# 升级日志

## \[2.0.0] - 2024-04-06

### 重大重构

#### 🏗️ 架构重构

**1. 目录结构重组**

- **删除** `commands/` 目录，将所有命令脚本移至 `scripts/` 目录
- **删除** 根目录的 `siyuan.js`、`config.js`、`connector.js` 文件
- **删除** `lib/` 目录下的复杂管理器（block-locator、block-operator、document-manager、intent-recognizer、operation-coordinator、smart-insertion-strategy）
- **删除** `utils/` 目录（block-helper、delete-protection、formatter、permission、validator）
- **新增** `scripts/` 目录，包含所有独立命令脚本
- **新增** `scripts/lib/` 目录，包含核心库文件
- **新增** `test/` 目录，包含完整的测试框架
- **新增** `examples/` 目录，包含使用示例文档

**2. 命令执行方式变更**

- **旧版本**：使用统一的 `siyuan.js` 主入口和 `commands/` 目录下的模块
- **新版本**：使用独立的 `scripts/` 脚本文件，每个功能对应一个可执行脚本

**示例对比**：

```bash
# 旧版本 (1.7.8)
node siyuan.js create "文档标题" --parent-id <id>

# 新版本 (2.0.0)
node scripts/create.js "文档标题" --parent-id <id>
```

#### 📝 脚本文件变更

**3. 命令脚本重构**
从 `commands/*.js` 迁移到 `scripts/*.js`：

- `block-attrs.js` → `scripts/block-attrs.js` (97%相似度)
- `block-fold.js` → `scripts/block-fold.js`
- `block-get.js` → `scripts/block-get.js`
- `check-exists.js` → `scripts/exists.js` (重命名)
- `convert-path.js` → `scripts/convert.js` (重命名)
- `create-document.js` → `scripts/create.js` (重命名)
- `delete-block.js` → `scripts/block-delete.js` (重命名)
- `delete-document.js` → `scripts/delete.js` (重命名)
- `get-doc-content.js` → `scripts/content.js` (重命名)
- `get-doc-info.js` → `scripts/info.js` (重命名)
- `get-doc-structure.js` → `scripts/structure.js` (重命名)
- `get-notebooks.js` → `scripts/notebooks.js` (重命名)
- `index-documents.js` → `scripts/index.js` (重命名)
- `insert-block.js` → `scripts/block-insert.js` (重命名)
- `move-block.js` → `scripts/block-move.js` (重命名)
- `move-document.js` → `scripts/move.js` (重命名)
- `nlp-analyze.js` → `scripts/nlp.js` (重命名)
- `protect-document.js` → `scripts/protect.js` (重命名)
- `rename-document.js` → `scripts/rename.js` (重命名)
- `search-content.js` → `scripts/search.js` (重命名)
- `tags.js` → `scripts/tags.js`
- `transfer-block-ref.js` → `scripts/block-transfer.js` (重命名)
- `update-block.js` → `scripts/block-update.js` (重命名)
- `update-document.js` → `scripts/update.js` (重命名)

#### 🔧 核心库重构

**4. 库文件迁移与简化**
从 `lib/*.js` 和根目录迁移到 `scripts/lib/*.js`：

- `config.js` → `scripts/lib/config.js` (99%相似度)
- `connector.js` → `scripts/lib/connector.js` (91%相似度)
- `chinese-dictionary.js` → `scripts/lib/chinese-dictionary.js` (99%相似度)
- `chinese-tokenizer.js` → `scripts/lib/chinese-tokenizer.js` (100%相似度)
- `search-manager.js` → `scripts/lib/search-manager.js` (99%相似度)
- `vector-manager.js` → `scripts/lib/vector-manager.js` (89%相似度)
- `embedding-manager.js` → `scripts/lib/embedding-manager.js` (重写)
- **新增** `scripts/lib/permission.js` (权限管理模块)

**5. 删除的复杂管理器**

- `lib/block-locator.js` - 块定位器
- `lib/block-operator.js` - 块操作器
- `lib/document-manager.js` - 文档管理器
- `lib/intent-recognizer.js` - 意图识别器
- `lib/notebook-manager.js` - 笔记本管理器
- `lib/operation-coordinator.js` - 操作协调器
- `lib/smart-insertion-strategy.js` - 智能插入策略

**6. 删除的工具模块**

- `utils/block-helper.js` - 块辅助工具
- `utils/delete-protection.js` - 删除保护工具
- `utils/formatter.js` - 格式化工具
- `utils/permission.js` - 权限工具
- `utils/validator.js` - 验证工具

#### 📚 文档重构

**7. 文档结构优化**

- **删除** `references/commands/` 目录下的所有命令详细文档（18个文件）
- **新增** `examples/basic-usage.md` - 基础用法示例
- **新增** `examples/block-operations.md` - 块操作指南
- **新增** `examples/document-workflow.md` - 文档工作流
- **新增** `references/quick-reference.md` - 快速参考指南
- **新增** `references/advanced/security.md` - 安全文档
- **优化** `README.md` - 简化结构，提升可读性
- **优化** `SKILL.md` - 更新技能元信息

#### 🧪 测试框架

**8. 测试系统重构**

- **删除** `scripts/test/` 目录下的旧测试文件
- **新增** `test/` 目录，包含完整的测试框架
- **新增** 25个测试文件，覆盖所有核心功能
- **新增** `test/test-framework.js` - 测试框架
- **新增** `test/run-all-tests.js` - 测试运行器
- **新增** `test/cleanup-test-docs.js` - 测试清理工具

#### 📦 配置变更

**9. 配置文件优化**

- `config.example.json` → `assets/config-template.json` (重命名和位置移动)
- **新增** `_meta.json` - 技能元数据文件
- **删除** Jest 测试相关配置
- **删除** npm scripts 中的测试命令

**10. package.json 变更**

```json
// 版本升级
"version": "1.7.8" → "version": "2.0.0"

// 描述更新
"main": "siyuan.js" → "main": "scripts/notebooks.js"

// 删除全局命令
"bin": {
  "siyuan": "./siyuan.js"
} → "bin": {}

// 删除测试依赖
删除 "devDependencies" 中的 "jest"

// 删除测试脚本
删除 "scripts" 中的 test、test:watch、test:coverage
```

#### 🔄 迁移指南

**从 1.7.8 升级到 2.0.0**

**1. 更新命令执行方式**

```bash
# 旧版本命令
node siyuan.js create "标题" --parent-id <id>

# 新版本命令
node scripts/create.js "标题" --parent-id <id>
```

**2. 更新脚本路径**
所有命令脚本从根目录或 `commands/` 目录移至 `scripts/` 目录。

**3. 删除旧文件**

```bash
# 删除旧的主入口文件
rm siyuan.js config.js connector.js

# 删除旧的目录
rm -rf commands/ lib/ utils/

# 删除旧的测试文件
rm -rf scripts/test/
```

**4. 使用新的测试框架**

```bash
# 运行新测试
node test/run-all-tests.js
```

**5. 更新文档引用**

- 命令详细文档已移除，请参考 `examples/` 目录
- 使用 `references/quick-reference.md` 获取快速参考
- 查看 `README.md` 了解新的使用方法

#### ⚠️ 破坏性变更

**1. 主入口文件移除**

- `siyuan.js` 不再存在
- 所有功能通过 `scripts/` 目录下的独立脚本执行

**2. 全局命令移除**

- `siyuan` 命令不再可用
- 需要直接调用 `node scripts/<command>.js`

**3. 测试框架变更**

- 使用新的自定义测试框架

**4. 目录结构完全重构**

- 所有文件位置发生变更
- 需要更新所有相关的路径引用

### 兼容性说明

- **Node.js版本**：保持 >= 14.0.0
- **思源笔记版本**：保持 >= 3.6.0
- **API兼容性**：底层API调用方式保持不变
- **功能兼容性**：所有功能保持可用，仅调用方式变更

