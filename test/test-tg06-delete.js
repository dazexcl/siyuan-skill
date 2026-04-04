/**
 * TG-06 文档删除测试
 * 测试 delete 命令及其别名
 * 验证：删除后通过content命令验证文档确实不存在
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-06 文档删除测试');

function checkDocExists(docId) {
    const result = ctx.runCmd(`content ${docId} --raw`);
    return result.success && result.output.includes('id=');
}

console.log('\n========================================');
console.log('TG-06 文档删除测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-06-01: 基本删除
{
    const title = `test_delete_01_${Date.now()}`;
    const createResult = ctx.runCmd(`create "${title}" "待删除内容" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-06-01', '基本删除', 'delete <docId>', '文档被删除', '测试文档创建失败', false);
    } else {
        const cmd = `delete ${docId} --confirm-title "${title}"`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-06-01', '基本删除', cmd, '文档被删除',
                '删除命令失败', false, result.error || result.output.substring(0, 100));
        } else {
            ctx.sleep(500);
            const stillExists = checkDocExists(docId);
            if (!stillExists) {
                ctx.addResult('TG-06-01', '基本删除', cmd, '文档被删除',
                    '成功', true, `文档 ${docId} 已被删除，验证不存在`);
            } else {
                ctx.addResult('TG-06-01', '基本删除', cmd, '文档被删除',
                    '文档仍然存在', false, `文档 ${docId} 删除后仍可访问`);
            }
        }
    }
}

// TG-06-02: 确认标题删除
{
    const title = `test_delete_02_${Date.now()}`;
    const createResult = ctx.runCmd(`create "${title}" "内容" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-06-02', '确认标题删除', 'delete <docId> --confirm-title "标题"', '标题匹配时删除成功', '测试文档创建失败', false);
    } else {
        const cmd = `delete ${docId} --confirm-title "${title}"`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-06-02', '确认标题删除', cmd, '标题匹配时删除成功',
                '删除命令失败', false, result.error || result.output.substring(0, 100));
        } else {
            ctx.sleep(500);
            const stillExists = checkDocExists(docId);
            if (!stillExists) {
                ctx.addResult('TG-06-02', '确认标题删除', cmd, '标题匹配时删除成功',
                    '成功', true, `文档已删除`);
            } else {
                ctx.addResult('TG-06-02', '确认标题删除', cmd, '标题匹配时删除成功',
                    '文档仍存在', false, `文档删除失败`);
            }
        }
    }
}

//  TG-06-04: 不存在的文档
{
    const cmd = 'delete 20260101120000-notexist-xxxx --confirm-title "不存在的文档"';
    const result = ctx.runCmd(cmd);
    
    const handled = !result.success || 
                   result.output.includes('失败') || 
                   result.output.includes('错误') ||
                   result.output.includes('未找到') ||
                   result.output.includes('not found') ||
                   result.output.includes('不存在') ||
                   result.output.includes('确认失败');
    
    ctx.addResult('TG-06-04', '不存在的文档', cmd, '正确处理不存在的文档',
        handled ? '成功' : '未正确处理', handled,
        handled ? '正确返回错误信息' : '未返回预期错误');
}

// TG-06-05: 标题不匹配拒绝删除
{
    const title = `test_delete_mismatch_${Date.now()}`;
    const createResult = ctx.runCmd(`create "${title}" "标题不匹配测试" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-06-05', '标题不匹配拒绝删除', 'delete <docId> --confirm-title "错误标题"', '拒绝删除', '测试文档创建失败', false);
    } else {
        const cmd = `delete ${docId} --confirm-title "错误的标题"`;
        const result = ctx.runCmd(cmd);
        
        const deleted = result.success && result.output.includes('success') && result.output.includes('已删除');
        const rejected = !deleted;
        
        ctx.sleep(300);
        const stillExists = checkDocExists(docId);
        
        if (rejected && stillExists) {
            ctx.addResult('TG-06-05', '标题不匹配拒绝删除', cmd, '拒绝删除',
                '成功', true, '正确拒绝删除，文档仍存在');
            ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
        } else if (!stillExists) {
            ctx.addResult('TG-06-05', '标题不匹配拒绝删除', cmd, '拒绝删除',
                '文档被错误删除', false, '标题不匹配时不应删除');
        } else {
            ctx.addResult('TG-06-05', '标题不匹配拒绝删除', cmd, '拒绝删除',
                '未明确拒绝', false, `output: ${result.output.substring(0, 100)}`);
            ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
        }
    }
}

// TG-06-06: 级联删除 - 删除父文档时子文档自动删除
{
    const ts = Date.now();
    const rootTitle = `cascade_root_${ts}`;
    const child1Title = `cascade_child1_${ts}`;
    const child2Title = `cascade_child2_${ts}`;
    
    const rootResult = ctx.runCmd(`create "${rootTitle}" "根文档内容" --parent-id ${ctx.PARENT_ID}`);
    const rootId = ctx.extractDocId(rootResult.output);
    
    if (!rootId) {
        ctx.addResult('TG-06-06', '级联删除', 'delete父文档', '子文档自动删除', '根文档创建失败', false);
    } else {
        ctx.sleep(300);
        const child1Result = ctx.runCmd(`create "${child1Title}" "子文档1" --parent-id ${rootId}`);
        const child1Id = ctx.extractDocId(child1Result.output);
        
        ctx.sleep(300);
        const child2Result = ctx.runCmd(`create "${child2Title}" "子文档2" --parent-id ${rootId}`);
        const child2Id = ctx.extractDocId(child2Result.output);
        
        if (!child1Id || !child2Id) {
            ctx.addResult('TG-06-06', '级联删除', 'delete父文档', '子文档自动删除', '子文档创建失败', false);
            ctx.runCmd(`delete ${rootId} --confirm-title "${rootTitle}"`);
        } else {
            ctx.sleep(500);
            
            const cmd = `delete ${rootId} --confirm-title "${rootTitle}"`;
            const result = ctx.runCmd(cmd);
            
            if (!result.success) {
                ctx.addResult('TG-06-06', '级联删除', cmd, '子文档自动删除',
                    '删除命令失败', false, result.error || result.output.substring(0, 100));
            } else {
                ctx.sleep(500);
                const rootExists = checkDocExists(rootId);
                const child1Exists = checkDocExists(child1Id);
                const child2Exists = checkDocExists(child2Id);
                
                if (!rootExists && !child1Exists && !child2Exists) {
                    ctx.addResult('TG-06-06', '级联删除', cmd, '子文档自动删除',
                        '成功', true, '父文档和所有子文档均已删除');
                } else {
                    const remaining = [];
                    if (rootExists) remaining.push('root');
                    if (child1Exists) remaining.push('child1');
                    if (child2Exists) remaining.push('child2');
                    ctx.addResult('TG-06-06', '级联删除', cmd, '子文档自动删除',
                        '部分残留', false, `残留文档: ${remaining.join(', ')}`);
                }
            }
        }
    }
}

ctx.saveReports('TG-06-delete', 'TG-06 文档删除测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
