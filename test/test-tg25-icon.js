/**
 * TG-25 图标命令测试
 * 测试 icon 命令及其选项
 * 测试策略：先创建测试文档，再测试图标的设置、获取、移除
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-25 图标测试');

function parseIconResult(output) {
    try {
        const lastBrace = output.lastIndexOf('}');
        if (lastBrace === -1) return null;
        
        let depth = 0;
        let start = -1;
        for (let i = lastBrace; i >= 0; i--) {
            if (output[i] === '}') depth++;
            if (output[i] === '{') depth--;
            if (depth === 0) {
                start = i;
                break;
            }
        }
        
        if (start === -1) return null;
        
        const jsonStr = output.substring(start, lastBrace + 1);
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}

console.log('\n========================================');
console.log('TG-25 图标测试');
console.log('========================================\n');

console.log('创建测试文档...');

const ts = Date.now();
const docTitle = `TG-25-01-图标测试_${ts}`;
const createResult = ctx.runCmd(`create "${docTitle}" "图标测试内容" --parent-id ${ctx.PARENT_ID}`);
const docId = ctx.extractDocId(createResult.output);

if (docId) {
    ctx.createdDocs.push({ id: docId, title: docTitle });
}
console.log(`创建的文档: ${docId}`);

console.log('\n测试用例:');

// TG-25-01: 设置图标 - 使用位置参数（新语法）
{
    const emoji = '\u{1F4DD}';
    const cmd = `icon ${docId} "${emoji}"`;
    const result = ctx.runCmd(cmd);
    const iconResult = parseIconResult(result.output);
    
    if (!result.success) {
        ctx.addResult('TG-25-01', '设置图标(位置参数)', cmd, '图标设置成功', 
            '命令执行失败', false, result.error);
    } else if (!docId) {
        ctx.addResult('TG-25-01', '设置图标(位置参数)', cmd, '图标设置成功', 
            '测试文档创建失败', false);
    } else if (!iconResult) {
        ctx.addResult('TG-25-01', '设置图标(位置参数)', cmd, '图标设置成功', 
            '无法解析结果', false, result.output.substring(0, 200));
    } else {
        const isSuccess = iconResult.success === true;
        if (isSuccess) {
            ctx.addResult('TG-25-01', '设置图标(位置参数)', cmd, '图标设置成功', 
                '成功', true, `emoji: ${emoji}`);
        } else {
            ctx.addResult('TG-25-01', '设置图标(位置参数)', cmd, '图标设置成功', 
                '设置失败', false, iconResult.error || iconResult.message);
        }
    }
}

// TG-25-02: 获取图标 - 无位置参数即为获取
{
    const cmd = `icon ${docId}`;
    const result = ctx.runCmd(cmd);
    const iconResult = parseIconResult(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-25-02', '获取图标', cmd, '返回图标信息', 
            '前置条件不满足', false);
    } else if (!iconResult) {
        ctx.addResult('TG-25-02', '获取图标', cmd, '返回图标信息', 
            '无法解析结果', false);
    } else {
        const isSuccess = iconResult.success === true;
        const hasIcon = iconResult.data && iconResult.data.hasIcon === true;
        
        if (isSuccess && hasIcon) {
            const iconValue = iconResult.data.icon;
            ctx.addResult('TG-25-02', '获取图标', cmd, '返回图标信息', 
                '成功', true, `图标编码: ${iconValue}`);
        } else if (isSuccess) {
            ctx.addResult('TG-25-02', '获取图标', cmd, '返回图标信息', 
                '无图标', false, '文档未设置图标');
        } else {
            ctx.addResult('TG-25-02', '获取图标', cmd, '返回图标信息', 
                '获取失败', false, iconResult.error || iconResult.message);
        }
    }
}

// TG-25-03: 移除图标
{
    const cmd = `icon ${docId} --remove`;
    const result = ctx.runCmd(cmd);
    const iconResult = parseIconResult(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-25-03', '移除图标', cmd, '图标移除成功', 
            '前置条件不满足', false);
    } else if (!iconResult) {
        ctx.addResult('TG-25-03', '移除图标', cmd, '图标移除成功', 
            '无法解析结果', false);
    } else {
        const isSuccess = iconResult.success === true;
        if (isSuccess) {
            ctx.addResult('TG-25-03', '移除图标', cmd, '图标移除成功', 
                '成功', true, '图标已移除');
        } else {
            ctx.addResult('TG-25-03', '移除图标', cmd, '图标移除成功', 
                '移除失败', false, iconResult.error || iconResult.message);
        }
    }
}

// TG-25-04: 验证移除后获取图标为空
{
    const cmd = `icon ${docId}`;
    const result = ctx.runCmd(cmd);
    const iconResult = parseIconResult(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-25-04', '验证移除后无图标', cmd, '图标为空', 
            '前置条件不满足', false);
    } else if (!iconResult) {
        ctx.addResult('TG-25-04', '验证移除后无图标', cmd, '图标为空', 
            '无法解析结果', false);
    } else {
        const isSuccess = iconResult.success === true;
        const noIcon = iconResult.data && !iconResult.data.hasIcon;
        
        if (isSuccess && noIcon) {
            ctx.addResult('TG-25-04', '验证移除后无图标', cmd, '图标为空', 
                '成功', true, '移除后图标确实为空');
        } else if (isSuccess) {
            ctx.addResult('TG-25-04', '验证移除后无图标', cmd, '图标为空', 
                '图标仍存在', false, `图标值: ${iconResult.data?.icon}`);
        } else {
            ctx.addResult('TG-25-04', '验证移除后无图标', cmd, '图标为空', 
                '获取失败', false);
        }
    }
}

// TG-25-05: --remove 简写 -r
{
    const emoji = '\u{1F4C4}';
    const setCmd = `icon ${docId} "${emoji}"`;
    ctx.runCmd(setCmd);
    
    const cmd = `icon ${docId} -r`;
    const result = ctx.runCmd(cmd);
    const iconResult = parseIconResult(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-25-05', '简写 -r 移除图标', cmd, '图标移除成功', 
            '前置条件不满足', false);
    } else if (!iconResult) {
        ctx.addResult('TG-25-05', '简写 -r 移除图标', cmd, '图标移除成功', 
            '无法解析结果', false);
    } else {
        const isSuccess = iconResult.success === true;
        if (isSuccess) {
            ctx.addResult('TG-25-05', '简写 -r 移除图标', cmd, '图标移除成功', 
                '成功', true, '-r 别名工作正常');
        } else {
            ctx.addResult('TG-25-05', '简写 -r 移除图标', cmd, '图标移除成功', 
                '移除失败', false, iconResult.error || iconResult.message);
        }
    }
}

// TG-25-06: 无效文档ID处理
{
    const cmd = 'icon invalid_doc_id_12345';
    const result = ctx.runCmd(cmd);
    
    const handledError = !result.success || 
                        result.output.includes('错误') || 
                        result.output.includes('error') ||
                        result.output.includes('失败');
    
    if (handledError) {
        ctx.addResult('TG-25-06', '无效文档ID', cmd, '正确处理无效ID', 
            '成功', true, '正确返回错误信息');
    } else {
        ctx.addResult('TG-25-06', '无效文档ID', cmd, '正确处理无效ID', 
            '未正确处理', false, `输出: ${result.output.substring(0, 100)}`);
    }
}

// TG-25-07: 缺少操作参数时默认进入获取模式
{
    const cmd = `icon ${docId}`;
    const result = ctx.runCmd(cmd);
    const iconResult = parseIconResult(result.output);
    
    const defaultsToGet = result.success && iconResult && iconResult.success === true;
    
    if (defaultsToGet) {
        ctx.addResult('TG-25-07', '缺少操作参数', cmd, '默认获取图标', 
            '成功', true, '无操作参数时默认获取图标');
    } else {
        ctx.addResult('TG-25-07', '缺少操作参数', cmd, '默认获取图标', 
            '未正确处理', false, '应该默认获取图标');
    }
}

ctx.saveReports('TG-25-icon', 'TG-25 图标测试报告');

ctx.cleanup();
