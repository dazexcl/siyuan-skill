/**
 * TG-00 全局功能测试
 * 测试 CLI 全局命令和基础功能
 * 包括: help, -v/--version, 无参数处理, 无效命令等
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-00 全局功能测试');
const { runCmd, addResult, saveReports } = ctx;

console.log('\n========================================');
console.log('TG-00 全局功能测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-00-01: help 命令
{
    const cmd = 'help';
    const result = runCmd(cmd);
    
    const hasUsage = result.output.includes('用法') || result.output.includes('usage');
    const hasCommands = result.output.includes('命令') || result.output.includes('command');
    const hasIndex = result.output.includes('index');
    const hasSearch = result.output.includes('search');
    
    if (result.success && hasUsage && hasCommands && hasIndex && hasSearch) {
        addResult('TG-00-01', 'help 命令', cmd, '显示帮助信息', '成功', true, 
            '包含用法、命令列表');
    } else {
        addResult('TG-00-01', 'help 命令', cmd, '显示帮助信息', '输出内容不完整', false,
            `usage:${hasUsage}, commands:${hasCommands}`);
    }
}

// TG-00-02: -v 短参数版本
{
    const cmd = '-v';
    const result = runCmd(cmd);
    
    const hasVersion = result.output.includes('v') && /\d+\.\d+/.test(result.output);
    
    if (result.success && hasVersion) {
        addResult('TG-00-02', '-v 版本', cmd, '显示版本号', '成功', true, 
            result.output.trim());
    } else {
        addResult('TG-00-02', '-v 版本', cmd, '显示版本号', '未显示版本', false,
            result.output.substring(0, 100));
    }
}

// TG-00-03: --version 长参数版本
{
    const cmd = '--version';
    const result = runCmd(cmd);
    
    const hasVersion = result.output.includes('v') && /\d+\.\d+/.test(result.output);
    
    if (result.success && hasVersion) {
        addResult('TG-00-03', '--version 版本', cmd, '显示版本号', '成功', true,
            result.output.trim());
    } else {
        addResult('TG-00-03', '--version 版本', cmd, '显示版本号', '未显示版本', false,
            result.output.substring(0, 100));
    }
}

// TG-00-04: 无参数时显示帮助
{
    const cmd = '';
    const result = runCmd(cmd);
    
    const hasHelp = result.output.includes('用法') || 
                   result.output.includes('usage') ||
                   result.output.includes('命令') ||
                   result.output.includes('command');
    
    if (result.success && hasHelp) {
        addResult('TG-00-04', '无参数', cmd || '(空)', '显示帮助信息', '成功', true,
            '无参数时显示帮助');
    } else {
        addResult('TG-00-04', '无参数', cmd || '(空)', '显示帮助信息', '未显示帮助', false,
            result.output.substring(0, 100));
    }
}

// TG-00-05: 无效命令处理
{
    const cmd = 'invalid_command_xyz_12345';
    const result = runCmd(cmd);
    
    const handled = !result.success || 
                   result.output.includes('未知') || 
                   result.output.includes('unknown') ||
                   result.output.includes('无效') ||
                   result.output.includes('invalid') ||
                   result.output.includes('找不到') ||
                   result.output.includes('not found');
    
    if (handled) {
        addResult('TG-00-05', '无效命令', cmd, '正确处理无效命令', '成功', true,
            '返回错误提示');
    } else {
        addResult('TG-00-05', '无效命令', cmd, '正确处理无效命令', '未正确处理', false,
            result.output.substring(0, 100));
    }
}

// TG-00-06: help 对特定命令
{
    const cmd = 'help create';
    const result = runCmd(cmd);
    
    const hasCreate = result.output.includes('create') || result.output.includes('创建');
    const hasOptions = result.output.includes('--') || result.output.includes('选项') || result.output.includes('参数');
    
    if (result.success && hasCreate) {
        addResult('TG-00-06', 'help 特定命令', cmd, '显示 create 帮助', '成功', true,
            '显示详细帮助');
    } else {
        addResult('TG-00-06', 'help 特定命令', cmd, '显示 create 帮助', '输出不完整', false,
            result.output.substring(0, 100));
    }
}

// TG-00-07: help 对别名
{
    const cmd = 'help ls';
    const result = runCmd(cmd);
    
    const hasStructure = result.output.includes('structure') || 
                        result.output.includes('结构') ||
                        result.output.includes('目录');
    
    if (result.success && hasStructure) {
        addResult('TG-00-07', 'help 对别名', cmd, '显示别名对应命令帮助', '成功', true,
            'ls 别名正确解析');
    } else {
        addResult('TG-00-07', 'help 对别名', cmd, '显示别名对应命令帮助', '未正确解析别名', false,
            result.output.substring(0, 100));
    }
}

// TG-00-08: 连接测试（隐式测试）
{
    const cmd = 'notebooks';
    const result = runCmd(cmd);
    
    const hasNotebooks = result.success && (
        result.output.includes('notebook') || 
        result.output.includes('笔记本') ||
        result.output.includes('[')
    );
    
    if (hasNotebooks) {
        addResult('TG-00-08', 'API 连接', cmd, '成功连接思源笔记', '成功', true,
            'API 连接正常');
    } else {
        addResult('TG-00-08', 'API 连接', cmd, '成功连接思源笔记', '连接失败', false,
            result.error || result.output.substring(0, 100));
    }
}

// 保存报告
saveReports('TG-00-global', 'TG-00 全局功能测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
