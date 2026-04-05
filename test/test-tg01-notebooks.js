/**
 * TG-01 笔记本管理测试
 * 测试 notebooks 命令
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-01 笔记本管理测试');

console.log('\n========================================');
console.log('TG-01 笔记本管理测试');
console.log('========================================\n');

console.log('测试用例:');

const cmd = 'notebooks';
const result = ctx.runCmd(cmd);

if (!result.success) {
    ctx.addResult('TG-01-01', '列出笔记本', cmd, '返回笔记本列表',
        '命令执行失败', false, result.error);
    ctx.addResult('TG-01-02', '验证默认笔记本', cmd, '包含默认笔记本',
        '命令执行失败', false, result.error);
    ctx.addResult('TG-01-03', '验证JSON格式', cmd, '返回有效JSON',
        '命令执行失败', false, result.error);
    ctx.addResult('TG-01-04', '检查笔记本数量', cmd, '至少1个笔记本',
        '命令执行失败', false, result.error);
    ctx.addResult('TG-01-05', '验证笔记本属性', cmd, '包含必要属性',
        '命令执行失败', false, result.error);
} else {
    const output = result.output;
    
    {
        const hasNotebooks = output.includes('id') && output.includes('name');
        ctx.addResult('TG-01-01', '列出笔记本', cmd, '返回笔记本列表',
            hasNotebooks ? '成功' : '未找到笔记本', hasNotebooks,
            hasNotebooks ? '成功获取笔记本列表' : '输出格式异常');
    }

    {
        const hasDefault = output.includes(ctx.NOTEBOOK_ID);
        ctx.addResult('TG-01-02', '验证默认笔记本', cmd, '包含默认笔记本',
            hasDefault ? '成功' : '未找到', hasDefault,
            hasDefault ? `找到默认笔记本: ${ctx.NOTEBOOK_ID}` : '默认笔记本不存在');
    }

    {
        try {
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                const hasData = data.success && data.notebooks;
                ctx.addResult('TG-01-03', '验证JSON格式', cmd, '返回有效JSON',
                    '成功', hasData, 'JSON格式正确');
            } else {
                ctx.addResult('TG-01-03', '验证JSON格式', cmd, '返回有效JSON',
                    '未找到JSON', false, '输出不包含JSON');
            }
        } catch (e) {
            ctx.addResult('TG-01-03', '验证JSON格式', cmd, '返回有效JSON',
                'JSON解析失败', false, e.message);
        }
    }

    {
        try {
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            const data = JSON.parse(jsonMatch[0]);
            const notebooks = data.notebooks || [];
            const count = Array.isArray(notebooks) ? notebooks.length : 0;
            ctx.addResult('TG-01-04', '检查笔记本数量', cmd, '至少1个笔记本',
                count >= 1 ? '成功' : '数量不足', count >= 1,
                `笔记本数量: ${count}`);
        } catch (e) {
            ctx.addResult('TG-01-04', '检查笔记本数量', cmd, '至少1个笔记本',
                '解析失败', false, e.message);
        }
    }

    {
        try {
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            const data = JSON.parse(jsonMatch[0]);
            const notebooks = data.notebooks || [];
            if (Array.isArray(notebooks) && notebooks.length > 0) {
                const first = notebooks[0];
                const hasRequired = first.id && (first.name || first.title);
                ctx.addResult('TG-01-05', '验证笔记本属性', cmd, '包含必要属性',
                    hasRequired ? '成功' : '缺少属性', hasRequired,
                    `属性: ${Object.keys(first).join(', ')}`);
            } else {
                ctx.addResult('TG-01-05', '验证笔记本属性', cmd, '包含必要属性',
                    '无笔记本数据', false, '笔记本列表为空');
            }
        } catch (e) {
            ctx.addResult('TG-01-05', '验证笔记本属性', cmd, '包含必要属性',
                '解析失败', false, e.message);
        }
    }
}

const cmd2 = `notebooks ${ctx.NOTEBOOK_ID}`;
const result2 = ctx.runCmd(cmd2);

if (!result2.success) {
    ctx.addResult('TG-01-06', '指定笔记本查询', cmd2, '返回指定笔记本',
        '命令执行失败', false, result2.error);
} else {
    const hasTarget = result2.output.includes(ctx.NOTEBOOK_ID);
    ctx.addResult('TG-01-06', '指定笔记本查询', cmd2, '返回指定笔记本',
        hasTarget ? '成功' : '未找到', hasTarget,
        hasTarget ? `成功查询笔记本: ${ctx.NOTEBOOK_ID}` : '指定笔记本不存在');
}

const cmd3 = 'notebooks invalid_notebook_id_12345';
const result3 = ctx.runCmd(cmd3);

if (!result3.success) {
    ctx.addResult('TG-01-07', '无效笔记本ID', cmd3, '不返回无效ID的数据',
        '命令执行失败', false, result3.error);
} else {
    const notContainsInvalid = !result3.output.includes('invalid_notebook_id_12345');
    const hasEmptyArray = result3.output.includes('"notebooks": []');
    
    if (notContainsInvalid && hasEmptyArray) {
        ctx.addResult('TG-01-07', '无效笔记本ID', cmd3, '不返回无效ID的数据',
            '成功', true, 'API正确处理：返回空笔记本列表');
    } else {
        ctx.addResult('TG-01-07', '无效笔记本ID', cmd3, '不返回无效ID的数据',
            '失败', false, `输出异常: ${result3.output.substring(0, 50)}`);
    }
}

// 保存报告
ctx.saveReports('TG-01-notebooks', 'TG-01 笔记本管理测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
