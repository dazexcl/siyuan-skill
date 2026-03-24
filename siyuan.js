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

const { createSkill } = require('./index');

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
    optionMap[name] = opt;
    if (opt.aliases) {
      for (const alias of opt.aliases) {
        optionMap[alias] = { ...opt, targetName: name };
      }
    }
  }
  
  const knownOptions = Object.keys(optionMap);
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      // 检测常见错误参数
      if (commonMistakes[arg]) {
        console.error(`\n❌ 未知参数: ${arg}`);
        console.error(`您可能想使用: ${commonMistakes[arg]}`);
        process.exit(1);
      }
      
      // 检查是否是已知选项
      const optConfig = optionMap[arg];
      if (optConfig) {
        const targetName = optConfig.targetName || arg.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        
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
  'bf': 'block-fold',
  'buu': 'block-fold',
  'block-unfold': 'block-fold',
  'btr': 'block-transfer-ref',
  'st': 'tags',
  'check': 'exists',
  'check-exists': 'exists'
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

命令:
  notebooks, nb                    获取所有笔记本列表
  structure, ls                    获取指定笔记本的文档结构
  content, cat                     获取文档内容
  create, new                      创建文档（自动重名检测）
  update, edit                     更新文档内容（仅接受文档ID）
  delete, rm                       删除文档（受保护机制约束）
  protect                          设置/移除文档保护标记
  move, mv                         移动文档（自动重名检测）
  rename                           重命名文档（自动重名检测）
  exists, check                    检查文档是否存在
  search, find                     搜索内容
  convert, path                    转换 ID 和路径
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
      description: '获取指定笔记本的文档结构，支持笔记本ID和文档ID',
      usage: 'siyuan structure <notebookId|docId>',
      options: [],
      examples: [
        'siyuan structure <notebook-id>',
        'siyuan structure <doc-id>  # 使用文档ID获取子文档结构'
      ]
    },
    'content': {
      aliases: ['cat'],
      description: '获取文档内容',
      usage: 'siyuan content <docId> [--format <format>] [--raw]',
      options: [
        { name: '--format', description: '输出格式：kramdown、markdown、text、html（默认：kramdown）' },
        { name: '--raw', description: '以纯文本格式返回（移除JSON外部结构）' }
      ],
      examples: [
        'siyuan content <doc-id>',
        'siyuan content <doc-id> --format text',
        'siyuan content <doc-id> --raw',
        'siyuan content <doc-id> --format text --raw'
      ]
    },
    'search': {
      aliases: ['find'],
      description: '搜索内容（支持向量搜索）',
      usage: 'siyuan search <query> [options]',
      options: [
        { name: '--type', description: '按单个类型过滤 (d/p/h/l/i/tb/c/s/img)' },
        { name: '--types', description: '按多个类型过滤 (逗号分隔，如 d,p,h)' },
        { name: '--sort-by', description: '排序方式 (relevance/date)' },
        { name: '--limit', description: '结果数量限制' },
        { name: '--path', description: '搜索路径（仅搜索指定路径下的内容）' },
        { name: '--sql', description: '自定义SQL查询条件' },
        { name: '--mode', description: '搜索模式 (hybrid/semantic/keyword/legacy)' },
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
        'siyuan search "关键词" --sql "length(content) > 100"',
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
      usage: 'siyuan create <title> [content] [--parent-id <parentId>] [--path <path>] [--force]',
      notes: [
        '参数顺序灵活，以下写法都支持：',
        '  siyuan create "标题" "内容" --parent-id <id>',
        '  siyuan create --parent-id <id> "标题" "内容"',
        '  siyuan create "标题" --path "/路径" "内容"',
        '',
        '标题中的 / 会自动转换为全角 ／',
        '',
        '指定目标位置的方式：',
        '  --parent-id <id>  指定父文档/笔记本ID',
        '  --path "/路径"     指定完整路径（推荐）'
      ],
      options: [
        { name: '--parent-id, --parent', description: '父文档/笔记本ID' },
        { name: '--path', description: '文档路径（支持绝对路径或相对路径）' },
        { name: '--force', description: '强制创建（忽略重名检测）' }
      ],
      examples: [
        '# 基本用法',
        'siyuan create "我的文档"',
        'siyuan create "我的文档" "文档内容"',
        '',
        '# 指定目标位置（参数顺序灵活）',
        'siyuan create "子文档" "内容" --parent <parentId>',
        'siyuan create --parent-id <parentId> "子文档" "内容"',
        'siyuan create "子文档" --path /笔记本/目录/文档名 "内容"',
        '',
        '# 标题包含斜杠会自动转换',
        'siyuan create "文档/子标题" "内容"',
        '# 实际创建的标题为 "文档／子标题"'
      ]
    },
    'update-document': {
      aliases: ['edit', 'update'],
      description: '更新文档内容（仅接受文档ID，支持Markdown格式）',
      usage: 'siyuan update <docId> <content>',
      notes: [
        '此命令仅用于更新文档内容，需要传入文档ID',
        '如需更新块内容，请使用 block-update 命令'
      ],
      examples: [
        'siyuan update <doc-id> "新的文档内容"',
        'siyuan update <doc-id> "更新后的第一行\\n更新后的第二行"'
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
        { name: '--parent-id', description: '父块ID（必需，三者选一）' },
        { name: '--previous-id', description: '前一个块ID，插入其后（必需，三者选一）' },
        { name: '--next-id', description: '后一个块ID，插入其前（必需，三者选一）' },
        { name: '--data-type', description: '数据类型：markdown/dom（默认：markdown）' }
      ],
      examples: [
        'siyuan bi "新块内容" --parent-id 20260313203048-cjem96v',
        'siyuan block-insert "新段落" --previous-id 20260313203048-cjem96v',
        'siyuan bi --data "新块" --next-id 20260313203048-cjem96v'
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
        { name: '--parent-id', description: '目标父块ID' },
        { name: '--previous-id', description: '目标前一个块ID' }
      ],
      examples: [
        'siyuan bm <blockId> --parent-id <targetParentId>',
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
        { name: '--mode', description: '查询模式：kramdown/children（默认：kramdown）' }
      ],
      examples: [
        'siyuan bg <blockId>',
        'siyuan block-get <blockId> --mode children',
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
        { name: '--action', description: '操作类型：fold（折叠）或 unfold（展开），默认 fold' }
      ],
      examples: [
        'siyuan bf <blockId>              # 折叠块',
        'siyuan buu <blockId>            # 展开块',
        'siyuan block-fold <blockId> --action unfold',
        'siyuan bf --id <blockId> --action fold'
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
        { name: '--set', description: '设置属性（key=value格式，多个用逗号分隔）' },
        { name: '--get', description: '获取属性（不带参数取所有，带参数取指定属性）' },
        { name: '--remove', description: '移除属性（传入属性键名，多个用逗号分隔）' },
        { name: '--hide', description: '设置内部属性（不带 custom- 前缀，在界面不可见）' }
      ],
      examples: [
        'siyuan attrs <docId> --set "status=draft,priority=high"',
        'siyuan attrs <blockId> --set "internal=true" --hide',
        'siyuan attrs <docId> --get',
        'siyuan attrs <blockId> --get "status"',
        'siyuan attrs <docId> --get "internal" --hide',
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
        { name: '--tags', description: '标签内容（逗号分隔多个标签）' },
        { name: '--add', description: '添加标签（追加模式）' },
        { name: '--remove', description: '移除指定标签' },
        { name: '--get', description: '获取当前标签' }
      ],
      examples: [
        'siyuan tags <id> --tags "标签1,标签2"',
        'siyuan tags <id> --tags "新标签" --add',
        'siyuan tags <id> --tags "旧标签" --remove',
        'siyuan tags <id> --get'
      ]
    },
    'exists': {
      aliases: ['check', 'check-exists'],
      description: '检查文档是否存在',
      usage: 'siyuan exists --title <title> [--parent-id <parentId>] [--notebook-id <notebookId>]\n       siyuan exists --path <path> [--notebook-id <notebookId>]',
      options: [
        { name: '--title, -t', description: '文档标题（与 --path 二选一）' },
        { name: '--path', description: '文档完整路径（如 /目录/子文档）' },
        { name: '--parent-id, -p', description: '父文档ID（可选，不指定则检查笔记本根目录）' },
        { name: '--notebook-id, -n', description: '笔记本ID（可选，不指定则使用默认笔记本）' }
      ],
      examples: [
        'siyuan exists --title "我的文档"',
        'siyuan exists --title "子文档" --parent-id <父文档ID>',
        'siyuan exists --path "/测试目录/子文档A"',
        'siyuan check "文档标题"'
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
    // 根据命令决定是否需要初始化高级功能
    // 只有搜索相关命令才需要初始化向量搜索功能
    // NLP命令需要初始化NLP功能
    const needsAdvancedFeatures = ['search', 'find', 'index', 'index-documents'].includes(command);
    const needsNLP = ['nlp', 'nlp-analyze'].includes(command);
    
    await skill.init({
      initVectorSearch: needsAdvancedFeatures,
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
            '--notebook-id': { hasValue: true, aliases: ['--notebook'] }
          },
          positionalCount: 1
        });
        const structureArgs = {};
        if (structureParsed.positional.length > 0) {
          structureArgs.notebookId = structureParsed.positional[0];
        }
        if (structureParsed.options.notebookId) structureArgs.notebookId = structureParsed.options.notebookId;
        if (!structureArgs.notebookId) {
          console.error('错误: 请提供笔记本ID');
          console.log('用法: siyuan structure <notebookId>');
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
            '--doc-id': { hasValue: true, aliases: ['--id'] },
            '--format': { hasValue: true },
            '--raw': { isFlag: true }
          },
          positionalCount: 1
        });
        const contentArgs = {};
        if (contentParsed.positional.length > 0) {
          contentArgs.docId = contentParsed.positional[0];
        }
        if (contentParsed.options.docId) contentArgs.docId = contentParsed.options.docId;
        if (contentParsed.options.format) contentArgs.format = contentParsed.options.format;
        if (contentParsed.options.raw) contentArgs.raw = true;
        if (!contentArgs.docId) {
          console.error('错误: 请提供文档ID');
          console.log('用法: siyuan content <docId> [--format <format>] [--raw]');
          process.exit(1);
        }
        const content = await skill.executeCommand('get-doc-content', contentArgs);
        if (typeof content === 'string') {
          console.log(content);
        } else {
          console.log(JSON.stringify(content, null, 2));
        }
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
          positionalCount: 0
        });
        const existsArgs = {};
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
            '--type': { hasValue: true },
            '--types': { hasValue: true },
            '--sort-by': { hasValue: true },
            '--limit': { hasValue: true },
            '--path': { hasValue: true },
            '--sql': { hasValue: true },
            '--mode': { hasValue: true },
            '--notebook': { hasValue: true },
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
        if (searchParsed.options.sql) searchArgs.sql = searchParsed.options.sql;
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
        
        // 使用通用参数解析器
        const createParsed = parseCommandArgs(args.slice(1), {
          options: {
            '--parent-id': { hasValue: true, aliases: ['--parent'] },
            '--path': { hasValue: true },
            '--force': { isFlag: true }
          },
          positionalCount: 2,
          commonMistakes: {
            '--parent-path': '--path（用于指定完整路径）或 --parent-id（用于指定父文档ID）',
            '--notebook': '--parent-id（指定笔记本ID作为父ID）',
            '--folder': '--parent-id（指定父文档ID）或 --path（指定完整路径）',
            '--dir': '--parent-id（指定父文档ID）或 --path（指定完整路径）'
          }
        });
        
        if (createParsed.positional.length === 0) {
          console.error('错误: 请提供文档标题');
          console.log('用法: siyuan create <title> [content] [--parent-id <parentId>] [--path <path>] [--force]');
          process.exit(1);
        }
        
        let title = createParsed.positional[0];
        let docContent = createParsed.positional[1] || '';
        let parentId = createParsed.options.parentId || process.env.SIYUAN_DEFAULT_NOTEBOOK;
        let createPath = createParsed.options.path || '';
        let force = createParsed.options.force || false;
        
        // 处理标题中的斜杠：将 / 转换为全角 ／（避免被误认为路径分隔符）
        if (title.includes('/')) {
          const originalTitle = title;
          title = title.replace(/\//g, '／');
          console.log(`⚠️ 标题包含斜杠，已自动转换: "${originalTitle}" → "${title}"`);
        }
        
        // 如果未提供 parentId，使用技能配置的默认笔记本
        if (!parentId) {
          parentId = skill.config.defaultNotebook;
          if (!parentId) {
            console.error('错误: 未设置默认笔记本 ID');
            console.log('请设置环境变量 SIYUAN_DEFAULT_NOTEBOOK 或在 config.json 文件中配置 defaultNotebook，或使用 --parent-id 参数');
            process.exit(1);
          }
        }
        
        console.log('创建文档...');
        console.log('标题:', title);
        console.log('内容:', docContent || '(空)');
        if (parentId) {
          console.log('父文档 ID:', parentId);
        }
        if (createPath) {
          console.log('路径:', createPath);
        }
        console.log('强制创建:', force);
        
        const createResult = await skill.executeCommand('create-document', { 
          parentId: parentId,
          title: title,
          content: docContent,
          force: force,
          path: createPath
        });
        console.log(JSON.stringify(createResult, null, 2));
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
            '--data-type': { hasValue: true }
          },
          positionalCount: 2
        });
        
        if (updateParsed.positional.length < 2) {
          console.error('错误: 请提供文档ID和内容');
          console.log('用法: siyuan update <docId> <content> [--data-type <type>]');
          process.exit(1);
        }
        
        console.log('更新文档...');
        const updateDocArgs = {
          docId: updateParsed.positional[0],
          content: updateParsed.positional[1],
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
            '--parent-id': { hasValue: true },
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
            '--parent-id': { hasValue: true },
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
            '--mode': { hasValue: true }
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
            '--action': { hasValue: true }
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
            '--set': { hasValue: true, aliases: ['--attrs'] },
            '--get': { isFlag: true },
            '--key': { hasValue: true },
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
            '--tags': { hasValue: true },
            '--add': { isFlag: true },
            '--remove': { isFlag: true },
            '--get': { isFlag: true }
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