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
 * @param {Object} config.multiValueOpts - 支持多值的选项集合（Set 或 数组）
 * @param {Object} config.defaults - 默认值
 * @returns {Object} { options: Object, positionalArgs: string[] }
 */
function parseArgs(args, config = {}) {
  const positionalArgs = [];
  const options = { ...config.defaults };
  const hasValueOpts = new Set(config.hasValueOpts || []);
  const multiValueOpts = new Set(config.multiValueOpts || []);
  const shortOpts = config.shortOpts || {};
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--')) {
      const eqIndex = arg.indexOf('=');
      if (eqIndex > -1) {
        const key = arg.slice(2, eqIndex);
        const value = arg.slice(eqIndex + 1);
        if (multiValueOpts.has(key)) {
          if (!Array.isArray(options[key])) {
            options[key] = [];
          }
          options[key].push(value);
        } else {
          options[key] = value;
        }
      } else {
        const key = arg.slice(2);
        if (hasValueOpts.has(key) && i + 1 < args.length && !args[i + 1].startsWith('-')) {
          const value = args[++i];
          if (multiValueOpts.has(key)) {
            if (!Array.isArray(options[key])) {
              options[key] = [];
            }
            options[key].push(value);
          } else {
            options[key] = value;
          }
        } else if (hasValueOpts.has(key) && i + 1 < args.length && args[i + 1].startsWith('-') && /^-?\d+$/.test(args[i + 1])) {
          const value = args[++i];
          if (multiValueOpts.has(key)) {
            if (!Array.isArray(options[key])) {
              options[key] = [];
            }
            options[key].push(value);
          } else {
            options[key] = value;
          }
        } else {
          options[key] = true;
        }
      }
    } else if (arg.startsWith('-') && arg.length === 2 && arg !== '-') {
      const shortKey = arg[1];
      const longKey = shortOpts[shortKey] || shortKey;
      if (hasValueOpts.has(longKey) && i + 1 < args.length && !args[i + 1].startsWith('-')) {
        const value = args[++i];
        if (multiValueOpts.has(longKey)) {
          if (!Array.isArray(options[longKey])) {
            options[longKey] = [];
          }
          options[longKey].push(value);
        } else {
          options[longKey] = value;
        }
      } else if (hasValueOpts.has(longKey) && i + 1 < args.length && args[i + 1].startsWith('-') && /^-?\d+$/.test(args[i + 1])) {
        const value = args[++i];
        if (multiValueOpts.has(longKey)) {
          if (!Array.isArray(options[longKey])) {
            options[longKey] = [];
          }
          options[longKey].push(value);
        } else {
          options[longKey] = value;
        }
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
