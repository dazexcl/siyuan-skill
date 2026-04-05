/**
 * TG-24 文档信息测试
 * 测试 info 命令的核心功能
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-24 文档信息测试');

function parseJSON(output) {
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
        const parsed = JSON.parse(jsonStr);
        return parsed.data || parsed;
    } catch (e) {
        return null;
    }
}

console.log('\n========================================');
console.log('TG-24 文档信息测试');
console.log('========================================\n');

console.log('创建测试文档...');

const ts = Date.now();
const docTitle = `TG-24 文档信息测试`;
const createResult = ctx.runCmd(`create "${docTitle}" "测试文档内容" --parent-id ${ctx.PARENT_ID}`);
const docId = ctx.extractDocId(createResult.output);

if (docId) {
    ctx.createdDocs.push({ id: docId, title: docTitle });
}
console.log(`创建的文档: ${docId}`);

console.log('\n测试用例:');

// 执行一次 info 命令，多个验证点
const cmd = `info ${docId} --format json`;
const result = ctx.runCmd(cmd);

if (!result.success) {
    ctx.addResult('TG-24-001', '获取文档信息', cmd, '返回文档基本信息',
        '命令执行失败', false, result.error);
    ctx.addResult('TG-24-002', 'JSON格式输出', cmd, '返回JSON格式',
        '命令执行失败', false, result.error);
    ctx.addResult('TG-24-003', '验证ID和标题', cmd, 'ID和标题正确',
        '命令执行失败', false, result.error);
    ctx.addResult('TG-24-004', '验证路径信息', cmd, '返回正确路径',
        '命令执行失败', false, result.error);
    ctx.addResult('TG-24-005', '验证笔记本信息', cmd, '返回笔记本信息',
        '命令执行失败', false, result.error);
    ctx.addResult('TG-24-006', '验证属性字段', cmd, '返回属性字段',
        '命令执行失败', false, result.error);
} else {
    const data = parseJSON(result.output);
    
    // TG-24-001: 验证基本信息存在
    {
        const hasBasicInfo = data && data.id && data.title && data.type;
        ctx.addResult('TG-24-001', '获取文档信息', cmd, '返回文档基本信息',
            hasBasicInfo ? '成功' : '信息不完整', hasBasicInfo,
            hasBasicInfo ? `ID: ${data.id}, 标题: ${data.title}` : '基本信息缺失');
    }

    // TG-24-002: 验证JSON格式
    {
        const isValidJSON = data !== null && typeof data === 'object';
        const hasData = data && data.id && data.notebook && data.path;
        ctx.addResult('TG-24-002', 'JSON格式输出', cmd, '返回JSON格式',
            isValidJSON && hasData ? '成功' : '格式不正确', isValidJSON && hasData,
            isValidJSON && hasData ? 'JSON格式正确，数据完整' : 'JSON格式或数据异常');
    }

    // TG-24-003: 验证ID和标题
    {
        const idMatch = data && data.id === docId;
        const titleMatch = data && data.title === docTitle;
        const bothMatch = idMatch && titleMatch;
        ctx.addResult('TG-24-003', '验证ID和标题', cmd, 'ID和标题正确',
            bothMatch ? '成功' : '不匹配', bothMatch,
            bothMatch ? `ID: ${data.id}, 标题: ${data.title}` : 
            idMatch ? 'ID正确但标题错误' : titleMatch ? '标题正确但ID错误' : 'ID和标题都不匹配');
    }

    // TG-24-004: 验证路径信息
    {
        const hasPath = data && data.path && data.path.humanReadable;
        const pathContainsTitle = hasPath && data.path.humanReadable.includes(docTitle);
        const pathContainsNotebook = hasPath && data.notebook && data.path.humanReadable.includes(data.notebook.name);
        
        if (hasPath && pathContainsTitle && pathContainsNotebook) {
            ctx.addResult('TG-24-004', '验证路径信息', cmd, '返回正确路径',
                '成功', true, `路径: ${data.path.humanReadable}`);
        } else {
            const issues = [];
            if (!hasPath) issues.push('路径缺失');
            if (!pathContainsTitle) issues.push('路径不包含标题');
            if (!pathContainsNotebook) issues.push('路径不包含笔记本名称');
            ctx.addResult('TG-24-004', '验证路径信息', cmd, '返回正确路径',
                '路径不完整', false, issues.join('; '));
        }
    }

    // TG-24-005: 验证笔记本信息
    {
        const hasNotebook = data && data.notebook && data.notebook.id && data.notebook.name;
        const notebookIdMatch = hasNotebook && data.notebook.id === ctx.NOTEBOOK_ID;
        
        if (hasNotebook && notebookIdMatch) {
            ctx.addResult('TG-24-005', '验证笔记本信息', cmd, '返回笔记本信息',
                '成功', true, `笔记本: ${data.notebook.name} (${data.notebook.id})`);
        } else {
            const issues = [];
            if (!hasNotebook) issues.push('笔记本信息缺失');
            if (!notebookIdMatch) issues.push('笔记本ID不匹配');
            ctx.addResult('TG-24-005', '验证笔记本信息', cmd, '返回笔记本信息',
                '笔记本信息错误', false, issues.join('; '));
        }
    }

    // TG-24-006: 验证属性字段
    {
        const hasAttributes = data && 'attributes' in data;
        const hasTags = data && 'tags' in data;
        const hasIcon = data && 'icon' in data;
        const hasRawAttrs = data && 'rawAttributes' in data;
        
        if (hasAttributes && hasTags && hasIcon && hasRawAttrs) {
            ctx.addResult('TG-24-006', '验证属性字段', cmd, '返回属性字段',
                '成功', true, `标签数: ${(data.tags || []).length}`);
        } else {
            const missing = [];
            if (!hasAttributes) missing.push('attributes');
            if (!hasTags) missing.push('tags');
            if (!hasIcon) missing.push('icon');
            if (!hasRawAttrs) missing.push('rawAttributes');
            ctx.addResult('TG-24-006', '验证属性字段', cmd, '返回属性字段',
                '字段缺失', false, `缺少: ${missing.join(', ')}`);
        }
    }
}

// TG-24-007: 无效文档ID处理
{
    const cmd2 = 'info invalid_doc_id_12345';
    const result2 = ctx.runCmd(cmd2);
    
    const handledError = !result2.success || 
                        result2.output.includes('不存在') || 
                        result2.output.includes('未找到') ||
                        result2.output.includes('error');
    
    ctx.addResult('TG-24-007', '无效文档ID', cmd2, '正确处理无效ID',
        handledError ? '成功' : '未正确处理', handledError,
        handledError ? '正确返回错误信息' : '应该返回错误');
}

// TG-24-008: 笔记本ID输入（应返回错误）
{
    const cmd3 = `info ${ctx.NOTEBOOK_ID}`;
    const result3 = ctx.runCmd(cmd3);
    
    const rejectedNotebook = !result3.success || 
                            result3.output.includes('笔记本') || 
                            result3.output.includes('不是文档');
    
    ctx.addResult('TG-24-008', '笔记本ID输入', cmd3, '拒绝笔记本ID',
        rejectedNotebook ? '成功' : '未正确处理', rejectedNotebook,
        rejectedNotebook ? '正确识别并拒绝笔记本ID' : '应该拒绝笔记本ID');
}

// TG-24-009: 缺少参数处理
{
    const cmd4 = 'info';
    const result4 = ctx.runCmd(cmd4);
    
    const requiresParam = !result4.success || 
                         result4.output.includes('错误') || 
                         result4.output.includes('缺少');
    
    ctx.addResult('TG-24-009', '缺少参数', cmd4, '要求提供文档ID',
        requiresParam ? '成功' : '未正确处理', requiresParam,
        requiresParam ? '正确提示缺少参数' : '应该要求提供文档ID');
}

// TG-24-010: 短选项支持
{
    const cmd5 = `info ${docId} -f json`;
    const result5 = ctx.runCmd(cmd5);
    const data5 = parseJSON(result5.output);
    
    const hasId = data5 && data5.id === docId;
    const hasTitle = data5 && data5.title === docTitle;
    
    ctx.addResult('TG-24-010', '短选项支持', cmd5, '短选项-f应等同于--format',
        hasId && hasTitle ? '成功' : '信息不匹配', hasId && hasTitle,
        hasId && hasTitle ? '短选项正常工作' : '短选项功能异常');
}

// TG-24-011: Summary格式输出
{
    const cmd6 = `info ${docId}`;
    const result6 = ctx.runCmd(cmd6);
    const data6 = parseJSON(result6.output);
    
    const hasId = data6 && data6.id === docId;
    const hasTitle = data6 && data6.title === docTitle;
    const hasPath = data6 && data6.path && typeof data6.path === 'string';
    
    ctx.addResult('TG-24-011', 'Summary格式输出', cmd6, '默认格式返回简化信息',
        hasId && hasTitle && hasPath ? '成功' : '格式不正确', hasId && hasTitle && hasPath,
        hasId && hasTitle && hasPath ? `路径: ${data6.path}` : 'Summary格式异常');
}

ctx.saveReports('TG-24-info', 'TG-24 文档信息测试报告');

ctx.cleanup();
