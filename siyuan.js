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
  structure, ls                   获取指定笔记本的文档结构
  content, cat                    获取文档内容
  search, find                     搜索内容
  create, new                      创建文档
  update, edit                      更新文档
  delete, rm                       删除文档（受保护机制约束）
  protect                          设置/移除文档保护标记
  move, mv                         移动文档
  convert, path                    转换 ID 和路径
  index, index-documents            索引文档到向量数据库
  nlp                              NLP 文本分析 [实验性]
  block-insert, bi                 插入新块
  block-update, bu                 更新块内容
  block-delete, bd                 删除块
  block-move, bm                   移动块
  block-get, bg                    获取块信息
  block-attrs, ba                  管理块属性
  block-fold, bf/buu               折叠/展开块
  block-transfer-ref, btr          转移块引用
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
  // 创建命令别名映射
  const aliasMap = {
    'nb': 'notebooks',
    'ls': 'structure',
    'cat': 'content',
    'find': 'search',
    'new': 'create',
    'edit': 'update',
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
    'bf': 'block-fold',
    'buu': 'block-fold',
    'block-unfold': 'block-fold',
    'btr': 'block-transfer-ref'
  };
  
  // 将别名转换为主命令名称
  const mainCommand = aliasMap[command] || command;
  
  const commandHelps = {
    'notebooks': {
      aliases: ['nb'],
      description: '获取所有笔记本列表',
      usage: 'siyuan notebooks [--force-refresh]',
      options: [
        { name: '--force-refresh', description: '强制刷新缓存' }
      ],
      examples: [
        'siyuan notebooks',
        'siyuan notebooks --force-refresh'
      ]
    },
    'structure': {
      aliases: ['ls'],
      description: '获取指定笔记本的文档结构，支持笔记本ID和文档ID',
      usage: 'siyuan structure <notebookId|docId> [--force-refresh]',
      options: [
        { name: '--force-refresh', description: '强制刷新缓存' }
      ],
      examples: [
        'siyuan structure <notebook-id>',
        'siyuan structure <notebook-id> --force-refresh',
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
      options: [
        { name: '--parent-id', description: '父文档/笔记本ID' },
        { name: '--path', description: '文档路径（支持绝对路径或相对路径）' },
        { name: '--force', description: '强制创建（忽略重名检测）' }
      ],
      examples: [
        'siyuan create "我的文档"',
        'siyuan create "我的文档" "文档内容"',
        'siyuan create "子文档" "文档内容" --parent-id <parentId>',
        'siyuan create "子文档" "文档内容" --path /AI/openclaw/插件',
        'siyuan create "子文档" "文档内容" --path /AI/openclaw/插件 --force',
        'siyuan create "多行文档" "第一行内容\\n第二行内容\\n第三行内容"'
      ]
    },
    'update': {
      aliases: ['edit'],
      description: '更新文档内容（实际更新文档块，支持Markdown格式）',
      usage: 'siyuan update <docId> <content>',
      notes: [
        '文档本身也是一种特殊的块（文档块），文档块ID = 文档ID',
        '使用 /api/block/updateBlock API 更新文档'
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
      description: '索引文档到向量数据库（支持增量索引和自动分块）',
      usage: 'siyuan index [<id>] [--notebook <id>] [--doc-ids <ids>] [--force] [--no-incremental]',
      options: [
        { name: '<id>', description: '位置参数：笔记本ID或文档ID（自动识别）' },
        { name: '--notebook', description: '索引指定笔记本' },
        { name: '--doc-ids', description: '索引指定文档ID（逗号分隔）' },
        { name: '--force', description: '强制重建索引（清空所有数据）' },
        { name: '--no-incremental', description: '禁用增量索引，重新索引所有文档' },
        { name: '--batch-size', description: '批量大小（默认：10）' }
      ],
      examples: [
        'siyuan index                         # 索引所有笔记本',
        'siyuan index <notebook-id>          # 索引指定笔记本（自动识别）',
        'siyuan index <doc-id>               # 索引指定文档（自动识别）',
        'siyuan index --notebook <id>        # 索引指定笔记本',
        'siyuan index --doc-ids id1,id2      # 索引多个文档',
        'siyuan index --force                # 强制重建索引',
        'siyuan index --doc-ids <docId1,docId2,docId3>',
        'siyuan index --batch-size 20'
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
      usage: 'siyuan block-insert <content> [--parent-id <parentId>] [--previous-id <previousId>] [--next-id <nextId>] [--data-type <type>]',
      options: [
        { name: '<content>', description: '块内容（必需，位置参数）' },
        { name: '--data', description: '块内容（可选，等同于位置参数）' },
        { name: '--data-type', description: '数据类型：markdown/dom（默认：markdown）' },
        { name: '--parent-id', description: '父块ID' },
        { name: '--previous-id', description: '前一个块ID' },
        { name: '--next-id', description: '后一个块ID' }
      ],
      examples: [
        'siyuan bi "新块内容" --parent-id <blockId>',
        'siyuan block-insert "新块内容" --previous-id <blockId>',
        'siyuan bi --data "新块内容" --next-id <blockId>'
      ]
    },
    'block-update': {
      aliases: ['bu'],
      description: '更新块内容',
      usage: 'siyuan block-update <blockId> <content> [--data-type <type>]',
      options: [
        { name: '<blockId>', description: '块ID（必需，位置参数）' },
        { name: '<content>', description: '新内容（必需，位置参数）' },
        { name: '--id', description: '块ID（可选，等同于位置参数）' },
        { name: '--data', description: '新内容（可选，等同于位置参数）' },
        { name: '--data-type', description: '数据类型：markdown/dom（默认：markdown）' }
      ],
      examples: [
        'siyuan bu <blockId> "更新后的内容"',
        'siyuan block-update <blockId> "更新后的内容"',
        'siyuan bu --id <blockId> --data "更新后的内容"'
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
    'block-attrs': {
      aliases: ['ba'],
      description: '管理块属性',
      usage: 'siyuan block-attrs <blockId> [--set <attrs>] [--get <key>]',
      options: [
        { name: '<blockId>', description: '块ID（必需，位置参数）' },
        { name: '--id', description: '块ID（可选，等同于位置参数）' },
        { name: '--set', description: '设置属性（key=value格式，多个用逗号分隔）' },
        { name: '--get', description: '获取指定属性键' }
      ],
      examples: [
        'siyuan ba <blockId> --set "key1=value1,key2=value2"',
        'siyuan block-attrs <blockId> --get "custom-attr"',
        'siyuan ba --id <blockId>'
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
    
    switch (command) {
      case 'get-notebooks':
      case 'notebooks':
      case 'nb':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('notebooks');
          process.exit(0);
        }
        console.log('获取笔记本列表...');
        const notebookArgs = {};
        if (args.includes('--force-refresh')) {
          notebookArgs.forceRefresh = true;
        }
        const notebooks = await skill.executeCommand('get-notebooks', notebookArgs);
        console.log(JSON.stringify(notebooks, null, 2));
        break;
        
      case 'get-doc-structure':
      case 'structure':
      case 'ls':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('structure');
          process.exit(0);
        }
        if (args.length < 2) {
          console.error('错误: 请提供笔记本ID');
          console.log('用法: siyuan structure <notebookId> [--force-refresh]');
          process.exit(1);
        }
        console.log('获取文档结构...');
        const structureArgs = { notebookId: args[1] };
        if (args.includes('--force-refresh')) {
          structureArgs.forceRefresh = true;
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
        if (args.length < 2) {
          console.error('错误: 请提供文档ID');
          console.log('用法: siyuan content <docId> [--format <format>] [--raw]');
          process.exit(1);
        }
        console.log('获取文档内容...');
        const contentArgs = { docId: args[1] };
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--format' && i + 1 < args.length) {
            contentArgs.format = args[++i];
          } else if (args[i] === '--raw') {
            contentArgs.raw = true;
          }
        }
        const content = await skill.executeCommand('get-doc-content', contentArgs);
        // 如果返回的是字符串（raw模式），直接输出，否则输出JSON
        if (typeof content === 'string') {
          console.log(content);
        } else {
          console.log(JSON.stringify(content, null, 2));
        }
        break;
        
      case 'search-content':
      case 'search':
      case 'find':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('search');
          process.exit(0);
        }
        if (args.length < 2) {
          console.error('错误: 请提供搜索关键词');
          console.log('用法: siyuan search <query> [--type <type>] [--types <types>] [--sort-by <sortBy>] [--limit <limit>] [--mode hybrid|semantic|keyword|legacy] [--sql-weight <weight>] [--dense-weight <weight>] [--sparse-weight <weight>] [--threshold <score>]');
          process.exit(1);
        }
        
        console.log('搜索内容...');
        
        // 解析额外参数
        const searchArgs = { query: args[1] };
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--type' && i + 1 < args.length) {
            searchArgs.type = args[++i];
          } else if (args[i] === '--types' && i + 1 < args.length) {
            searchArgs.types = args[++i];
          } else if (args[i] === '--sort-by' && i + 1 < args.length) {
            searchArgs.sortBy = args[++i];
          } else if (args[i] === '--limit' && i + 1 < args.length) {
            searchArgs.limit = parseInt(args[++i], 10);
          } else if (args[i] === '--path' && i + 1 < args.length) {
            searchArgs.path = args[++i];
          } else if (args[i] === '--sql' && i + 1 < args.length) {
            searchArgs.sql = args[++i];
          } else if (args[i] === '--mode' && i + 1 < args.length) {
            searchArgs.mode = args[++i];
          } else if (args[i] === '--notebook' && i + 1 < args.length) {
            searchArgs.notebookId = args[++i];
          } else if (args[i] === '--sql-weight' && i + 1 < args.length) {
            searchArgs.sqlWeight = parseFloat(args[++i]);
          } else if (args[i] === '--dense-weight' && i + 1 < args.length) {
            searchArgs.denseWeight = parseFloat(args[++i]);
          } else if (args[i] === '--sparse-weight' && i + 1 < args.length) {
            searchArgs.sparseWeight = parseFloat(args[++i]);
          } else if (args[i] === '--threshold' && i + 1 < args.length) {
            searchArgs.threshold = parseFloat(args[++i]);
          }
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
        if (args.length < 2) {
          console.error('错误: 请提供文档标题');
          console.log('用法: siyuan create <title> [content] [--parent-id <parentId>] [--path <path>] [--force]');
          process.exit(1);
        }
        let title = args[1];
        let docContent = '';
        let parentId = process.env.SIYUAN_DEFAULT_NOTEBOOK;
        let path = '';
        let force = false;
        
        // 解析参数 - 收集所有非 -- 参数作为内容
        let contentParts = [];
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--parent-id' && i + 1 < args.length) {
            parentId = args[++i];
          } else if (args[i] === '--path' && i + 1 < args.length) {
            path = args[++i];
          } else if (args[i] === '--force') {
            force = true;
          } else if (args[i] !== '--parent-id' && args[i] !== '--path' && args[i] !== '--force') {
            // 只排除已知的参数选项，其他都作为内容
            contentParts.push(args[i]);
          }
        }
        docContent = contentParts.join(' ');
        
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
        if (path) {
          console.log('路径:', path);
        }
        console.log('强制创建:', force);
        
        const createResult = await skill.executeCommand('create-document', { 
          parentId: parentId,
          title: title,
          content: docContent,
          force: force,
          path: path
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
        if (args.length < 3) {
          console.error('错误: 请提供文档ID和内容');
          console.log('用法: siyuan update <docId> <content>');
          process.exit(1);
        }
        console.log('更新文档...');
        const updateResult = await skill.executeCommand('update-document', { 
          docId: args[1],
          content: args[2]
        });
        console.log(JSON.stringify(updateResult, null, 2));
        break;
        
      case 'delete-document':
      case 'delete':
      case 'rm':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('delete');
          process.exit(0);
        }
        if (args.length < 2) {
          console.error('错误: 请提供文档ID');
          console.log('用法: siyuan delete <docId> [--confirm-title <title>]');
          process.exit(1);
        }
        
        const deleteArgs = {
          docId: args[1]
        };
        
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--confirm-title' && i + 1 < args.length) {
            deleteArgs.confirmTitle = args[++i];
          }
        }
        
        console.log('删除文档...');
        const deleteResult = await skill.executeCommand('delete-document', deleteArgs);
        console.log(JSON.stringify(deleteResult, null, 2));
        break;
        
      case 'protect-document':
      case 'protect':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('protect');
          process.exit(0);
        }
        if (args.length < 2) {
          console.error('错误: 请提供文档ID');
          console.log('用法: siyuan protect <docId> [--remove] [--permanent]');
          process.exit(1);
        }
        
        const protectArgs = {
          docId: args[1],
          remove: args.includes('--remove'),
          permanent: args.includes('--permanent')
        };
        
        console.log('设置文档保护...');
        const protectResult = await skill.executeCommand('protect-document', protectArgs);
        console.log(JSON.stringify(protectResult, null, 2));
        break;
        
      case 'move-document':
      case 'move':
      case 'mv':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('move');
          process.exit(0);
        }
        if (args.length < 3) {
          console.error('错误：请提供文档 ID/路径和目标位置');
          console.log('用法：siyuan move <docId|path> <targetParentId|path> [--new-title <title>]');
          process.exit(1);
        }
        console.log('移动文档...');
        
        // 解析额外参数
        const moveArgs = {
          docId: args[1],
          targetParentId: args[2]
        };
        for (let i = 3; i < args.length; i++) {
          if (args[i] === '--new-title' && i + 1 < args.length) {
            moveArgs.newTitle = args[++i];
          }
        }
        
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
          } else if (args[i] === '--no-incremental') {
            indexArgs.incremental = false;
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
        
      case 'insert-block':
      case 'bi':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-insert');
          process.exit(0);
        }
        console.log('插入块...');
        const insertBlockArgs = {};
        if (args.length >= 2 && !args[1].startsWith('--')) {
          insertBlockArgs.data = args[1];
        }
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--data' && i + 1 < args.length) {
            insertBlockArgs.data = args[++i];
          } else if (args[i] === '--data-type' && i + 1 < args.length) {
            insertBlockArgs.dataType = args[++i];
          } else if (args[i] === '--parent-id' && i + 1 < args.length) {
            insertBlockArgs.parentId = args[++i];
          } else if (args[i] === '--previous-id' && i + 1 < args.length) {
            insertBlockArgs.previousId = args[++i];
          } else if (args[i] === '--next-id' && i + 1 < args.length) {
            insertBlockArgs.nextId = args[++i];
          }
        }
        const insertBlockResult = await skill.executeCommand('insert-block', insertBlockArgs);
        console.log(JSON.stringify(insertBlockResult, null, 2));
        break;
        
      case 'update-block':
      case 'bu':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-update');
          process.exit(0);
        }
        console.log('更新块...');
        const updateBlockArgs = {};
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--id' && i + 1 < args.length) {
            updateBlockArgs.id = args[++i];
          } else if (args[i] === '--data' && i + 1 < args.length) {
            updateBlockArgs.data = args[++i];
          } else if (args[i] === '--data-type' && i + 1 < args.length) {
            updateBlockArgs.dataType = args[++i];
          } else if (i === 1 && !args[i].startsWith('--')) {
            updateBlockArgs.id = args[i];
          } else if (i === 2 && !args[i].startsWith('--')) {
            updateBlockArgs.data = args[i];
          }
        }
        const updateBlockResult = await skill.executeCommand('update-block', updateBlockArgs);
        console.log(JSON.stringify(updateBlockResult, null, 2));
        break;
        
      case 'delete-block':
      case 'bd':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-delete');
          process.exit(0);
        }
        console.log('删除块...');
        const deleteBlockArgs = {};
        if (args.length >= 2 && !args[1].startsWith('--')) {
          deleteBlockArgs.id = args[1];
        } else {
          for (let i = 1; i < args.length; i++) {
            if (args[i] === '--id' && i + 1 < args.length) {
              deleteBlockArgs.id = args[++i];
            }
          }
        }
        const deleteBlockResult = await skill.executeCommand('delete-block', deleteBlockArgs);
        console.log(JSON.stringify(deleteBlockResult, null, 2));
        break;
        
      case 'move-block':
      case 'bm':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-move');
          process.exit(0);
        }
        console.log('移动块...');
        const moveBlockArgs = {};
        if (args.length >= 2 && !args[1].startsWith('--')) {
          moveBlockArgs.id = args[1];
        }
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--id' && i + 1 < args.length) {
            moveBlockArgs.id = args[++i];
          } else if (args[i] === '--parent-id' && i + 1 < args.length) {
            moveBlockArgs.parentId = args[++i];
          } else if (args[i] === '--previous-id' && i + 1 < args.length) {
            moveBlockArgs.previousId = args[++i];
          }
        }
        const moveBlockResult = await skill.executeCommand('move-block', moveBlockArgs);
        console.log(JSON.stringify(moveBlockResult, null, 2));
        break;
        
      case 'get-block':
      case 'bg':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-get');
          process.exit(0);
        }
        console.log('获取块信息...');
        const getBlockArgs = {};
        if (args.length >= 2 && !args[1].startsWith('--')) {
          getBlockArgs.id = args[1];
        }
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--id' && i + 1 < args.length) {
            getBlockArgs.id = args[++i];
          } else if (args[i] === '--mode' && i + 1 < args.length) {
            getBlockArgs.mode = args[++i];
          }
        }
        const getBlockResult = await skill.executeCommand('get-block', getBlockArgs);
        console.log(JSON.stringify(getBlockResult, null, 2));
        break;
        
      case 'block-attributes':
      case 'ba':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-attrs');
          process.exit(0);
        }
        console.log('管理块属性...');
        const blockAttrsArgs = {};
        if (args.length >= 2 && !args[1].startsWith('--')) {
          blockAttrsArgs.id = args[1];
        }
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--id' && i + 1 < args.length) {
            blockAttrsArgs.id = args[++i];
          } else if (args[i] === '--set' && i + 1 < args.length) {
            blockAttrsArgs.set = args[++i];
          } else if (args[i] === '--get') {
            if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
              blockAttrsArgs.get = args[++i];
            } else {
              blockAttrsArgs.get = 'all';
            }
          }
        }
        const blockAttrsResult = await skill.executeCommand('block-attributes', blockAttrsArgs);
        console.log(JSON.stringify(blockAttrsResult, null, 2));
        break;
        
      case 'block-fold':
      case 'bf':
      case 'block-unfold':
      case 'buu':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-fold');
          process.exit(0);
        }
        const defaultFoldAction = (command === 'block-unfold' || command === 'buu') ? 'unfold' : 'fold';
        const foldBlockArgs = { action: defaultFoldAction };
        if (args.length >= 2 && !args[1].startsWith('--')) {
          foldBlockArgs.id = args[1];
        }
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--id' && i + 1 < args.length) {
            foldBlockArgs.id = args[++i];
          } else if (args[i] === '--action' && i + 1 < args.length) {
            foldBlockArgs.action = args[++i];
          }
        }
        console.log(`${foldBlockArgs.action === 'fold' ? '折叠' : '展开'}块...`);
        const foldBlockResult = await skill.executeCommand('block-fold', foldBlockArgs);
        console.log(JSON.stringify(foldBlockResult, null, 2));
        break;
        
      case 'block-transfer-ref':
      case 'btr':
        if (args.includes('--help') || args.includes('-h')) {
          showHelp('block-transfer-ref');
          process.exit(0);
        }
        console.log('转移块引用...');
        const transferBlockRefArgs = {};
        for (let i = 1; i < args.length; i++) {
          if (args[i] === '--from-id' && i + 1 < args.length) {
            transferBlockRefArgs.fromId = args[++i];
          } else if (args[i] === '--to-id' && i + 1 < args.length) {
            transferBlockRefArgs.toId = args[++i];
          } else if (args[i] === '--ref-ids' && i + 1 < args.length) {
            transferBlockRefArgs.refIds = args[++i];
          }
        }
        const transferBlockRefResult = await skill.executeCommand('transfer-block-ref', transferBlockRefArgs);
        console.log(JSON.stringify(transferBlockRefResult, null, 2));
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