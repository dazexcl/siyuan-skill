#!/usr/bin/env node
/**
 * Siyuan Skill 命令行接口 (CLI)
 * 模块化版本 - 命令分发器
 */

if (process.platform === 'win32') {
  process.env.LANG = 'en_US.UTF-8';
  process.env.LC_ALL = 'en_US.UTF-8';
}

const { createSkill, VERSION } = require('./index');
const { showHelp, findCommand, parseCommandArgs, resolveContent } = require('./lib/cli-base');
const commands = require('./commands');

/**
 * 主函数
 */
async function main(customArgs = null) {
  const args = customArgs || process.argv.slice(2);

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
    showHelp(args[1], commands);
    process.exit(0);
  }

  if (args[0] === '--version' || args[0] === '-v') {
    console.log(`Siyuan Skill CLI v${VERSION}`);
    process.exit(0);
  }

  const commandName = args[0];
  const cmd = findCommand(commandName, commands);

  if (!cmd) {
    console.error(`错误: 未知命令 "${commandName}"`);
    showHelp(null, commands);
    process.exit(1);
  }

  if (args.includes('--help') || args.includes('-h')) {
    showHelp(cmd.name, commands);
    process.exit(0);
  }

  const skill = createSkill();

  try {
    let initOptions = cmd.initOptions || {};
    
    if (['search', 'find', 'search-content'].includes(commandName) || 
        (cmd.aliases && cmd.aliases.some(a => ['search', 'find'].includes(a)))) {
      const modeIndex = args.indexOf('--mode');
      const mode = modeIndex !== -1 && modeIndex + 1 < args.length ? args[modeIndex + 1] : 'legacy';
      const needsVectorSearch = ['semantic', 'hybrid'].includes(mode);
      initOptions = { ...initOptions, initVectorSearch: needsVectorSearch };
    }
    
    if (['nlp', 'nlp-analyze'].includes(commandName) ||
        (cmd.aliases && cmd.aliases.some(a => ['nlp', 'nlp-analyze'].includes(a)))) {
      initOptions = { ...initOptions, initNLP: true };
    }
    
    await skill.init(initOptions);
    
    const parsed = parseCommandArgs(args.slice(1), {
      options: cmd.options || {},
      positionalCount: cmd.positionalCount || 0
    });

    if (cmd.runCLI) {
      await cmd.runCLI(skill, parsed, args);
    } else if (cmd.execute) {
      const executeArgs = cmd.toExecuteArgs ? cmd.toExecuteArgs(parsed) : parsed;
      const result = await cmd.execute(skill, executeArgs);
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.error(`错误: 命令 "${cmd.name}" 没有实现 runCLI 或 execute 方法`);
      process.exit(1);
    }
  } catch (error) {
    console.error('执行失败:', error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

module.exports = { main };

if (require.main === module) {
  main();
}
