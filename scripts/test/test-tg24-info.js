/**
 * TG-24 文档信息测试
 * 测试 info 命令及其别名
 * 测试策略：先创建测试文档，再验证返回信息与创建内容一致
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-24 文档信息测试');

function parseInfoResult(output) {
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
        const data = JSON.parse(jsonStr);
        return data.data || data;
    } catch (e) {
        return null;
    }
}

console.log('\n========================================');
console.log('TG-24 文档信息测试');
console.log('========================================\n');

console.log('创建测试文档...');

const ts = Date.now();
const docTitle = `info_test_${ts}`;
const createResult = ctx.runCmd(`create "${docTitle}" "测试文档内容" --parent-id ${ctx.PARENT_ID}`);
const docId = ctx.extractDocId(createResult.output);

if (docId) {
    ctx.createdDocs.push({ id: docId, title: docTitle });
}
console.log(`创建的文档: ${docId}`);

console.log('\n测试用例:');

// TG-24-01: 获取文档信息 - 验证返回基本信息
{
    const cmd = `info ${docId}`;
    const result = ctx.runCmd(cmd);
    const info = parseInfoResult(result.output);
    
    if (!result.success) {
        ctx.addResult('TG-24-01', '获取文档信息', cmd, '返回文档基本信息', 
            '命令执行失败', false, result.error);
    } else if (!info) {
        ctx.addResult('TG-24-01', '获取文档信息', cmd, '返回文档基本信息', 
            '无法解析结果', false, result.output.substring(0, 200));
    } else if (!docId) {
        ctx.addResult('TG-24-01', '获取文档信息', cmd, '返回文档基本信息', 
            '测试文档创建失败', false);
    } else {
        const hasId = info.id === docId;
        const hasTitle = info.title === docTitle;
        const hasNotebook = info.notebook && info.notebook.id === ctx.NOTEBOOK_ID;
        
        if (hasId && hasTitle && hasNotebook) {
            ctx.addResult('TG-24-01', '获取文档信息', cmd, '返回文档基本信息', 
                '成功', true, `标题: ${info.title}, 笔记本: ${info.notebook?.name || ctx.NOTEBOOK_ID}`);
        } else {
            const issues = [];
            if (!hasId) issues.push(`ID不匹配: 期望 ${docId}, 实际 ${info.id}`);
            if (!hasTitle) issues.push(`标题不匹配: 期望 ${docTitle}, 实际 ${info.title}`);
            if (!hasNotebook) issues.push(`笔记本不匹配`);
            ctx.addResult('TG-24-01', '获取文档信息', cmd, '返回文档基本信息', 
                '信息不匹配', false, issues.join('; '));
        }
    }
}

// TG-24-02: 验证路径信息
{
    const cmd = `info ${docId}`;
    const result = ctx.runCmd(cmd);
    const info = parseInfoResult(result.output);
    
    if (!result.success || !info || !docId) {
        ctx.addResult('TG-24-02', '验证路径信息', cmd, '返回正确的路径', 
            '前置条件不满足', false);
    } else {
        const hasPath = info.path && typeof info.path === 'string' && info.path.length > 0;
        const pathContainsTitle = hasPath && info.path.includes(docTitle);
        
        if (hasPath && pathContainsTitle) {
            ctx.addResult('TG-24-02', '验证路径信息', cmd, '返回正确的路径', 
                '成功', true, `路径: ${info.path}`);
        } else if (hasPath) {
            ctx.addResult('TG-24-02', '验证路径信息', cmd, '返回正确的路径', 
                '路径不含标题', false, `路径: ${info.path}`);
        } else {
            ctx.addResult('TG-24-02', '验证路径信息', cmd, '返回正确的路径', 
                '无路径信息', false);
        }
    }
}

// TG-24-03: JSON 格式输出
{
    const cmd = `info ${docId} --format json`;
    const result = ctx.runCmd(cmd);
    const info = parseInfoResult(result.output);
    
    if (!result.success) {
        ctx.addResult('TG-24-03', 'JSON格式输出', cmd, '返回JSON格式', 
            '命令执行失败', false, result.error);
    } else if (!info || !docId) {
        ctx.addResult('TG-24-03', 'JSON格式输出', cmd, '返回JSON格式', 
            '无法解析结果', false);
    } else {
        const hasFullInfo = info.id && info.title && info.notebook && info.path;
        const hasPathObject = info.path && typeof info.path === 'object' && 
                             info.path.humanReadable && info.path.storage;
        
        if (hasFullInfo && hasPathObject) {
            ctx.addResult('TG-24-03', 'JSON格式输出', cmd, '返回JSON格式', 
                '成功', true, '包含完整路径对象');
        } else if (hasFullInfo) {
            ctx.addResult('TG-24-03', 'JSON格式输出', cmd, '返回JSON格式', 
                '部分成功', true, 'JSON格式但路径结构简化');
        } else {
            ctx.addResult('TG-24-03', 'JSON格式输出', cmd, '返回JSON格式', 
                '信息不完整', false);
        }
    }
}

// TG-24-04: 无效文档ID处理
{
    const cmd = 'info invalid_doc_id_12345';
    const result = ctx.runCmd(cmd);
    
    const handledError = !result.success || 
                        result.output.includes('不存在') || 
                        result.output.includes('not found') ||
                        result.output.includes('未找到') ||
                        result.output.includes('error');
    
    if (handledError) {
        ctx.addResult('TG-24-04', '无效文档ID', cmd, '正确处理无效ID', 
            '成功', true, '正确返回错误信息');
    } else {
        ctx.addResult('TG-24-04', '无效文档ID', cmd, '正确处理无效ID', 
            '未正确处理', false, `输出: ${result.output.substring(0, 100)}`);
    }
}

// TG-24-05: 笔记本ID输入（应返回错误）
{
    const cmd = `info ${ctx.NOTEBOOK_ID}`;
    const result = ctx.runCmd(cmd);
    
    const rejectedNotebook = !result.success || 
                            result.output.includes('笔记本') || 
                            result.output.includes('notebook') ||
                            result.output.includes('不是文档') ||
                            result.output.includes('类型错误');
    
    if (rejectedNotebook) {
        ctx.addResult('TG-24-05', '笔记本ID输入', cmd, '拒绝笔记本ID', 
            '成功', true, '正确识别并拒绝笔记本ID');
    } else {
        const info = parseInfoResult(result.output);
        if (info && info.success === false && info.reason === 'wrong_id_type') {
            ctx.addResult('TG-24-05', '笔记本ID输入', cmd, '拒绝笔记本ID', 
                '成功', true, '返回明确的错误类型');
        } else {
            ctx.addResult('TG-24-05', '笔记本ID输入', cmd, '拒绝笔记本ID', 
                '未正确处理', false, '应该拒绝笔记本ID');
        }
    }
}

// TG-24-06: 缺少参数处理
{
    const cmd = 'info';
    const result = ctx.runCmd(cmd);
    
    const requiresParam = !result.success || 
                         result.output.includes('错误') || 
                         result.output.includes('error') ||
                         result.output.includes('请提供') ||
                         result.output.includes('缺少');
    
    if (requiresParam) {
        ctx.addResult('TG-24-06', '缺少参数', cmd, '要求提供文档ID', 
            '成功', true, '正确提示缺少参数');
    } else {
        ctx.addResult('TG-24-06', '缺少参数', cmd, '要求提供文档ID', 
            '未正确处理', false, '应该要求提供文档ID');
    }
}

// TG-24-07: 验证属性和标签字段存在
{
    const cmd = `info ${docId} --format json`;
    const result = ctx.runCmd(cmd);
    const info = parseInfoResult(result.output);
    
    if (!result.success || !info || !docId) {
        ctx.addResult('TG-24-07', '验证属性字段', cmd, '返回属性和标签字段', 
            '前置条件不满足', false);
    } else {
        const hasAttributes = 'attributes' in info || 'rawAttributes' in info;
        const hasTags = 'tags' in info;
        const hasCreated = 'created' in info;
        const hasUpdated = 'updated' in info || info.updated === null;
        
        if (hasAttributes && hasTags) {
            ctx.addResult('TG-24-07', '验证属性字段', cmd, '返回属性和标签字段', 
                '成功', true, `属性: ${Object.keys(info.attributes || {}).length}个, 标签: ${(info.tags || []).length}个`);
        } else {
            const missing = [];
            if (!hasAttributes) missing.push('attributes');
            if (!hasTags) missing.push('tags');
            ctx.addResult('TG-24-07', '验证属性字段', cmd, '返回属性和标签字段', 
                '缺少字段', false, `缺少: ${missing.join(', ')}`);
        }
    }
}

ctx.saveReports('TG-24-info', 'TG-24 文档信息测试报告');

ctx.cleanup();
