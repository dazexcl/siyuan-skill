# 功能脚本实现规范

## 概述

本文档定义了 Siyuan Notes Skill 执行脚本的标准实现规范，确保代码一致性、可维护性和可复用性。

## 基本结构

### 1. 文件头部

```javascript
#!/usr/bin/env node
/**
 * 脚本名称.js - 脚本功能描述
 *
 * 详细说明（可选）：
 * - 功能点1
 * - 功能点2
 */
```

### 2. 依赖引入

```javascript
const SiyuanConnector = require('./lib/connector');
const { parseSimpleArgs, parseArgs } = require('./lib/args-parser');
const { createErrorResult, createSuccessResult } = require('./lib/result-helper');
```

**规范：**
- ✅ 使用 `SiyuanConnector.get()` 获取连接器，不要直接引用 `ConfigManager`
- ✅ 使用公共的参数解析器，不要重复实现 `parseArgs`
- ✅ 使用 `result-helper` 构造标准返回对象，不要重复实现

### 3. 帮助文本

```javascript
const HELP_TEXT = `用法: 命令名 <参数> [选项]

简要描述

位置参数:
  arg1                参数1描述

选项:
  -h, --help          显示帮助信息
  --option <value>    选项描述

示例:
  命令名 arg1         示例1
  命令名 --opt val    示例2
`;
```

### 4. 参数解析

#### 简单场景（仅 help 和位置参数）

```javascript
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseSimpleArgs(args);
  
  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  // ...
}
```

#### 复杂场景（支持多种选项）

```javascript
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['id', 'path', 'output'],
    shortOpts: { 'h': 'help', 'o': 'output' },
    defaults: { format: 'json' }
  });
  
  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  // ...
}
```

**注意事项：**
- ✅ **在 `parseArgs` 之后检查** `options.help`（如上例所示）
- ❌ **不要在 `parseArgs` 之前手动检查** `args.includes('--help')` 或 `args.includes('-h')`
- `parseArgs` 和 `parseSimpleArgs` 内部已经处理了 `--help` 和 `-h` 参数，会自动设置 `options.help = true`
- 在 `parseArgs` 之前手动检查会导致重复处理，不符合规范

### 5. 连接器获取

```javascript
async function main() {
  const connector = SiyuanConnector.get();
  
  try {
    const result = await connector.request('/api/endpoint', { data });
    // 处理结果
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}
```

### 6. 入口判断

```javascript
async function main() {
  // 主逻辑
}

main();
```

## 完整示例

```javascript
#!/usr/bin/env node
/**
 * create.js - 创建文档
 * 在指定笔记本中创建新文档
 */

const SiyuanConnector = require('./lib/connector');
const { parseArgs } = require('./lib/args-parser');

const HELP_TEXT = `用法: create <title> [选项]

在指定笔记本中创建新文档

位置参数:
  title                文档标题

选项:
  -n, --notebook <id>  笔记本ID（使用配置文件中的默认值）
  -c, --content <text> 文档内容（可选）
  -h, --help           显示帮助信息

示例:
  create "我的文档"
  create "我的文档" --notebook "20241001123456-abc123"
  create "我的文档" -c "文档内容"
`;

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);
  const { options, positionalArgs } = parseArgs(args, {
    hasValueOpts: ['notebook', 'content'],
    shortOpts: { 'n': 'notebook', 'c': 'content', 'h': 'help' }
  });

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (positionalArgs.length === 0) {
    console.error('错误: 必须提供文档标题');
    console.log(HELP_TEXT);
    process.exit(1);
  }

  try {
    const connector = SiyuanConnector.get();
    const title = positionalArgs[0];
    const notebookId = options.notebook || connector.getConfig().notebookId;

    if (!notebookId) {
      throw new Error('未指定笔记本ID，请通过 --notebook 选项或配置文件指定');
    }

    const result = await connector.request('/api/block/createDoc', {
      notebook: notebookId,
      path: '/' + title,
      markdown: options.content || ''
    });

    console.log(JSON.stringify({ success: true, data: result }, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('创建文档失败:', error.message);
    process.exit(1);
  }
}

main();
```

## 核心原则

### 1. 单一职责
- 每个脚本只负责一个核心功能
- 脚本应该专注于单一功能的执行

