#!/usr/bin/env node
/**
 * Siyuan Skill 命令行接口 (CLI)
 * 提供便捷的命令行操作方式
 */

// 设置控制台编码为 UTF-8
if (process.platform === 'win32') { 
  // 在 Windows 上确保 UTF-8 输出
  process.env.LANG = 'en_US.UTF-8';
  process.env.LC_ALL = 'en_US.UTF-8';
  // 移除之前的 ANSI 转义序列，避免终端响应
}

const { createSkill, VERSION } = require('./index');
const fs = require('fs');
const path = require('path');

/**
 * 从文件读取内容
 * @param {string} filePath - 文件路径（绝对路径或相对路径）
 * @returns {string} 文件内容
 */
function readFileContent(filePath) {
  const absolutePath = path.isAbsolute(filePath) 
    ? filePath 
    : path.resolve(process.cwd(), filePath);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`错误: 文件不存在: ${absolutePath}`);
    process.exit(1);
  }
  
  try {
    return fs.readFileSync(absolutePath, 'utf-8');
  } catch (error) {
    console.error(`错误: 无法读取文件: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 检测并获取内容来源（优先级：--file > 位置参数）
 * @param {object} options - 解析后的选项
 * @param {array} positional - 位置参数数组
 * @param {number} contentIndex - 内容在位置参数中的索引
 * @returns {object} { content: string, source: string }
 */
function resolveContent(options, positional, contentIndex) {
  const file = options.file || '';
  
  if (file) {
    return { content: readFileContent(file), source: `file:${file}` };
  }
  
  if (positional.length > contentIndex) {
    return { content: positional[contentIndex], source: 'argument' };
  }
  
  return { content: '', source: 'none' };
}

/**
 * 执行创建文档操作
 * @param {string} title - 文档标题
 * @param {string} content - 文档内容
 * @param {string} parentId - 父文档ID
 * @param {string} path - 文档路径
 * @param {boolean} force - 是否强制创建
 * @param {object} skill - SiyuanSkill 实例
 */
async function performCreate(title, content, parentId, path, force, skill) {
  if (title && title.includes('/')) {
    const originalTitle = title;
    title = title.replace(/\//g, '／');
    console.log(`⚠️ 标题包含斜杠，已自动转换: "${originalTitle}" → "${title}"`);
  }
  
  if (!parentId && !path) {
    parentId = skill.config.defaultNotebook;
    if (!parentId) {
      console.error('错误: 未设置默认笔记本 ID');
      console.log('请设置环境变量 SIYUAN_DEFAULT_NOTEBOOK 或在 config.json 文件中配置 defaultNotebook，或使用 --parent-id 参数');
      process.exit(1);
    }
  }
  
  console.log('创建文档...');
  console.log('标题:', title);
  console.log('内容:', content ? `(${content.length} 字符)` : '(空)');
  if (parentId) {
    console.log('父文档 ID:', parentId);
  }
  if (path) {
    console.log('路径:', path);
  }
  console.log('强制创建:', force);
  
  const createResult = await skill.executeCommand('create-document', { 
    parentId: parentId,
    title: title,
    content: content,
    force: force,
    path: path
  });
  console.log(JSON.stringify(createResult, null, 2));
}

/**
 * 显示版本信息
 */
function showVersion() {
  console.log(`siyuan-skill v${VERSION}`);
}

/**
 * 通用命令行参数解析器
 * 支持任意参数顺序，自动识别选项参数和位置参数
 * @param {Array} args - 命令行参数数组（从索引1开始，不包括命令本身）
 * @param {Object} config - 解析配置
 * @param {Object} config.options - 选项定义 { optionName: { hasValue: true/false, aliases: [] } }
 * @param {number} config.positionalCount - 位置参数数量（如标题、内容等）
 * @param {Array} config.commonMistakes - 常见错误参数映射 { wrong: correct }
 * @returns {Object} 解析结果 { positional: [...], options: {...} }
 */
function parseCommandArgs(args, config) {
  const { options = {}, positionalCount = 0, commonMistakes = {} } = config;
  
  const result = {
    positional: [],
    options: {}
  };
  
  // 构建选项映射（包括别名）
  const optionMap = {};
  for (const [name, opt] of Object.entries(options)) {
    const camelCase = name.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    optionMap[name] = { ...opt, targetName: camelCase };
    if (opt.aliases) {
      for (const alias of opt.aliases) {
        optionMap[alias] = { ...opt, targetName: camelCase };
      }
    }
  }
  
  const knownOptions = Object.keys(optionMap);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('-')) {
      // 检测常见错误参数
      if (commonMistakes[arg]) {
        console.error(`\n❌ 未知参数: ${arg}`);
        console.error(`您可能想使用: ${commonMistakes[arg]}`);
        process.exit(1);
      }
      
      // 检查是否是已知选项
      const optConfig = optionMap[arg];
      if (optConfig) {
        const targetName = optConfig.targetName || arg.replace(/^-+/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        
        if (optConfig.hasValue && i + 1 < args.length) {
          result.options[targetName] = args[++i];
        } else if (optConfig.isFlag) {
          result.options[targetName] = true;
        }
      } else {
        // 未知参数警告
        if (!knownOptions.includes(arg)) {
          console.warn(`⚠️ 警告: 未知参数 "${arg}" 将被忽略`);
        }
      }
    } else {
      // 非选项参数，按位置收集
      result.positional.push(arg);
    }
  }
  
  // 限制位置参数数量
  if (positionalCount > 0 && result.positional.length > positionalCount) {
    // 超出部分合并到最后一个参数
    const extra = result.positional.splice(positionalCount - 1);
    result.positional[positionalCount - 1] = extra.join(' ');
  }
  
  return result;
}

/**
 * 命令别名映射（全局）
 */
const ALIAS_MAP = {
  'nb': 'notebooks',
  'ls': 'structure',
  'cat': 'content',
  'info': 'get-doc-info',
  'find': 'search',
  'new': 'create',
  'edit': 'update-document',
  'update': 'update-document',
  'rm': 'delete',
  'mv': 'move',
  'path': 'convert',
  'index-documents': 'index',
  'nlp-analyze': 'nlp',
  'bi': 'block-insert',
  'bu': 'block-update',
  'bd': 'block-delete',
  'bm': 'block-move',
  'bg': 'block-get',
  'ba': 'block-attrs',
  'attrs': 'block-attrs',
  'block-attributes': 'block-attrs',
  'bf': 'block-fold',
  'buu': 'block-fold',
  'block-unfold': 'block-fold',
  'fold-block': 'block-fold',
  'unfold-block': 'block-fold',
  'btr': 'block-transfer-ref',
  'st': 'tags',
  'check': 'exists',
  'check-exists': 'exists',
  'set-icon': 'icon'
};

/**
 * 显示帮助信息
 * @param {string} [command] - 要显示帮助的命令（可选）
 */
function showHelp(command) {
  if (command) {
    // 显示特定命令的帮助
    showCommandHelp(command);
  } else {
    // 显示所有命令列表
    showCommandList();
  }
}

/**
 * 显示所有命令列表
 */
function showCommandList() {
  console.log(`
Siyuan Skill CLI - 思源笔记命令行工具

用法:
  siyuan <command> [options]
  siyuan help <command>    # 查看特定命令的详细帮助
  siyuan --version         # 显示版本信息

命令:
  notebooks, nb                    获取所有笔记本列表
  structure, ls                    获取指定笔记本的文档结构
  content, cat                     获取文档内容
  info                             获取文档基础信息
  create, new                      创建文档（自动重名检测）
  update, edit                     更新文档内容（仅接受文档ID）
  delete, rm                       删除文档（受保护机制约束）
  protect                          设置/移除文档保护标记
  move, mv                         移动文档（自动重名检测）
  rename                           重命名文档（自动重名检测）
  exists, check                    检查文档是否存在
  search, find                     搜索内容
  convert, path                    转换 ID 和路径
  icon, set-icon                   设置/获取文档图标
  index, index-documents           索引文档到向量数据库
  nlp                              NLP 文本分析 [实验性]
  block-insert, bi                 插入新块
  block-update, bu                 更新块内容（仅接受块ID）
  block-delete, bd                 删除块
  block-move, bm                   移动块
  block-get, bg                    获取块信息
  block-attrs, ba, attrs           管理块/文档属性
  block-fold, bf/buu               折叠/展开块
  block-transfer-ref, btr          转移块引用
  tags, st                         设置块/文档标签
  help                             显示帮助信息

使用示例:
  siyuan help search              # 查看 search 命令的详细帮助
  siyuan help create              # 查看 create 命令的详细帮助
  siyuan help                    # 显示所有命令列表

配置优先级：环境变量 > config.json > 默认配置
`);
}

/**
 * 显示特定命令的帮助
 * @param {string} command - 命令名称或别名
 */
function showCommandHelp(command) {
  const mainCommand = ALIAS_MAP[command] || command;
  
  const commandHelps = {
    'notebooks': {
      aliases: ['nb'],
      description: '获取所有笔记本列表',
      usage: 'siyuan notebooks',
      options: [],
      examples: [
        'siyuan notebooks',
        'siyuan nb'
      ]
    },
    'structure': {
      aliases: ['ls'],
      description: '获取笔记本/文档结构（目录树）',
      usage: 'siyuan structure [<notebookId|docId>] [--path <path>] [--depth <depth>]',
      notes: [
        '第一个位置参数默认为笔记本ID或文档ID',
        '--path 与位置参数二选一，不能同时使用',
        '路径格式支持首位存在或不存在笔记本名称',
        '--depth 控制递归深度（默认1，-1表示无限）'
      ],
      options: [
        { name: '<notebookId|docId>', description: '笔记本ID或文档ID（位置参数，与 --path 二选一）' },
        { name: '--path, -P', description: '文档路径（与位置参数二选一）' },
        { name: '--depth, -d', description: '递归深度（默认1，-1表示无限）' }
      ],
      examples: [
        'siyuan structure <notebook-id>',
        'siyuan structure <doc-id>',
        'siyuan ls --depth 2 <notebook-id>',
        'siyuan ls --path "/笔记本名"',
        'siyuan ls --path "/笔记本名/文档路径"',
        'siyuan ls --path "文档路径"  # 不含笔记本名时使用默认笔记本'
      ]
    },
    'content': {
      aliases: ['cat'],
      description: '获取文档内容',
      usage: 'siyuan content [<docId>] [--path <path>] [--format <format>] [--raw]',
      notes: [
        '第一个位置参数默认为文档ID',
        '--doc-id 和 --path 二选一，不能同时使用'
      ],
      options: [
        { name: '<docId>', description: '文档ID（位置参数，与 --path 二选一）' },
        { name: '--doc-id, -D', description: '文档ID（与 --path 二选一）' },
        { name: '--path, -P', description: '文档路径（与 --doc-id 二选一）' },
        { name: '--format, -F', description: '输出格式：kramdown、markdown、text、html（默认：kramdown）' },
        { name: '--raw, -r', description: '以纯文本格式返回（移除JSON外部结构）' }
      ],
      examples: [
        'siyuan content <doc-id>',
        'siyuan content <doc-id> --format text',
        'siyuan content --path "/目录/文档"',
        'siyuan content <doc-id> --raw'
      ]
    },
    'get-doc-info': {
      aliases: ['info'],
      description: '获取文档基础信息（ID、标题、路径、属性、标签）',
      usage: 'siyuan info <docId> [--format <format>]',
      notes: [
        '仅支持文档ID，不支持笔记本ID',
        'attributes 已去除 custom- 前缀'
      ],
      options: [
        { name: '<docId>', description: '文档ID（必需，位置参数）' },
        { name: '--id', description: '文档ID（可选，等同于位置参数）' },
        { name: '--format, -F', description: '输出格式：summary（默认）、json' }
      ],
      returns: [
        'id - 文档ID',
        'title - 文档标题',
        'type - 块类型（doc为文档块）',
        'notebook - 所属笔记本（id和name）',
        'path - 人类可读路径',
        'attributes - 自定义属性（已去除custom-前缀）',
        'tags - 标签数组',
        'created/updated - 时间戳',
        '[json格式] path为对象，含rawAttributes原始属性'
      ],
      examples: [
        'siyuan info <doc-id>',
        'siyuan info <doc-id> --format json',
        'siyuan get-doc-info <doc-id>'
      ]
    },
    'search': {
      aliases: ['find'],
      description: '搜索内容（支持向量搜索）',
      usage: 'siyuan search <query> [options]',
      options: [
        { name: '--type, -T', description: '按单个类型过滤 (d/p/h/l/i/tb/c/s/img)' },
        { name: '--types', description: '按多个类型过滤 (逗号分隔，如 d,p,h)' },
        { name: '--sort-by, -s', description: '排序方式 (relevance/date)' },
        { name: '--limit, -l', description: '结果数量限制' },
        { name: '--path, -P', description: '搜索路径（仅搜索指定路径下的内容）' },
        { name: '--where', description: '自定义WHERE条件（用于过滤搜索结果）' },
        { name: '--mode, -m', description: '搜索模式 (hybrid/semantic/keyword/legacy)' },
        { name: '--notebook, -n', description: '指定笔记本ID' },
        { name: '--dense-weight', description: '语义搜索权重（混合搜索时，默认 0.7）' },
        { name: '--sparse-weight', description: '关键词搜索权重（混合搜索时，默认 0.3）' },
        { name: '--threshold', description: '相似度阈值（0-1）' }
      ],
      examples: [
        'siyuan search "关键词"',
        'siyuan search "关键词" --type d',
        'siyuan search "关键词" --types d,p,h',
        'siyuan search "关键词" --sort-by date --limit 5',
        'siyuan search "关键词" --path /AI/openclaw',
        'siyuan search "关键词" --where "length(content) > 100"',
        'siyuan search "关键词" --mode hybrid',
        'siyuan search "关键词" --mode semantic',
        'siyuan search "关键词" --mode keyword',
        'siyuan search "关键词" --mode legacy',
        'siyuan search "关键词" --mode hybrid --dense-weight 0.8 --sparse-weight 0.2',
        'siyuan search "AI" --mode semantic --threshold 0.5'
      ]
    },
    'create': {
      aliases: ['new'],
      description: '创建文档（自动处理换行符）',
      usage: 'siyuan create (<title> [content] | --path <path> [content]) [--title <title>] [--parent-id <parentId>] [--file <file>] [--force]',
      notes: [
        '【三种使用模式】',
        '',
        '模式1：传统模式（无 --path）',
        '  位置参数1 = 标题，位置参数2 = 内容',
        '  siyuan create "标题" "内容" --parent-id <notebookId>',
        '  siyuan create "标题" "内容" --parent-id <docId>',
        '',
        '模式2：路径指定文档（--path 末尾无 /）',
        '  标题从路径最后一段提取，位置参数 = 内容',
        '  siyuan create --path "笔记本/目录/文档名" "内容"',
        '  siyuan create --path "笔记本/目录/文档名" --title "自定义标题" "内容"',
        '  不提供内容则创建空文档：',
        '  siyuan create --path "笔记本/目录/空文档"',
        '',
        '模式3：在目录下创建（--path 末尾有 /）',
        '  在指定目录下创建新文档，位置参数1 = 标题，位置参数2 = 内容',
        '  siyuan create --path "笔记本/目录/" "新文档标题" "内容"',
        '',
        '【内容输入方式】（优先级：--file > 位置参数）',
        '',
        '方式1：--file 从文件读取（推荐超长内容）',
        '  siyuan create "标题" --file content.md --parent-id <id>',
        '  siyuan create --path "笔记本/文档" --file content.md',
        '',
        '方式2：位置参数直接传递（适合短内容）',
        '  siyuan create "标题" "内容"',
        '',
        '方式3：Shell 命令替换（适合超长内容，无需临时文件）',
        '  macOS/Linux:',
        '    siyuan create "标题" "$(cat content.md)" --parent-id <id>',
        '  Windows PowerShell（需指定编码）:',
        '    siyuan create "标题" (Get-Content content.md -Raw -Encoding UTF8) --parent-id <id>',
        '',
        '【路径自动创建】',
        '  使用 --path 时，中间目录不存在会自动创建（空内容）',
        '  例如：--path "A/B/C/D" 会自动创建 A、B、C 目录',
        '',
        '【重名检测】',
        '  默认检测同名文档，已存在时返回错误',
        '  使用 --force 强制创建（允许重名）',
        '',
        '【其他说明】',
        '  --parent-id 与 --path 二选一，不能同时使用',
        '  标题中的 / 会自动转换为全角 ／'
      ],
      options: [
        { name: '--parent-id, --parent, -p', description: '父文档/笔记本ID（与 --path 二选一）' },
        { name: '--path, -P', description: '文档路径。末尾无/表示创建该文档；末尾有/表示在该目录下创建' },
        { name: '--title, -t', description: '自定义标题（仅 --path 模式，覆盖路径中的标题）' },
        { name: '--file, -f', description: '从文件读取内容（超长内容推荐）' },
        { name: '--force', description: '强制创建（忽略重名检测）' }
      ],
      examples: [
        '# 模式1：传统方式',
        'siyuan create "我的文档" --parent-id <notebookId>',
        'siyuan create "我的文档" "文档内容" --parent-id <notebookId>',
        '',
        '# 超长内容处理（推荐 --file）',
        'siyuan create "超长文档" --file long-content.md --parent-id <notebookId>',
        '# macOS/Linux 命令替换:',
        'siyuan create "超长文档" "$(cat long-content.md)" --parent-id <notebookId>',
        '# Windows PowerShell 命令替换:',
        'siyuan create "超长文档" (Get-Content long-content.md -Raw -Encoding UTF8) --parent-id <notebookId>',
        '',
        '# 模式2：路径指定文档',
        'siyuan create --path "AI/项目/需求文档" "这是文档内容"',
        'siyuan create --path "AI/项目/需求文档" --title "需求文档v2" "内容"',
        'siyuan create --path "AI/项目/超长文档" --file content.md',
        '',
        '# 模式3：在目录下创建',
        'siyuan create --path "AI/项目/" "新需求文档" "内容"',
        'siyuan create --path "AI/项目/" "新文档" --file content.md',
        '',
        '# 重名处理',
        'siyuan create --path "AI/测试" "内容"      # 已存在时报错',
        'siyuan create --path "AI/测试" "内容" --force  # 强制创建'
      ]
    },
    'update-document': {
      aliases: ['edit', 'update'],
      description: '更新文档内容（仅接受文档ID，支持Markdown格式）',
      usage: 'siyuan update <docId> [<content>] [--file <file>] [--data-type <type>]',
      notes: [
        '此命令仅用于更新文档内容，需要传入文档ID',
        '如需更新块内容，请使用 block-update 命令',
        '',
        '【内容输入方式】（优先级：--file > 位置参数）',
        '',
        '方式1：--file 从文件读取（推荐超长内容）',
        '  siyuan update <docId> --file content.md',
        '',
        '方式2：位置参数直接传递（适合短内容）',
        '  siyuan update <docId> "新内容"',
        '',
        '方式3：Shell 命令替换（适合超长内容，无需临时文件）',
        '  macOS/Linux:',
        '    siyuan update <docId> "$(cat content.md)"',
        '  Windows PowerShell（需指定编码）:',
        '    siyuan update <docId> (Get-Content content.md -Raw -Encoding UTF8)'
      ],
      options: [
        { name: '<docId>', description: '文档ID（必需，位置参数）' },
        { name: '<content>', description: '新内容（位置参数）' },
        { name: '--file, -f', description: '从文件读取内容（超长内容推荐）' },
        { name: '--data-type', description: '数据类型：markdown/dom（默认：markdown）' }
      ],
      examples: [
        'siyuan update <doc-id> "新的文档内容"',
        'siyuan update <doc-id> --file long-content.md',
        '# macOS/Linux 命令替换:',
        'siyuan update <doc-id> "$(cat long-content.md)"',
        '# Windows PowerShell 命令替换:',
        'siyuan update <doc-id> (Get-Content long-content.md -Raw -Encoding UTF8)'
      ]
    },
    'delete': {
      aliases: ['rm'],
      description: '删除文档（受多层保护机制约束）',
      usage: 'siyuan delete <docId> [--confirm-title <title>]',
      notes: [
        '删除保护层级：',
        '  1. 全局安全模式 - 禁止所有删除操作',
        '  2. 文档保护标记 - 保护文档无法删除',
        '  3. 删除确认机制 - 需要确认文档标题'
      ],
      options: [
        { name: '--confirm-title', description: '确认标题（启用删除确认时需要）' }
      ],
      examples: [
        'siyuan delete <doc-id>',
        'siyuan delete <doc-id> --confirm-title "文档标题"'
      ]
    },
    'protect': {
      aliases: [],
      description: '设置或移除文档保护标记',
      usage: 'siyuan protect <docId> [--remove] [--permanent]',
      options: [
        { name: '--remove', description: '移除保护标记' },
        { name: '--permanent', description: '设置为永久保护（无法通过命令移除）' }
      ],
      examples: [
        'siyuan protect <doc-id>              # 设置保护',
        'siyuan protect <doc-id> --permanent  # 永久保护',
        'siyuan protect <doc-id> --remove     # 移除保护'
      ]
    },
    'move': {
      aliases: ['mv'],
      description: '移动文档',
      usage: 'siyuan move <docId|path> <targetParentId|path> [--new-title <title>]',
      options: [
        { name: '--new-title', description: '移动后重命名文档' }
      ],
      examples: [
        'siyuan move <doc-id> <target-parent-id>',
        'siyuan move <doc-id> <target-parent-id> --new-title "新标题"',
        'siyuan move /笔记本/文档路径 /目标笔记本/目标文档路径',
        'siyuan move /AI/test1 /AI/openclaw/更新记录'
      ]
    },
    'rename': {
      aliases: [],
      description: '重命名文档',
      usage: 'siyuan rename <docId> <title> [--force]',
      options: [
        { name: '<docId>', description: '文档ID（必需，位置参数）' },
        { name: '<title>', description: '新标题（必需，位置参数）' },
        { name: '--force', description: '强制重命名（忽略重名检测）' }
      ],
      examples: [
        'siyuan rename <doc-id> "新标题"',
        'siyuan rename 20260304051123-doaxgi4 "更新后的标题"',
        'siyuan rename <doc-id> "已存在的标题" --force'
      ]
    },
    'convert': {
      aliases: ['path'],
      description: '转换 ID 和路径',
      usage: 'siyuan convert --id <docId> 或 siyuan convert --path <hPath> [--force]',
      options: [
        { name: '--id', description: '文档ID' },
        { name: '--path', description: '人类可读路径' },
        { name: '--force', description: '强制转换（当存在多个匹配时返回第一个结果）' }
      ],
      examples: [
        'siyuan convert --id 20260304051123-doaxgi4',
        'siyuan convert --path /AI/openclaw/更新记录',
        'siyuan convert --path /AI/测试笔记 --force',
        'siyuan path 20260304051123-doaxgi4',
        'siyuan path /AI/openclaw/更新记录'
      ]
    },
    'index': {
      aliases: ['index-documents'],
      description: '索引文档到向量数据库（增量索引、自动分块、孤立索引清理）',
      usage: 'siyuan index [<id>] [--notebook <id>] [--doc-ids <ids>] [--force] [--remove]',
      options: [
        { name: '<id>', description: '位置参数：笔记本ID或文档ID（自动识别）' },
        { name: '--notebook', description: '索引指定笔记本' },
        { name: '--doc-ids', description: '索引指定文档ID（逗号分隔）' },
        { name: '--force', description: '强制重建索引（按范围删除后重建）' },
        { name: '--remove', description: '只移除索引，不重新索引' },
        { name: '--batch-size', description: '批量大小（默认：5）' }
      ],
      examples: [
        'siyuan index                           # 增量索引（清理孤立、更新变化）',
        'siyuan index <notebook-id>            # 索引指定笔记本（自动识别）',
        'siyuan index <doc-id>                 # 索引指定文档（自动识别）',
        'siyuan index --notebook <id>          # 索引指定笔记本',
        'siyuan index --doc-ids id1,id2        # 索引多个文档',
        'siyuan index <doc-id> --force         # 强制重建该文档索引',
        'siyuan index --notebook <id> --force  # 强制重建该笔记本索引',
        'siyuan index --force                  # 强制重建所有索引（清空集合）',
        'siyuan index <doc-id> --remove        # 移除该文档的索引',
        'siyuan index --notebook <id> --remove # 移除该笔记本的索引',
        'siyuan index --remove                 # 移除所有索引',
        'siyuan index --batch-size 10'
      ]
    },
    'nlp': {
      aliases: [],
      description: 'NLP 文本分析 [实验性功能]',
      usage: 'siyuan nlp <text> [--tasks <tasks>] [--top-n <topN>]',
      options: [
        { name: '--tasks', description: '分析任务列表（逗号分隔）：tokenize,entities,keywords,summary,language,all' },
        { name: '--top-n', description: '返回前 N 个关键词（默认：10）' }
      ],
      examples: [
        'siyuan nlp "这是一段需要分析的文本"',
        'siyuan nlp "文本内容" --tasks tokenize,entities,keywords',
        'siyuan nlp "文本内容" --tasks all',
        'siyuan nlp "文本内容" --top-n 5'
      ]
    },
    'block-insert': {
      aliases: ['bi'],
      description: '插入新块',
      usage: 'siyuan block-insert <content> --parent-id <parentId> [--data-type <type>]\n       siyuan block-insert <content> --previous-id <blockId>\n       siyuan block-insert <content> --next-id <blockId>',
      options: [
        { name: '<content>', description: '块内容（必需）' },
        { name: '--parent-id, -p', description: '父块ID（必需，三者选一）' },
        { name: '--previous-id', description: '前一个块ID，插入其后（必需，三者选一）' },
        { name: '--next-id', description: '后一个块ID，插入其前（必需，三者选一）' },
        { name: '--data-type', description: '数据类型：markdown/dom（默认：markdown）' }
      ],
      examples: [
        'siyuan bi "新块内容" --parent-id 20260313203048-cjem96v',
        'siyuan block-insert "新段落" --previous-id 20260313203048-cjem96v',
        'siyuan bi -p 20260313203048-cjem96v "新块"'
      ]
    },
    'block-update': {
      aliases: ['bu'],
      description: '更新块内容（仅接受块ID，不接受文档ID）',
      usage: 'siyuan block-update <blockId> <content> [--data-type <type>]',
      options: [
        { name: '<blockId>', description: '块ID（必需，位置参数，不接受文档ID）' },
        { name: '<content>', description: '新内容（必需，位置参数）' },
        { name: '--id', description: '块ID（可选，等同于位置参数）' },
        { name: '--data', description: '新内容（可选，等同于位置参数）' },
        { name: '--data-type', description: '数据类型：markdown/dom（默认：markdown）' }
      ],
      notes: [
        '此命令仅用于更新块内容，不接受文档ID',
        '如需更新文档内容，请使用 update 命令'
      ],
      examples: [
        'siyuan bu <blockId> "更新后的内容"',
        'siyuan block-update <blockId> "更新后的内容"',
        'siyuan bu --id <blockId> --data "更新后的内容"',
        'siyuan bu <blockId> "内容" --data-type dom'
      ]
    },
    'block-delete': {
      aliases: ['bd'],
      description: '删除块',
      usage: 'siyuan block-delete <blockId>',
      options: [
        { name: '<blockId>', description: '块ID（必需，位置参数）' },
        { name: '--id', description: '块ID（可选，等同于位置参数）' }
      ],
      examples: [
        'siyuan bd <blockId>',
        'siyuan block-delete <blockId>',
        'siyuan bd --id <blockId>'
      ]
    },
    'block-move': {
      aliases: ['bm'],
      description: '移动块',
      usage: 'siyuan block-move <blockId> [--parent-id <parentId>] [--previous-id <previousId>]',
      options: [
        { name: '<blockId>', description: '要移动的块ID（必需，位置参数）' },
        { name: '--id', description: '块ID（可选，等同于位置参数）' },
        { name: '--parent-id, -p', description: '目标父块ID' },
        { name: '--previous-id', description: '目标前一个块ID' }
      ],
      examples: [
        'siyuan bm <blockId> -p <targetParentId>',
        'siyuan block-move <blockId> --previous-id <targetPreviousId>',
        'siyuan bm --id <blockId> --previous-id <targetPreviousId>'
      ]
    },
    'block-get': {
      aliases: ['bg'],
      description: '获取块信息',
      usage: 'siyuan block-get <blockId> [--mode <mode>]',
      options: [
        { name: '<blockId>', description: '块ID（必需，位置参数）' },
        { name: '--id', description: '块ID（可选，等同于位置参数）' },
        { name: '--mode, -m', description: '查询模式：kramdown/children（默认：kramdown）' }
      ],
      examples: [
        'siyuan bg <blockId>',
        'siyuan block-get <blockId> -m children',
        'siyuan bg --id <blockId>'
      ]
    },
    'block-fold': {
      aliases: ['bf', 'block-unfold', 'buu'],
      description: '折叠或展开块',
      usage: 'siyuan block-fold <blockId> [--action <fold|unfold>]',
      options: [
        { name: '<blockId>', description: '块ID（必需，位置参数）' },
        { name: '--id', description: '块ID（可选，等同于位置参数）' },
        { name: '--action, -a', description: '操作类型：fold（折叠）或 unfold（展开），默认 fold' }
      ],
      examples: [
        'siyuan bf <blockId>              # 折叠块',
        'siyuan buu <blockId>            # 展开块',
        'siyuan block-fold <blockId> -a unfold',
        'siyuan bf --id <blockId> -a fold'
      ]
    },
    'block-transfer-ref': {
      aliases: ['btr'],
      description: '转移块引用',
      usage: 'siyuan block-transfer-ref --from-id <fromId> --to-id <toId> [--ref-ids <refIds>]',
      options: [
        { name: '--from-id', description: '定义块 ID（必需）' },
        { name: '--to-id', description: '目标块 ID（必需）' },
        { name: '--ref-ids', description: '引用块 ID（逗号分隔，可选）' }
      ],
      examples: [
        'siyuan btr --from-id <fromId> --to-id <toId>',
        'siyuan block-transfer-ref --from-id <fromId> --to-id <toId> --ref-ids "ref1,ref2,ref3"',
        'siyuan btr --from-id <fromId> --to-id <toId>'
      ]
    },
    'block-attrs': {
      aliases: ['ba', 'attrs'],
      description: '管理块/文档属性（设置/获取/移除，默认自动添加 custom- 前缀）',
      usage: 'siyuan block-attrs <docId|blockId> (--set <attrs> | --get [key] | --remove <keys>) [--hide]',
      options: [
        { name: '<docId|blockId>', description: '块ID/文档ID（必传，位置参数）' },
        { name: '--set, -S', description: '设置属性（key=value格式，多个用逗号分隔）' },
        { name: '--get, -g', description: '获取属性（不带参数取所有，带参数取指定属性）' },
        { name: '--remove', description: '移除属性（传入属性键名，多个用逗号分隔）' },
        { name: '--hide', description: '设置内部属性（不带 custom- 前缀，在界面不可见）' }
      ],
      examples: [
        'siyuan attrs <docId> -S "status=draft,priority=high"',
        'siyuan attrs <blockId> -S "internal=true" --hide',
        'siyuan attrs <docId> -g',
        'siyuan attrs <blockId> -g "status"',
        'siyuan attrs <docId> -g "internal" --hide',
        'siyuan attrs <docId> --remove "status"',
        'siyuan attrs <blockId> --remove "status,priority"'
      ]
    },
    'tags': {
      description: '设置块/文档标签',
      usage: 'siyuan tags <id> --tags <tags> [--add] [--remove] [--get]',
      options: [
        { name: '<id>', description: '块ID/文档ID（必需，位置参数）' },
        { name: '--id', description: '块ID/文档ID（可选，等同于位置参数）' },
        { name: '--tags, -t', description: '标签内容（逗号分隔多个标签）' },
        { name: '--add, -a', description: '添加标签（追加模式）' },
        { name: '--remove', description: '移除指定标签' },
        { name: '--get, -g', description: '获取当前标签' }
      ],
      examples: [
        'siyuan tags <id> -t "标签1,标签2"',
        'siyuan tags <id> -t "新标签" -a',
        'siyuan tags <id> -t "旧标签" --remove',
        'siyuan tags <id> -g'
      ]
    },
    'exists': {
      aliases: ['check', 'check-exists'],
      description: '检查文档是否存在',
      usage: 'siyuan exists (--title <title> [--parent-id <parentId>] | --path <path>) [--notebook-id <notebookId>]',
      options: [
        { name: '--title, -t', description: '文档标题（与 --path 二选一）' },
        { name: '--path', description: '文档完整路径（与 --title 二选一）' },
        { name: '--parent-id, -p', description: '父文档ID（可选，不指定则检查笔记本根目录）' },
        { name: '--notebook-id, -n', description: '笔记本ID（可选，不指定则使用默认笔记本）' }
      ],
      examples: [
        'siyuan exists --title "我的文档"',
        'siyuan exists --title "子文档" --parent-id <父文档ID>',
        'siyuan exists --path "/测试目录/子文档A"',
        'siyuan check "文档标题"'
      ]
    },
    'icon': {
      aliases: ['set-icon'],
      description: '设置或获取文档/块图标（emoji 编码）',
      usage: 'siyuan icon <id> [--emoji <emoji>] [--get] [--remove]',
      notes: [
        '图标使用 emoji Unicode 编码（不带 U+ 前缀）',
        '例如：1f4c4 = 📄, 1f4d4 = 📔, 1f5c2 = 📂',
        '可使用在线工具将 emoji 转换为编码：https://unicode.org/emoji/charts/',
        '多色 emoji 编码格式：1f5c2-fe0f'
      ],
      options: [
        { name: '<id>', description: '文档ID或块ID（必需，位置参数）' },
        { name: '--emoji, -e', description: 'emoji 编码（不带 U+ 前缀）或直接传入 emoji 字符' },
        { name: '--get, -g', description: '获取当前图标' },
        { name: '--remove, -r', description: '移除图标' }
      ],
      examples: [
        'siyuan icon <doc-id> --emoji 1f4c4',
        'siyuan icon <doc-id> --emoji 📄',
        'siyuan icon <doc-id> --get',
        'siyuan icon <doc-id> --remove',
        'siyuan set-icon <doc-id> -e 1f4a1'
      ]
    }
  };

  const help = commandHelps[mainCommand];
  if (!help) {
    console.log(`\n❌ 未知命令: ${command}`);
    console.log('使用 "siyuan help" 查看所有可用命令\n');
    return;
  }

  console.log(`
${'='.repeat(60)}
命令: ${command}${mainCommand !== command ? ` (${mainCommand})` : ''}
${'='.repeat(60)}

${help.description}

用法:
  ${help.usage}
${help.notes ? '\n注意事项:\n' : ''}${help.notes ? help.notes.map(note => 
    note === '' ? '' : `  ${note}`
  ).join('\n') : ''}
${help.options ? '\n选项:\n' : ''}${help.options ? help.options.map(opt => 
    `  ${opt.name.padEnd(20)} ${opt.description}`
  ).join('\n') : ''}
${help.returns ? '\n返回字段:\n' : ''}${help.returns ? help.returns.map(ret => 
    `  ${ret}`
  ).join('\n') : ''}

示例:
${help.examples.map(ex => `  ${ex}`).join('\n')}
${'='.repeat(60)}

提示: 使用 "siyuan help" 查看所有可用命令
`);
}

/**
 * 主函数
 * @param {Array} customArgs - 自定义命令行参数（可选，用于测试）
 */
async function main(customArgs = null) {
  const args = customArgs || process.argv.slice(2);

  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    const helpCommand = args[1];
    showHelp(helpCommand);
    process.exit(0);
  }
  
  // 直接使用 createSkill()，让它内部的 ConfigManager 负责加载配置
  // 这样可以确保 config.json 文件被正确解析，包括 defaultNotebook
  const command = args[0];
  const skill = createSkill();
  
  try {
    // 根据命令和参数决定是否需要初始化高级功能
    // 只有向量搜索模式才需要初始化向量功能
    let needsVectorSearch = false;
    
    if (['search', 'find'].includes(command)) {
      const modeIndex = args.indexOf('--mode');
      const mode = modeIndex !== -1 && modeIndex + 1 < args.length ? args[modeIndex + 1] : 'legacy';
      needsVectorSearch = ['semantic', 'hybrid'].includes(mode);
    } else if (['index', 'index-documents'].includes(command)) {
      needsVectorSearch = true;
    }
    
    const needsNLP = ['nlp', 'nlp-analyze'].includes(command);
    
    await skill.init({
      initVectorSearch: needsVectorSearch,
      initNLP: needsNLP
    });
    
    const mainCommand = ALIAS_MAP[command] || command;
    
    switch (mainCommand) {
      case 'get-notebooks':
      case 'notebooks':
      case 'nb':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('notebooks');
          process.exit(0);
        }
        console.log('获取笔记本列表...');
        const notebooks = await skill.executeCommand('get-notebooks', {});
        console.log(JSON.stringify(notebooks, null, 2));
        break;
        
      case 'get-doc-structure':
      case 'structure':
      case 'ls':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('structure');
          process.exit(0);
        }
        console.log('获取文档结构...');
        const structureParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--path': { hasValue: true, aliases: ['-P'] },
            '--depth': { hasValue: true, aliases: ['-d'] }
          },
          positionalCount: 1
        });
        const structureArgs = {};
        if (structureParsed.positional.length > 0) {
          structureArgs.notebookId = structureParsed.positional[0];
        }
        if (structureParsed.options.path) structureArgs.path = structureParsed.options.path;
        if (structureParsed.options.depth) structureArgs.depth = parseInt(structureParsed.options.depth, 10);
        if (!structureArgs.notebookId && !structureArgs.path) {
          console.error('错误: 请提供笔记本ID/文档ID 或 --path 参数');
          console.log('用法: siyuan structure [<notebookId|docId>] [--path <path>]');
          process.exit(1);
        }
        if (structureArgs.notebookId && structureArgs.path) {
          console.error('错误: 位置参数和 --path 不能同时使用');
          console.log('用法: siyuan structure [<notebookId|docId>] 或 siyuan structure --path <path>');
          process.exit(1);
        }
        const structure = await skill.executeCommand('get-doc-structure', structureArgs);
        console.log(JSON.stringify(structure, null, 2));
        break;
        
      case 'get-doc-content':
      case 'content':
      case 'cat':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('content');
          process.exit(0);
        }
        console.log('获取文档内容...');
        const contentParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--doc-id': { hasValue: true, aliases: ['--id', '-D'] },
            '--path': { hasValue: true, aliases: ['-P'] },
            '--format': { hasValue: true, aliases: ['-F'] },
            '--raw': { isFlag: true, aliases: ['-r'] }
          },
          positionalCount: 1
        });
        const contentArgs = {};
        if (contentParsed.positional.length > 0) {
          contentArgs.docId = contentParsed.positional[0];
        }
        if (contentParsed.options.docId) contentArgs.docId = contentParsed.options.docId;
        if (contentParsed.options.path) contentArgs.path = contentParsed.options.path;
        if (contentParsed.options.format) contentArgs.format = contentParsed.options.format;
        if (contentParsed.options.raw) contentArgs.raw = true;
        if (!contentArgs.docId && !contentArgs.path) {
          console.error('错误: 请提供 --doc-id 或 --path 参数');
          console.log('用法: siyuan content (--doc-id <docId> | --path <path>) [--format <format>] [--raw]');
          process.exit(1);
        }
        const content = await skill.executeCommand('get-doc-content', contentArgs);
        if (typeof content === 'string') {
          console.log(content);
        } else {
          console.log(JSON.stringify(content, null, 2));
        }
        break;
        
      case 'get-doc-info':
      case 'info':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('get-doc-info');
          process.exit(0);
        }
        console.log('获取文档信息...');
        const infoParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--id': { hasValue: true },
            '--format': { hasValue: true, aliases: ['-F'] }
          },
          positionalCount: 1
        });
        const infoArgs = {};
        if (infoParsed.positional.length > 0) {
          infoArgs.id = infoParsed.positional[0];
        }
        if (infoParsed.options.id) infoArgs.id = infoParsed.options.id;
        if (infoParsed.options.format) infoArgs.format = infoParsed.options.format;
        if (!infoArgs.id) {
          console.error('错误: 请提供文档ID');
          console.log('用法: siyuan info <docId> [--format <format>]');
          process.exit(1);
        }
        const infoResult = await skill.executeCommand('get-doc-info', infoArgs);
        console.log(JSON.stringify(infoResult, null, 2));
        break;
        
      case 'check-exists':
      case 'exists':
      case 'check':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('exists');
          process.exit(0);
        }
        console.log('检查文档是否存在...');
        const existsParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--title': { hasValue: true, aliases: ['-t'] },
            '--parent-id': { hasValue: true, aliases: ['-p'] },
            '--notebook-id': { hasValue: true, aliases: ['-n', '--notebook'] },
            '--path': { hasValue: true }
          },
          positionalCount: 1
        });
        const existsArgs = {};
        if (existsParsed.positional.length > 0) {
          existsArgs.title = existsParsed.positional[0];
        }
        if (existsParsed.options.title) existsArgs.title = existsParsed.options.title;
        if (existsParsed.options.parentId) existsArgs.parentId = existsParsed.options.parentId;
        if (existsParsed.options.notebookId) existsArgs.notebookId = existsParsed.options.notebookId;
        if (existsParsed.options.path) existsArgs.path = existsParsed.options.path;
        const existsResult = await skill.executeCommand('check-exists', existsArgs);
        console.log(JSON.stringify(existsResult, null, 2));
        break;
        
      case 'search-content':
      case 'search':
      case 'find':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('search');
          process.exit(0);
        }
        console.log('搜索内容...');
        const searchParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--type': { hasValue: true, aliases: ['-T'] },
            '--types': { hasValue: true },
            '--sort-by': { hasValue: true, aliases: ['-s'] },
            '--limit': { hasValue: true, aliases: ['-l'] },
            '--path': { hasValue: true, aliases: ['-P'] },
            '--where': { hasValue: true },
            '--mode': { hasValue: true, aliases: ['-m'] },
            '--notebook': { hasValue: true, aliases: ['-n'] },
            '--notebook-id': { hasValue: true, aliases: ['--notebook'] },
            '--sql-weight': { hasValue: true },
            '--dense-weight': { hasValue: true },
            '--sparse-weight': { hasValue: true },
            '--threshold': { hasValue: true }
          },
          positionalCount: 1
        });
        const searchArgs = {};
        if (searchParsed.positional.length > 0) {
          searchArgs.query = searchParsed.positional[0];
        }
        if (searchParsed.options.type) searchArgs.type = searchParsed.options.type;
        if (searchParsed.options.types) searchArgs.types = searchParsed.options.types;
        if (searchParsed.options.sortBy) searchArgs.sortBy = searchParsed.options.sortBy;
        if (searchParsed.options.limit) searchArgs.limit = parseInt(searchParsed.options.limit, 10);
        if (searchParsed.options.path) searchArgs.path = searchParsed.options.path;
        if (searchParsed.options.where) searchArgs.sql = searchParsed.options.where;
        if (searchParsed.options.mode) searchArgs.mode = searchParsed.options.mode;
        if (searchParsed.options.notebookId) searchArgs.notebookId = searchParsed.options.notebookId;
        if (searchParsed.options.sqlWeight) searchArgs.sqlWeight = parseFloat(searchParsed.options.sqlWeight);
        if (searchParsed.options.denseWeight) searchArgs.denseWeight = parseFloat(searchParsed.options.denseWeight);
        if (searchParsed.options.sparseWeight) searchArgs.sparseWeight = parseFloat(searchParsed.options.sparseWeight);
        if (searchParsed.options.threshold) searchArgs.threshold = parseFloat(searchParsed.options.threshold);
        if (!searchArgs.query) {
          console.error('错误: 请提供搜索关键词');
          console.log('用法: siyuan search <query> [--type <type>] [--types <types>] [--sort-by <sortBy>] [--limit <limit>] [--mode hybrid|semantic|keyword|legacy] [--sql-weight <weight>] [--dense-weight <weight>] [--sparse-weight <weight>] [--threshold <score>]');
          process.exit(1);
        }
        const searchResult = await skill.executeCommand('search-content', searchArgs);
        console.log(JSON.stringify(searchResult, null, 2));
        break;
        
      case 'create-document':
      case 'create':
      case 'new':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('create');
          process.exit(0);
        }
        
        const createParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--parent-id': { hasValue: true, aliases: ['--parent', '-p'] },
            '--path': { hasValue: true, aliases: ['-P'] },
            '--title': { hasValue: true, aliases: ['-t'] },
            '--force': { isFlag: true },
            '--file': { hasValue: true, aliases: ['-f'] }
          },
          positionalCount: 2,
          commonMistakes: {
            '--parent-path': '--path（用于指定完整路径）或 --parent-id（用于指定父文档ID）',
            '--notebook': '--parent-id（指定笔记本ID作为父ID）',
            '--folder': '--parent-id（指定父文档ID）或 --path（指定完整路径）',
            '--dir': '--parent-id（指定父文档ID）或 --path（指定完整路径）',
            '--from-file': '--file（从文件读取内容）'
          }
        });
        
        let createTitle = createParsed.options.title || '';
        let createParentId = createParsed.options.parentId || '';
        let createPath = createParsed.options.path || '';
        let createForce = createParsed.options.force || false;
        
        // 处理 --path 模式
        if (createPath) {
          const pathEndsWithSlash = createPath.endsWith('/');
          const pathParts = createPath.split('/').filter(p => p.trim());
          
          if (pathEndsWithSlash || pathParts.length === 0) {
            // 模式3：路径末尾有 /，表示在此目录下创建
            // 需要 title 参数，位置参数1=标题，位置参数2=内容
            if (!createTitle && createParsed.positional.length > 0) {
              createTitle = createParsed.positional[0];
            }
            
            if (!createTitle) {
              console.error('错误: 使用 --path "路径/" 在目录下创建时，需要提供标题');
              console.log('用法: siyuan create --path "笔记本/目录/" "标题" [内容]');
              console.log('  或: siyuan create --path "笔记本/目录/" --title "标题" --file content.md');
              process.exit(1);
            }
            
            // 内容来源：--file > 位置参数1（因为位置参数0是标题）
            const contentResult = resolveContent(createParsed.options, createParsed.positional, 1);
            const createContent = contentResult.content;
            if (contentResult.source !== 'none' && contentResult.source !== 'argument') {
              console.log(`内容来源: ${contentResult.source}${createContent ? ` (${createContent.length} 字符)` : ''}`);
            }
            
            // ... 继续创建逻辑
            await performCreate(createTitle, createContent, createParentId, createPath, createForce, skill);
          } else {
            // 模式1/2：路径指向最终文档
            // 标题从路径最后一段提取，可用 --title 覆盖
            if (!createTitle) {
              createTitle = pathParts[pathParts.length - 1];
            }
            
            // 内容来源：--file > 位置参数0
            const contentResult = resolveContent(createParsed.options, createParsed.positional, 0);
            const createContent = contentResult.content;
            if (contentResult.source !== 'none' && contentResult.source !== 'argument') {
              console.log(`内容来源: ${contentResult.source}${createContent ? ` (${createContent.length} 字符)` : ''}`);
            }
            
            await performCreate(createTitle, createContent, createParentId, createPath, createForce, skill);
          }
        } else {
          // 无 --path 模式：位置参数1=标题，位置参数2=内容
          if (createParsed.positional.length === 0) {
            console.error('错误: 请提供文档标题');
            console.log('用法: siyuan create <title> [content] [--parent-id <parentId>]');
            console.log('  或: siyuan create <title> --file content.md [--parent-id <parentId>]');
            process.exit(1);
          }
          createTitle = createParsed.positional[0];
          
          // 内容来源：--file > 位置参数1
          const contentResult = resolveContent(createParsed.options, createParsed.positional, 1);
          const createContent = contentResult.content;
          if (contentResult.source !== 'none' && contentResult.source !== 'argument') {
            console.log(`内容来源: ${contentResult.source}${createContent ? ` (${createContent.length} 字符)` : ''}`);
          }
          
          await performCreate(createTitle, createContent, createParentId, createPath, createForce, skill);
        }
        break;
        
      case 'update-document':
      case 'update':
      case 'edit':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('update');
          process.exit(0);
        }
        
        // 使用通用参数解析器
        const updateParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--data-type': { hasValue: true },
            '--file': { hasValue: true, aliases: ['-f'] }
          },
          positionalCount: 2
        });
        
        if (updateParsed.positional.length < 1) {
          console.error('错误: 请提供文档ID');
          console.log('用法: siyuan update <docId> <content> [--data-type <type>]');
          console.log('  或: siyuan update <docId> --file content.md');
          process.exit(1);
        }
        
        // 内容来源：--file > 位置参数1
        const updateContentResult = resolveContent(updateParsed.options, updateParsed.positional, 1);
        
        if (!updateContentResult.content && updateContentResult.source === 'none') {
          console.error('错误: 请提供内容（或使用 --file）');
          console.log('用法: siyuan update <docId> <content> [--data-type <type>]');
          console.log('  或: siyuan update <docId> --file content.md');
          process.exit(1);
        }
        
        const updateContent = updateContentResult.content;
        if (updateContentResult.source !== 'argument') {
          console.log(`内容来源: ${updateContentResult.source}${updateContent ? ` (${updateContent.length} 字符)` : ''}`);
        }
        
        console.log('更新文档...');
        const updateDocArgs = {
          docId: updateParsed.positional[0],
          content: updateContent,
          dataType: updateParsed.options.dataType
        };
        
        const updateDocResult = await skill.executeCommand('update-document', updateDocArgs);
        console.log(JSON.stringify(updateDocResult, null, 2));
        break;
        
      case 'delete-document':
      case 'delete':
      case 'rm':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('delete');
          process.exit(0);
        }
        
        // 使用通用参数解析器
        const deleteParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--confirm-title': { hasValue: true }
          },
          positionalCount: 1
        });
        
        if (deleteParsed.positional.length < 1) {
          console.error('错误: 请提供文档ID');
          console.log('用法: siyuan delete <docId> [--confirm-title <title>]');
          process.exit(1);
        }
        
        console.log('删除文档...');
        const deleteResult = await skill.executeCommand('delete-document', {
          docId: deleteParsed.positional[0],
          confirmTitle: deleteParsed.options.confirmTitle
        });
        console.log(JSON.stringify(deleteResult, null, 2));
        break;
        
      case 'protect-document':
      case 'protect':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('protect');
          process.exit(0);
        }
        
        // 使用通用参数解析器
        const protectParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--remove': { isFlag: true },
            '--permanent': { isFlag: true }
          },
          positionalCount: 1
        });
        
        if (protectParsed.positional.length < 1) {
          console.error('错误: 请提供文档ID');
          console.log('用法: siyuan protect <docId> [--remove] [--permanent]');
          process.exit(1);
        }
        
        console.log('设置文档保护...');
        const protectResult = await skill.executeCommand('protect-document', {
          docId: protectParsed.positional[0],
          remove: protectParsed.options.remove || false,
          permanent: protectParsed.options.permanent || false
        });
        console.log(JSON.stringify(protectResult, null, 2));
        break;
        
      case 'move-document':
      case 'move':
      case 'mv':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('move');
          process.exit(0);
        }
        
        // 使用通用参数解析器
        const moveParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--new-title': { hasValue: true }
          },
          positionalCount: 2
        });
        
        if (moveParsed.positional.length < 2) {
          console.error('错误：请提供文档 ID/路径和目标位置');
          console.log('用法：siyuan move <docId|path> <targetParentId|path> [--new-title <title>]');
          process.exit(1);
        }
        
        console.log('移动文档...');
        let moveNewTitle = moveParsed.options.newTitle;
        if (moveNewTitle && moveNewTitle.includes('/')) {
          const convertedTitle = moveNewTitle.replace(/\//g, '／');
          console.log(`⚠️ 标题包含斜杠，已自动转换: "${moveNewTitle}" → "${convertedTitle}"`);
          moveNewTitle = convertedTitle;
        }
        const moveArgs = {
          docId: moveParsed.positional[0],
          targetParentId: moveParsed.positional[1],
          newTitle: moveNewTitle
        };
        
        console.log('文档 ID/路径:', moveArgs.docId);
        console.log('目标位置:', moveArgs.targetParentId);
        if (moveArgs.newTitle) {
          console.log('新标题:', moveArgs.newTitle);
        }
        
        const moveResult = await skill.executeCommand('move-document', moveArgs);
        console.log(JSON.stringify(moveResult, null, 2));
        break;
        
      case 'index-documents':
      case 'index':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('index');
          process.exit(0);
        }
        console.log('索引文档...');
        
        // 解析参数
        const indexArgs = {};
        
        // 支持位置参数：自动识别笔记本或文档
        if (args.length >= 2 && !args[1].startsWith('--')) {
          // 获取笔记本列表用于识别
          const notebooksResponse = await skill.connector.request('/api/notebook/lsNotebooks');
          const notebooks = notebooksResponse?.notebooks || notebooksResponse || [];
          const notebookIds = new Set(notebooks.map(n => n.id));
          
          if (notebookIds.has(args[1])) {
            indexArgs.notebookId = args[1];
          } else {
            indexArgs.docIds = [args[1]];
          }
        }
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--notebook' && i + 1 < args.length) {
            indexArgs.notebookId = args[++i];
          } else if (args[i] === '--doc-ids' && i + 1 < args.length) {
            const docIdsStr = args[++i];
            indexArgs.docIds = docIdsStr.split(',').map(id => id.trim());
          } else if (args[i] === '--force') {
            indexArgs.force = true;
          } else if (args[i] === '--remove') {
            indexArgs.remove = true;
          } else if (args[i] === '--batch-size' && i + 1 < args.length) {
            indexArgs.batchSize = parseInt(args[++i]);
          }
        }
        
        const indexResult = await skill.executeCommand('index-documents', indexArgs);
        console.log(JSON.stringify(indexResult, null, 2));
        break;
        
      case 'convert-path':
      case 'convert':
      case 'path':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('convert');
          process.exit(0);
        }
        if (args.length < 2) {
          console.error('错误：请提供文档 ID 或路径');
          console.log('用法：siyuan convert --id <docId> 或 siyuan convert --path <hPath>');
          process.exit(1);
        }
        console.log('转换 ID/路径...');
        
        // 解析参数
        const convertArgs = {};
        let hasIdOrPath = false;
        
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--id' && i + 1 < args.length) {
            convertArgs.id = args[++i];
            hasIdOrPath = true;
          } else if (args[i] === '--path' && i + 1 < args.length) {
            convertArgs.path = args[++i];
            hasIdOrPath = true;
          } else if (args[i] === '--force') {
            convertArgs.force = true;
          } else if (!args[i].startsWith('--') && !hasIdOrPath) {
            // 支持不带选项的简写方式，只处理第一个非选项参数
            const value = args[i];
            // 自动识别是 ID 还是路径 (14 位数字 + 短横线 + 7 位字母数字)
            if (/^\d{14}-[a-zA-Z0-9]{7}$/.test(value)) {
              convertArgs.id = value;
            } else {
              convertArgs.path = value;
            }
            hasIdOrPath = true;
          }
        }
        
        if (!convertArgs.id && !convertArgs.path) {
          console.error('错误：必须提供 --id 或 --path 参数');
          process.exit(1);
        }
        
        console.log('转换参数:', convertArgs);
        const convertResult = await skill.executeCommand('convert-path', convertArgs);
        console.log(JSON.stringify(convertResult, null, 2));
        break;
        
      case 'nlp-analyze':
      case 'nlp':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('nlp');
          process.exit(0);
        }
        if (args.length < 2) {
          console.error('错误: 请提供要分析的文本');
          console.log('用法: siyuan nlp <text> [--tasks <tasks>]');
          process.exit(1);
        }
        console.log('NLP 分析...');
        
        // 解析参数
        const nlpArgs = {
          text: args[1]
        };
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--tasks' && i + 1 < args.length) {
            nlpArgs.tasks = args[++i];
          } else if (args[i] === '--top-n' && i + 1 < args.length) {
            nlpArgs.topN = parseInt(args[++i], 10);
          }
        }
        
        console.log('分析文本:', nlpArgs.text.substring(0, 100) + '...');
        const nlpResult = await skill.executeCommand('nlp-analyze', nlpArgs);
        console.log(JSON.stringify(nlpResult, null, 2));
        break;
        
      case 'block-insert':
      case 'bi':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-insert');
          process.exit(0);
        }
        console.log('插入块...');
        
        // 使用通用参数解析器
        const insertBlockParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--data-type': { hasValue: true },
            '--parent-id': { hasValue: true, aliases: ['-p'] },
            '--previous-id': { hasValue: true },
            '--next-id': { hasValue: true }
          },
          positionalCount: 1
        });
        
        const insertBlockResult = await skill.executeCommand('block-insert', {
          data: insertBlockParsed.positional[0] || '',
          dataType: insertBlockParsed.options.dataType,
          parentId: insertBlockParsed.options.parentId,
          previousId: insertBlockParsed.options.previousId,
          nextId: insertBlockParsed.options.nextId
        });
        console.log(JSON.stringify(insertBlockResult, null, 2));
        break;
        
      case 'block-update':
      case 'bu':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-update');
          process.exit(0);
        }
        console.log('更新块...');
        
        // 使用通用参数解析器
        const updateBlockParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--data-type': { hasValue: true }
          },
          positionalCount: 2
        });
        
        if (updateBlockParsed.positional.length < 2) {
          console.error('错误: 请提供块ID和内容');
          console.log('用法: siyuan block-update <blockId> <content> [--data-type <type>]');
          process.exit(1);
        }
        
        const updateBlockResult = await skill.executeCommand('block-update', {
          id: updateBlockParsed.positional[0],
          data: updateBlockParsed.positional[1],
          dataType: updateBlockParsed.options.dataType
        });
        console.log(JSON.stringify(updateBlockResult, null, 2));
        break;
        
      case 'block-delete':
      case 'bd':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-delete');
          process.exit(0);
        }
        console.log('删除块...');
        
        // 使用通用参数解析器
        const deleteBlockParsed = parseCommandArgs(args.slice(1), {
          options: {},
          positionalCount: 1
        });
        
        if (deleteBlockParsed.positional.length < 1) {
          console.error('错误: 请提供块ID');
          console.log('用法: siyuan block-delete <blockId>');
          process.exit(1);
        }
        
        const deleteBlockResult = await skill.executeCommand('block-delete', {
          id: deleteBlockParsed.positional[0]
        });
        console.log(JSON.stringify(deleteBlockResult, null, 2));
        break;
        
      case 'block-move':
      case 'bm':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-move');
          process.exit(0);
        }
        console.log('移动块...');
        
        // 使用通用参数解析器
        const moveBlockParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--parent-id': { hasValue: true, aliases: ['-p'] },
            '--previous-id': { hasValue: true }
          },
          positionalCount: 1
        });
        
        const moveBlockResult = await skill.executeCommand('block-move', {
          id: moveBlockParsed.positional[0],
          parentId: moveBlockParsed.options.parentId,
          previousId: moveBlockParsed.options.previousId
        });
        console.log(JSON.stringify(moveBlockResult, null, 2));
        break;
        
      case 'block-get':
      case 'bg':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-get');
          process.exit(0);
        }
        console.log('获取块信息...');
        
        // 使用通用参数解析器
        const getBlockParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--mode': { hasValue: true, aliases: ['-m'] }
          },
          positionalCount: 1
        });
        
        const getBlockResult = await skill.executeCommand('block-get', {
          id: getBlockParsed.positional[0],
          mode: getBlockParsed.options.mode
        });
        console.log(JSON.stringify(getBlockResult, null, 2));
        break;
        
      case 'block-fold':
      case 'bf':
      case 'block-unfold':
      case 'buu':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-fold');
          process.exit(0);
        }
        
        // 使用通用参数解析器
        const foldBlockParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--action': { hasValue: true, aliases: ['-a'] }
          },
          positionalCount: 1
        });
        
        const defaultFoldAction = (command === 'block-unfold' || command === 'buu') ? 'unfold' : 'fold';
        const foldAction = foldBlockParsed.options.action || defaultFoldAction;
        
        console.log(`${foldAction === 'fold' ? '折叠' : '展开'}块...`);
        const foldBlockResult = await skill.executeCommand('block-fold', {
          id: foldBlockParsed.positional[0],
          action: foldAction
        });
        console.log(JSON.stringify(foldBlockResult, null, 2));
        break;
        
      case 'block-transfer-ref':
      case 'btr':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-transfer-ref');
          process.exit(0);
        }
        console.log('转移块引用...');
        
        // 使用通用参数解析器
        const transferBlockRefParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--from-id': { hasValue: true },
            '--to-id': { hasValue: true },
            '--ref-ids': { hasValue: true }
          },
          positionalCount: 0
        });
        
        const transferBlockRefResult = await skill.executeCommand('transfer-block-ref', {
          fromId: transferBlockRefParsed.options.fromId,
          toId: transferBlockRefParsed.options.toId,
          refIds: transferBlockRefParsed.options.refIds
        });
        console.log(JSON.stringify(transferBlockRefResult, null, 2));
        break;
        
      case 'rename-document':
      case 'rename':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('rename');
          process.exit(0);
        }
        
        // 使用通用参数解析器
        const renameParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--force': { isFlag: true }
          },
          positionalCount: 2
        });
        
        if (renameParsed.positional.length < 2) {
          console.error('错误：请提供文档 ID 和新标题');
          console.log('用法：siyuan rename <docId> <title> [--force]');
          process.exit(1);
        }
        
        let renameTitle = renameParsed.positional[1];
        if (renameTitle.includes('/')) {
          const convertedTitle = renameTitle.replace(/\//g, '／');
          console.log(`⚠️ 标题包含斜杠，已自动转换: "${renameTitle}" → "${convertedTitle}"`);
          renameTitle = convertedTitle;
        }
        
        console.log('重命名文档...');
        console.log('文档 ID:', renameParsed.positional[0]);
        console.log('新标题:', renameTitle);
        const renameResult = await skill.executeCommand('rename-document', {
          docId: renameParsed.positional[0],
          title: renameTitle,
          force: renameParsed.options.force || false
        });
        console.log(JSON.stringify(renameResult, null, 2));
        break;
        
      case 'block-attrs':
      case 'ba':
      case 'attrs':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-attrs');
          process.exit(0);
        }
        console.log('操作属性...');
        const baParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--id': { hasValue: true },
            '--attrs': { hasValue: true },
            '--set': { hasValue: true, aliases: ['--attrs', '-S'] },
            '--get': { isFlag: true, aliases: ['-g'] },
            '--key': { hasValue: true, aliases: ['-k'] },
            '--remove': { hasValue: true },
            '--hide': { isFlag: true }
          },
          positionalCount: 1
        });
        const setAttrsArgs = {};
        if (baParsed.positional.length > 0) {
          setAttrsArgs.id = baParsed.positional[0];
        }
        if (baParsed.options.id) setAttrsArgs.id = baParsed.options.id;
        if (baParsed.options.attrs) setAttrsArgs.attrs = baParsed.options.attrs;
        if (baParsed.options.set) setAttrsArgs.attrs = baParsed.options.set;
        if (baParsed.options.key) setAttrsArgs.key = baParsed.options.key;
        if (baParsed.options.get) setAttrsArgs.get = true;
        if (baParsed.options.remove) setAttrsArgs.remove = baParsed.options.remove;
        if (baParsed.options.hide) setAttrsArgs.hide = true;
        if (!setAttrsArgs.id) {
          console.error('错误：请提供块/文档 ID');
          console.log('用法：siyuan block-attrs <id> (--set <attrs> | --get [key] | --remove <keys>) [--hide]');
          process.exit(1);
        }
        const setAttrsResult = await skill.executeCommand('block-attrs', setAttrsArgs);
        console.log(JSON.stringify(setAttrsResult, null, 2));
        break;
        
      case 'tags':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('tags');
          process.exit(0);
        }
        console.log('设置标签...');
        const tagsParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--id': { hasValue: true },
            '--tags': { hasValue: true, aliases: ['-t'] },
            '--add': { isFlag: true, aliases: ['-a'] },
            '--remove': { isFlag: true },
            '--get': { isFlag: true, aliases: ['-g'] }
          },
          positionalCount: 1
        });
        const tagsArgs = {};
        if (tagsParsed.positional.length > 0) {
          tagsArgs.id = tagsParsed.positional[0];
        }
        if (tagsParsed.options.id) tagsArgs.id = tagsParsed.options.id;
        if (tagsParsed.options.tags) tagsArgs.tags = tagsParsed.options.tags;
        if (tagsParsed.options.add) tagsArgs.add = true;
        if (tagsParsed.options.remove) tagsArgs.remove = true;
        if (tagsParsed.options.get) tagsArgs.get = true;
        if (!tagsArgs.id) {
          console.error('错误：请提供块/文档 ID');
          console.log('用法：siyuan tags <id> --tags <tags> [--add] [--remove] [--get]');
          process.exit(1);
        }
        const tagsResult = await skill.executeCommand('tags', tagsArgs);
        console.log(JSON.stringify(tagsResult, null, 2));
        break;
        
      case 'set-icon':
      case 'icon':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('icon');
          process.exit(0);
        }
        
        const iconParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--emoji': { hasValue: true, aliases: ['-e'] },
            '--get': { isFlag: true, aliases: ['-g'] },
            '--remove': { isFlag: true, aliases: ['-r'] }
          },
          positionalCount: 1
        });
        
        if (iconParsed.positional.length < 1) {
          console.error('错误：请提供文档ID或块ID');
          console.log('用法：siyuan icon <id> [--emoji <emoji>] [--get] [--remove]');
          process.exit(1);
        }
        
        const iconId = iconParsed.positional[0];
        const iconEmoji = iconParsed.options.emoji || '';
        const iconGet = iconParsed.options.get || false;
        const iconRemove = iconParsed.options.remove || false;
        
        if (iconGet) {
          console.log('获取图标...');
          const getIconResult = await skill.executeCommand('block-attrs', {
            id: iconId,
            get: true,
            key: 'icon',
            hide: true
          });
          console.log(JSON.stringify(getIconResult, null, 2));
        } else if (iconRemove) {
          console.log('移除图标...');
          const removeIconResult = await skill.executeCommand('block-attrs', {
            id: iconId,
            remove: 'icon',
            hide: true
          });
          console.log(JSON.stringify(removeIconResult, null, 2));
        } else if (iconEmoji) {
          let emojiCode = iconEmoji;
          if (iconEmoji.length <= 4 || /^[\u{1F300}-\u{1F9FF}]+$/u.test(iconEmoji)) {
            const codePoints = [];
            for (const char of iconEmoji) {
              codePoints.push(char.codePointAt(0).toString(16));
            }
            emojiCode = codePoints.join('-');
            console.log(`转换 emoji 为编码: ${iconEmoji} -> ${emojiCode}`);
          }
          
          console.log('设置图标...');
          console.log('ID:', iconId);
          console.log('图标编码:', emojiCode);
          const setIconResult = await skill.executeCommand('block-attrs', {
            id: iconId,
            attrs: `icon=${emojiCode}`,
            hide: true
          });
          console.log(JSON.stringify(setIconResult, null, 2));
        } else {
          console.error('错误：请指定操作');
          console.log('用法：');
          console.log('  siyuan icon <id> --emoji <emoji>  # 设置图标');
          console.log('  siyuan icon <id> --get            # 获取图标');
          console.log('  siyuan icon <id> --remove         # 移除图标');
          process.exit(1);
        }
        break;
        
      default:
        console.error(`错误: 未知命令 "${command}"`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('执行失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

module.exports = { main };

// 直接运行时执行
if (require.main === module) {
  main();
}