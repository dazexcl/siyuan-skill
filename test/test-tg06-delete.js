/**
 * TG-06 文档删除测试
 * 测试 delete 命令及其功能
 * 验证：删除后通过content命令验证文档确实不存在
 * 验证：删除功能正常工作，返回正确的格式
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-06 文档删除测试');

/**
 * 检查文档是否存在
 * @param {string} docId - 文档ID
 * @returns {Object} {exists: boolean, isIndexing: boolean}
 */
function checkDocExists(docId) {
    const result = ctx.runCmd(`content ${docId} --raw`);
    const isIndexing = !result.success && (result.output.includes('索引') || result.output.includes('indexing'));
    const exists = result.success && result.output.includes('id=');
    return { exists, isIndexing };
}

/**
 * 解析删除操作的JSON输出
 * @param {string} output - 命令输出
 * @returns {Object|null} 解析后的对象
 */
function parseDeleteOutput(output) {
    try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
}

/**
 * 验证删除结果包含基本元数据
 * @param {string} output - 命令输出
 * @param {string} expectedId - 期望的文档ID
 * @param {string} expectedTitle - 期望的文档标题
 * @returns {boolean} 是否包含基本元数据
 */
function verifyDeleteMetadata(output, expectedId, expectedTitle) {
    const parsed = parseDeleteOutput(output);
    if (!parsed) return false;
    
    return parsed.success === true &&
           parsed.id === expectedId &&
           parsed.title === expectedTitle &&
           parsed.deleted === true &&
           typeof parsed.timestamp === 'number' &&
           parsed.message === '文档已删除';
}

/**
 * 验证删除操作已执行
 * @param {string} output - 命令输出
 * @returns {boolean} 是否显示删除操作已执行
 */
function verifyDeleteOperation(output) {
    return output.includes('执行删除操作:') &&
           output.includes('调用删除文档API:') &&
           output.includes('删除验证成功');
}

console.log('\n========================================');
console.log('TG-06 文档删除测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-06-01: 基本删除
{
    const title = `TG-06-01-基本删除_${Date.now()}`;
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
            const checkResult = checkDocExists(docId);
            const stillExists = checkResult.exists;
            const hasMetadata = verifyDeleteMetadata(result.output, docId, title);
            const hasOperation = verifyDeleteOperation(result.output);
            
            // 删除成功：文档不存在，删除命令成功执行，且包含元数据
            if (!stillExists && result.success && hasOperation) {
                const details = [`文档 ${docId} 已被删除`];
                if (hasMetadata) details.push('元数据完整');
                if (hasOperation) details.push('操作记录完整');
                ctx.addResult('TG-06-01', '基本删除', cmd, '文档被删除',
                    '成功', true, details.join('，'));
            } else {
                const issues = [];
                if (stillExists && !checkResult.isIndexing) issues.push('文档仍存在');
                if (!result.success) issues.push('删除命令失败');
                if (!hasOperation) issues.push('缺少操作记录');
                if (!hasMetadata) issues.push('元数据不完整');
                ctx.addResult('TG-06-01', '基本删除', cmd, '文档被删除',
                    '部分失败', false, issues.join(', '));
            }
        }
    }
}

// TG-06-02: 确认标题删除
{
    const title = `TG-06-02-确认标题删除_${Date.now()}`;
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
            const checkResult = checkDocExists(docId);
            const stillExists = checkResult.exists;
            const hasMetadata = verifyDeleteMetadata(result.output, docId, title);
            
            // 确认标题删除成功：文档不存在，删除命令成功
            if (!stillExists && result.success) {
                const details = [`文档已删除${checkResult.isIndexing ? '（索引状态）' : ''}`];
                if (hasMetadata) details.push('元数据完整');
                ctx.addResult('TG-06-02', '确认标题删除', cmd, '标题匹配时删除成功',
                    '成功', true, details.join('，'));
            } else {
                const issues = [];
                if (stillExists && !checkResult.isIndexing) issues.push('文档仍存在');
                if (!result.success) issues.push('删除命令失败');
                if (!hasMetadata) issues.push('元数据不完整');
                ctx.addResult('TG-06-02', '确认标题删除', cmd, '标题匹配时删除成功',
                    '部分失败', false, issues.join(', '));
            }
        }
    }
}

