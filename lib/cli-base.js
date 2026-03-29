/**
 * CLI 基础设施模块
 * 提供命令行参数解析、帮助显示、命令注册等功能
 */

/**
 * 通用命令行参数解析器
 * 支持任意参数顺序，自动识别选项参数和位置参数
 * @param {Array} args - 命令行参数数组
 * @param {Object} config - 解析配置
 * @param {Object} config.options - 选项定义 { optionName: { hasValue: true/false, aliases: [] } }
 * @param {number} config.positionalCount - 位置参数数量
 * @param {Array} config.commonMistakes - 常见错误参数映射 { wrong: correct }
 * @returns {Object} 解析结果 { positional: [...], options: {...} }
 */
function parseCommandArgs(args, config) {
  const { options = {}, positionalCount = 0, commonMistakes = {} } = config;
  
  const result = {
    positional: [],
    options: {}
  };
  
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
      if (commonMistakes[arg]) {
        console.error(`\n❌ 未知参数: ${arg}`);
        console.error(`您可能想使用: ${commonMistakes[arg]}`);
        process.exit(1);
      }
      
      const optConfig = optionMap[arg];
      if (optConfig) {
        const targetName = optConfig.targetName || arg.replace(/^-+/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        
        if (optConfig.hasValue) {
          if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
            result.options[targetName] = args[++i];
          } else {
            result.options[targetName] = true;
          }
        } else if (optConfig.isFlag) {
          result.options[targetName] = true;
        }
      } else {
        if (!knownOptions.includes(arg)) {
          console.warn(`⚠️ 警告: 未知参数 "${arg}" 将被忽略`);
        }
      }
    } else {
      result.positional.push(arg);
    }
  }
  
  if (positionalCount > 0 && result.positional.length > positionalCount) {
    const extra = result.positional.splice(positionalCount - 1);
    result.positional[positionalCount - 1] = extra.join(' ');
  }
  
  return result;
}

/**
 * 从文件读取内容
 * @param {string} filePath - 文件路径（绝对路径或相对路径）
 * @returns {string} 文件内容
 */
function readFileContent(filePath) {
  const fs = require('fs');
  const path = require('path');
  
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
 * 显示命令列表
 * @param {Object} commands - 命令映射对象
 */
function showCommandList(commands) {
  console.log(`
Siyuan Skill CLI - 思源笔记命令行工具

用法:
  siyuan <command> [options]
  siyuan help <command>    # 查看特定命令的详细帮助
  siyuan --version         # 显示版本信息

命令:`);

  const sortedCommands = Object.entries(commands)
    .filter(([key, cmd]) => cmd && typeof cmd === 'object' && cmd.name && key === cmd.name && (cmd.description || cmd.runCLI))
    .sort((a, b) => (a[1].sortOrder || 0) - (b[1].sortOrder || 0));

  for (const [key, cmd] of sortedCommands) {
    const aliases = cmd.aliases && cmd.aliases.length > 0 
      ? `, ${cmd.aliases.join(', ')}` 
      : '';
    const desc = cmd.description || cmd.usage || '';
    console.log(`  ${(key + aliases).padEnd(32)} ${desc.split('\n')[0]}`);
  }

  console.log(`
使用示例:
  siyuan help search              # 查看 search 命令的详细帮助
  siyuan help create              # 查看 create 命令的详细帮助

配置优先级：环境变量 > config.json > 默认配置
`);
}

/**
 * 显示单个命令的帮助信息
 * @param {Object} cmd - 命令对象
 * @param {string} commandName - 命令名称（可能是别名）
 */
function showCommandHelp(cmd, commandName) {
  if (!cmd || !cmd.name) {
    console.log(`\n❌ 未知命令: ${commandName}`);
    console.log('使用 "siyuan help" 查看所有可用命令\n');
    return;
  }

  const mainName = cmd.name;
  const aliases = cmd.aliases && cmd.aliases.length > 0 
    ? ` (${cmd.aliases.join(', ')})` 
    : '';
  const displayName = commandName !== mainName ? `${commandName} (${mainName})` : mainName;

  let optionsText = '';
  if (cmd.options) {
    const optLines = [];
    for (const [optName, optConfig] of Object.entries(cmd.options)) {
      const aliases = optConfig.aliases && optConfig.aliases.length > 0 
        ? `, ${optConfig.aliases.join(', ')}` 
        : '';
      const desc = optConfig.description || '';
      optLines.push(`  ${(optName + aliases).padEnd(28)} ${desc}`);
    }
    if (optLines.length > 0) {
      optionsText = '\n选项:\n' + optLines.join('\n');
    }
  } else if (cmd.help?.options) {
    optionsText = '\n选项:\n' + cmd.help.options.map(opt => 
      `  ${opt.name.padEnd(28)} ${opt.description}`
    ).join('\n');
  }

  const notes = cmd.notes || cmd.help?.notes;
  const examples = cmd.examples || cmd.help?.examples || [mainName];
  const returns = cmd.returns || cmd.help?.returns;

  console.log(`
${'='.repeat(60)}
命令: ${displayName}${aliases}
${'='.repeat(60)}

${cmd.description || ''}

用法:
  ${cmd.usage || `siyuan ${mainName} [options]`}
${notes ? '\n注意事项:\n' + notes.map(note => 
    note === '' ? '' : `  ${note}`
  ).join('\n') : ''}
${optionsText}
${returns ? '\n返回字段:\n' + returns.map(ret => 
    `  ${ret}`
  ).join('\n') : ''}

示例:
${examples.map(ex => `  ${ex}`).join('\n')}
${'='.repeat(60)}

提示: 使用 "siyuan help" 查看所有可用命令
`);
}

/**
 * 根据命令名或别名查找命令
 * @param {string} name - 命令名或别名
 * @param {Object} commands - 命令映射对象
 * @returns {Object|null} 命令对象
 */
function findCommand(name, commands) {
  if (commands[name] && commands[name].name) {
    return commands[name];
  }
  
  for (const cmd of Object.values(commands)) {
    if (cmd.aliases && cmd.aliases.includes(name)) {
      return cmd;
    }
  }
  
  return null;
}

/**
 * 显示帮助信息（命令列表或特定命令帮助）
 * @param {string} [commandName] - 要显示帮助的命令（可选）
 * @param {Object} commands - 命令映射对象
 */
function showHelp(commandName, commands) {
  if (commandName) {
    const cmd = findCommand(commandName, commands);
    showCommandHelp(cmd, commandName);
  } else {
    showCommandList(commands);
  }
}

module.exports = {
  parseCommandArgs,
  readFileContent,
  resolveContent,
  showHelp,
  showCommandList,
  showCommandHelp,
  findCommand
};
