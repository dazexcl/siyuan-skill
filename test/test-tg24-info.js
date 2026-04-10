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

console.log('\n添加测试属性和标签...');

// 添加自定义属性（custom- 前缀）
const attrsResult = ctx.runCmd(`block-attrs ${docId} --set version=1.0`);
console.log('属性设置结果:', attrsResult.success ? '成功' : '失败');

// 添加测试标签
const tagsResult = ctx.runCmd(`tags ${docId} --add 测试,TG-24,info命令测试`);
console.log('标签添加结果:', tagsResult.success ? '成功' : '失败');

console.log('\n测试用例:');

// 执行一次 info 命令，多个验证点
const cmd = `info ${docId}`;
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

    // TG-24-003: 验证完整数据结构和内容准确性
    {
        const issues = [];
        const details = [];

        // 验证 ID 和标题
        const idMatch = data && data.id === docId;
        const titleMatch = data && data.title === docTitle;

        if (!idMatch) issues.push('ID不匹配');
        if (!titleMatch) issues.push('标题不匹配');
        if (idMatch && titleMatch) details.push(`ID: ${data.id}, 标题: ${data.title}`);

        // 验证类型
        const hasType = data && data.type === 'd';
        if (!hasType) issues.push('类型不正确（应为d）');
        if (hasType) details.push(`类型: ${data.type}`);

        // 验证路径信息
        const hasPath = data && data.path && data.path.apath;
        const pathContainsTitle = hasPath && data.path.apath.includes(docTitle);
        const pathContainsNotebook = hasPath && data.notebook && data.path.apath.includes(data.notebook.name);

        if (!hasPath) issues.push('路径缺失');
        else if (!pathContainsTitle) issues.push('路径不包含标题');
        else if (!pathContainsNotebook) issues.push('路径不包含笔记本名称');
        else details.push(`路径: ${data.path.apath}`);

        // 验证笔记本信息
        const hasNotebook = data && data.notebook && data.notebook.id && data.notebook.name;
        const notebookIdMatch = hasNotebook && data.notebook.id === ctx.NOTEBOOK_ID;

        if (!hasNotebook) issues.push('笔记本信息缺失');
        else if (!notebookIdMatch) issues.push('笔记本ID不匹配');
        else details.push(`笔记本: ${data.notebook.name}`);

        // 验证属性字段
        const hasAttributes = data && 'attributes' in data;
        const hasTags = data && 'tags' in data;
        const hasIcon = data && 'icon' in data;
        const hasRawAttrs = data && 'rawAttributes' in data;
        const hasName = data && 'name' in data;

        if (!hasAttributes) issues.push('缺少attributes字段');
        if (!hasTags) issues.push('缺少tags字段');
        if (!hasIcon) issues.push('缺少icon字段');
        if (!hasRawAttrs) issues.push('缺少rawAttributes字段');
        if (!hasName) issues.push('缺少name字段');

        // 验证自定义属性值
        const versionMatch = data && data.attributes && data.attributes.version === '1.0';

        if (hasAttributes && !versionMatch) issues.push('version值不匹配');

        // 验证标签
        const expectedTags = ['测试', 'TG-24', 'info命令测试'];
        const tagsMatch = hasTags && data.tags && expectedTags.every(tag => data.tags.includes(tag));
        const tagsCount = hasTags && data.tags ? data.tags.length : 0;

        if (hasTags && !tagsMatch) issues.push(`标签不匹配，期望: [${expectedTags.join(', ')}], 实际: [${(data.tags || []).join(', ')}]`);

        if (hasAttributes && hasTags && hasIcon && hasRawAttrs && hasName) {
            details.push(`标签数: ${tagsCount}`);
            if (versionMatch) details.push('version: 1.0');
        }

        // 验证时间字段
        const hasUpdated = data && data.updated;
        const hasCreated = data && data.created;

        if (!hasUpdated) issues.push('缺少updated字段');
        if (!hasCreated) issues.push('缺少created字段');
        if (hasUpdated && hasCreated) details.push(`创建: ${data.created}, 更新: ${data.updated}`);

        const allPassed = issues.length === 0;
        ctx.addResult('TG-24-003', '验证完整数据结构', cmd, '返回结构和内容准确',
            allPassed ? '成功' : '部分失败', allPassed,
            allPassed ? details.join('; ') : issues.join('; '));
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

// TG-24-010: --raw 选项支持
{
    const cmd5 = `info ${docId} --raw`;
    const result5 = ctx.runCmd(cmd5);
    const data5 = parseJSON(result5.output);

    const hasId = data5 && data5.id === docId;
    const hasTitle = data5 && data5.title === docTitle;
    const hasNoWrapper = result5.output && !result5.output.includes('success');

    ctx.addResult('TG-24-010', '--raw 选项支持', cmd5, '--raw 应直接输出数据',
        hasId && hasTitle && hasNoWrapper ? '成功' : '信息不匹配', hasId && hasTitle && hasNoWrapper,
        hasId && hasTitle && hasNoWrapper ? '--raw 选项正常工作' : '--raw 选项功能异常');
}

// TG-24-011: -r 短选项支持
{
    const cmd6 = `info ${docId} -r`;
    const result6 = ctx.runCmd(cmd6);
    const data6 = parseJSON(result6.output);

    const hasId = data6 && data6.id === docId;
    const hasTitle = data6 && data6.title === docTitle;
    const hasNoWrapper = result6.output && !result6.output.includes('success');

    ctx.addResult('TG-24-011', '-r 短选项支持', cmd6, '-r 应等同于 --raw',
        hasId && hasTitle && hasNoWrapper ? '成功' : '信息不匹配', hasId && hasTitle && hasNoWrapper,
        hasId && hasTitle && hasNoWrapper ? '-r 短选项正常工作' : '-r 短选项功能异常');
}

ctx.saveReports('TG-24-info', 'TG-24 文档信息测试报告');

ctx.cleanup();