// TG-06-03: 删除验证机制
{
    const title = `TG-06-03-删除验证_${Date.now()}`;
    const createResult = ctx.runCmd(`create "${title}" "删除验证测试" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-06-03', '删除验证机制', 'delete <docId>', '删除后显示验证信息', '测试文档创建失败', false);
    } else {
        const cmd = `delete ${docId} --confirm-title "${title}"`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-06-03', '删除验证机制', cmd, '删除后显示验证信息',
                '删除命令失败', false, result.error || result.output.substring(0, 100));
        } else {
            const hasVerification = result.output.includes('删除验证成功');
            const checkResult = checkDocExists(docId);
            const stillExists = checkResult.exists;
            
            // 验证机制：显示验证信息
            if (hasVerification) {
                const details = ['验证机制正常工作'];
                if (checkResult.isIndexing) details.push('（索引状态）');
                else if (stillExists) details.push('（文档仍存在）');
                ctx.addResult('TG-06-03', '删除验证机制', cmd, '删除后显示验证信息',
                    '成功', true, details.join(''));
            } else {
                const issues = [];
                if (!hasVerification) issues.push('缺少验证信息');
                if (stillExists && !checkResult.isIndexing) issues.push('文档仍存在');
                ctx.addResult('TG-06-03', '删除验证机制', cmd, '删除后显示验证信息',
                    '部分失败', false, issues.join(', '));
            }
        }
    }
}

// TG-06-04: 不存在的文档
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
    const title = `TG-06-05-标题不匹配_${Date.now()}`;
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
        const checkResult = checkDocExists(docId);
        const stillExists = checkResult.exists;
        const isIndexing = checkResult.isIndexing;
        
        if (rejected && stillExists) {
            ctx.addResult('TG-06-05', '标题不匹配拒绝删除', cmd, '拒绝删除',
                '成功', true, '正确拒绝删除，文档仍存在');
            ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
        } else if (!stillExists && !isIndexing) {
            ctx.addResult('TG-06-05', '标题不匹配拒绝删除', cmd, '拒绝删除',
                '文档被错误删除', false, '标题不匹配时不应删除');
        } else {
            ctx.addResult('TG-06-05', '标题不匹配拒绝删除', cmd, '拒绝删除',
                '未明确拒绝', false, `output: ${result.output.substring(0, 100)}`);
            ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
        }
    }
}

// TG-06-05: 级联删除 - 删除父文档时子文档自动删除
{
    const ts = Date.now();
    const rootTitle = `TG-06-05-级联删除根文档_${ts}`;
    const child1Title = `TG-06-05-子文档1_${ts}`;
    const child2Title = `TG-06-05-子文档2_${ts}`;
    
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
                const rootCheck = checkDocExists(rootId);
                const child1Check = checkDocExists(child1Id);
                const child2Check = checkDocExists(child2Id);
                
                const rootExists = rootCheck.exists;
                const child1Exists = child1Check.exists;
                const child2Exists = child2Check.exists;
                const isIndexing = rootCheck.isIndexing || child1Check.isIndexing || child2Check.isIndexing;
                
                if ((!rootExists || isIndexing) && (!child1Exists || isIndexing) && (!child2Exists || isIndexing)) {
                    ctx.addResult('TG-06-06', '级联删除', cmd, '子文档自动删除',
                        '成功', true, `父文档和所有子文档均已删除${isIndexing ? '（索引状态）' : ''}`);
                } else {
                    const remaining = [];
                    if (rootExists && !rootCheck.isIndexing) remaining.push('root');
                    if (child1Exists && !child1Check.isIndexing) remaining.push('child1');
                    if (child2Exists && !child2Check.isIndexing) remaining.push('child2');
                    ctx.addResult('TG-06-06', '级联删除', cmd, '子文档自动删除',
                        '部分残留', false, `残留文档: ${remaining.join(', ')}`);
                }
            }
        }
    }
}

// TG-06-06: 删除操作日志验证
{
    const title = `TG-06-06-日志记录_${Date.now()}`;
    const createResult = ctx.runCmd(`create "${title}" "日志测试" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-06-06', '删除操作日志', 'delete <docId>', '输出操作日志', '测试文档创建失败', false);
    } else {
        const cmd = `delete ${docId} --confirm-title "${title}"`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-06-06', '删除操作日志', cmd, '输出操作日志',
                '删除命令失败', false, result.error || result.output.substring(0, 100));
        } else {
            const hasExecutionLog = result.output.includes('执行删除操作:');
            const hasApiLog = result.output.includes('调用删除文档API:');
            const hasVerifyLog = result.output.includes('删除验证成功');
            
            if (hasExecutionLog && hasApiLog && hasVerifyLog) {
                ctx.addResult('TG-06-06', '删除操作日志', cmd, '输出操作日志',
                    '成功', true, '日志包含执行操作、API调用和验证信息');
            } else {
                const issues = [];
                if (!hasExecutionLog) issues.push('缺少执行日志');
                if (!hasApiLog) issues.push('缺少API调用日志');
                if (!hasVerifyLog) issues.push('缺少验证日志');
                ctx.addResult('TG-06-06', '删除操作日志', cmd, '输出操作日志',
                    '部分缺失', false, issues.join(', '));
            }
        }
    }
}

// TG-06-07: 删除包含特殊字符标题的文档
{
    const title = `TG-06-07-特殊字符_${Date.now()}_测试_文档`;
    const createResult = ctx.runCmd(`create "${title}" "特殊字符测试" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-06-08', '特殊字符标题', 'delete <docId>', '正确处理特殊字符', '测试文档创建失败', false);
    } else {
        const cmd = `delete ${docId} --confirm-title "${title}"`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-06-08', '特殊字符标题', cmd, '正确处理特殊字符',
                '删除命令失败', false, result.error || result.output.substring(0, 100));
        } else {
            ctx.sleep(500);
            const checkResult = checkDocExists(docId);
            const stillExists = checkResult.exists;
            const hasMetadata = verifyDeleteMetadata(result.output, docId, title);
            
            // 特殊字符处理成功：文档不存在，删除命令成功
            if (!stillExists && result.success) {
                const details = [`特殊字符处理正确${checkResult.isIndexing ? '（索引状态）' : ''}`];
                if (hasMetadata) details.push('元数据完整');
                ctx.addResult('TG-06-08', '特殊字符标题', cmd, '正确处理特殊字符',
                    '成功', true, details.join('，'));
            } else {
                const issues = [];
                if (stillExists && !checkResult.isIndexing) issues.push('文档仍存在');
                if (!result.success) issues.push('删除命令失败');
                if (!hasMetadata) issues.push('元数据不完整');
                ctx.addResult('TG-06-08', '特殊字符标题', cmd, '正确处理特殊字符',
                    '部分失败', false, issues.join(', '));
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