### 2. 依赖管理
- ✅ 使用 `SiyuanConnector.get()` 获取连接器
- ✅ 使用公共的 `args-parser` 解析参数
- ✅ 使用 `result-helper` 构造标准返回对象
- ❌ 不要直接引用 `ConfigManager`
- ❌ 不要重复实现通用的解析逻辑和返回对象构造
- ❌ 执行脚本不要导出任何函数（不使用 `module.exports`）

### 3. 错误处理
- 使用 try-catch 捕获错误
- 错误信息清晰明确
- 使用适当的退出码（0 成功，1 失败）

### 4. 代码组织
- 函数顺序：工具函数 → 主函数 → 入口判断
- 使用 JSDoc 注释
- 保持代码格式化一致
- 不使用 `module.exports` 导出

### 5. 可复用性
- 保持代码简洁，专注于单一功能的执行
- 如需在其他脚本中复用功能，应创建独立的库脚本

## 常见问题

### Q: 为什么不直接引用 ConfigManager？
A: `SiyuanConnector.get()` 已经封装了配置读取逻辑，使用它可以让代码更简洁，避免重复。

### Q: SiyuanConnector.get() 是如何工作的？
A: `SiyuanConnector.get()` 实现了单例模式：
- **首次调用**：创建新的连接器实例并缓存
- **后续调用（无参数）**：直接返回缓存的实例，避免重复创建
- **带参数调用**：使用提供的配置重新创建实例并更新缓存

```javascript
// 第一次调用，创建并缓存实例
const connector1 = SiyuanConnector.get();

// 第二次调用，返回同一个实例
const connector2 = SiyuanConnector.get();
console.log(connector1 === connector2); // true

// 带参数调用，创建新实例并更新缓存
const connector3 = SiyuanConnector.get({ timeout: 20000 });

// 后续调用返回新创建的实例
const connector4 = SiyuanConnector.get();
console.log(connector3 === connector4); // true
```

如果需要清除缓存并强制重新创建，可以调用 `SiyuanConnector.clearCache()`：
```javascript
SiyuanConnector.clearCache();
const connector = SiyuanConnector.get(); // 创建新实例
```

### Q: 什么时候用 parseSimpleArgs，什么时候用 parseArgs？
A:
- `parseSimpleArgs`: 只需要 help 和位置参数时使用
- `parseArgs`: 需要支持多种选项（短选项、长选项、带值选项）时使用

### Q: 如何处理配置覆盖？
A: 可以在调用 `SiyuanConnector.get()` 时传入覆盖配置，参数优先级为：`传入参数 > 配置文件 > 默认值`：
```javascript
const connector = SiyuanConnector.get({ 
  baseURL: 'http://custom:6806',
  timeout: 20000 
});
```

### Q: 如何访问配置中的其他参数(如 notebookId, hPath 等)？
A: 通过连接器实例的 `getConfig()` 方法获取完整配置：
```javascript
const connector = SiyuanConnector.get();
const config = connector.getConfig();
const notebookId = config.notebookId;
const hPath = config.hPath;
```

**重要:** `getConfig()` 是实例方法,不是静态方法。必须先获取连接器实例才能调用。

### Q: 如何构造标准返回对象？
A: 使用 `result-helper` 模块中的函数：
```javascript
const { createErrorResult, createSuccessResult } = require('./lib/result-helper');

// 成功结果
return createSuccessResult({ id: 'xxx' }, '操作成功');

// 错误结果
return createErrorResult('参数错误', '必须提供文档ID');
```

**优点:**
- 统一返回格式，确保所有脚本返回结构一致
- 消除重复代码
- 易于维护和扩展

## 迁移指南

如果你的脚本还不符合本规范，请按以下步骤迁移：

1. 移除 `ConfigManager` 的引用
2. 将连接器初始化代码替换为 `SiyuanConnector.get()`
3. 检查是否有重复的 `parseArgs` 实现，替换为公共的参数解析器
4. 移除所有 `module.exports` 语句
5. 确保包含 ` main();` 入口
6. 添加 JSDoc 注释

## 更新日志

- 2025-04-11: 明确规范仅针对执行脚本
  - 移除所有库脚本相关内容
  - 强调执行脚本不应导出函数
  - 简化示例和说明

- 2025-04-11: 添加单例模式说明
  - 说明 SiyuanConnector.get() 的缓存机制
  - 添加 clearCache() 方法说明
  - 补充配置覆盖的使用示例

- 2025-04-11: 初始版本
  - 定义连接器使用规范
  - 定义参数解析规范
  - 定义代码组织规范
