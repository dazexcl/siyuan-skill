/**
 * 命令行参数解析器
 * 提供灵活的参数解析功能
 */

/**
 * 简单的参数解析器
 * 只处理 help 和位置参数
 * @param {string[]} args - 命令行参数数组
 * @returns {Object} { options: Object, positionalArgs: string[] }
 */
function parseSimpleArgs(args) {
  const options = {};
  const positionalArgs = [];
  
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }
  
  return { options, positionalArgs };
}

/**
 * 完整的参数解析器
 * 支持短选项、长选项、带值选项、位置参数
 * @param {string[]} args - 命令行参数数组
 * @param {Object} config - 配置选项
 * @param {Object} config.hasValueOpts - 需要值的选项集合（Set 或 数组）
 * @param {Object} config.shortOpts - 短选项映射 { 'h': 'help' }
 * @param {Object} config.defaults - 默认值
 * @returns {Object} { options: Object, positionalArgs: string[] }
 */
function parseArgs(args, config = {}) {
  const positionalArgs = [];
  const options = { ...config.defaults };
  const hasValueOpts = new Set(config.hasValueOpts || []);
  const shortOpts = config.shortOpts || {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > -1) {
        const key = arg.slice(2, eqIndex);
        options[key] = arg.slice(eqIndex + 1);
      } else {
        const key = arg.slice(2);
        if (hasValueOpts.has(key) && i + 1 < args.length && !args[i + 1].startsWith('-')) {
          options[key] = args[++i];
        } else if (hasValueOpts.has(key) && i + 1 < args.length && args[i + 1].startsWith('-') && /^-?\d+$/.test(args[i + 1])) {
          options[key] = args[++i];
        } else {
          options[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2 && arg !== '-') {
      const shortKey = arg[1];
      const longKey = shortOpts[shortKey] || shortKey;
      if (hasValueOpts.has(longKey) && i + 1 < args.length && !args[i + 1].startsWith('-')) {
        options[longKey] = args[++i];
      } else if (hasValueOpts.has(longKey) && i + 1 < args.length && args[i + 1].startsWith('-') && /^-?\d+$/.test(args[i + 1])) {
        options[longKey] = args[++i];
      } else {
        options[longKey] = true;
      }
    } else if (!arg.startsWith('-')) {
      positionalArgs.push(arg);
    }
  }
  
  return { options, positionalArgs };
}

module.exports = {
  parseSimpleArgs,
  parseArgs
};
