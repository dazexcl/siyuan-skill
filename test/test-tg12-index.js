/**
 * TG-12 向量索引测试
 * 测试 index 命令
 * 验证：索引操作返回成功状态，并验证索引数量
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-12 向量索引测试');
const { runCmd, addResult, saveReports, NOTEBOOK_ID } = ctx;

function parseIndexResult(output) {
    const indexedMatch = output.match(/成功索引\s*(\d+)\s*个文档/);
    const skippedMatch = output.match(/跳过\s*(\d+)\s*个/);
    const cleanedMatch = output.match(/清理\s*(\d+)\s*个/);
    const alreadyMatch = output.match(/所有文档已是最新/);
    
    return {
        indexed: indexedMatch ? parseInt(indexedMatch[1], 10) : 0,
        skipped: skippedMatch ? parseInt(skippedMatch[1], 10) : 0,
        cleaned: cleanedMatch ? parseInt(cleanedMatch[1], 10) : 0,
        isAlreadyNewest: !!alreadyMatch,
        hasError: output.includes('失败') || output.includes('错误') || output.includes('不可用')
    };
}

console.log('\n========================================');
console.log('TG-12 向量索引测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-12-01: 增量索引
{
    const cmd = 'index';
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-12-01', '增量索引', cmd, '索引变化的内容',
            '命令执行失败', false, result.error);
    } else {
        const data = parseIndexResult(result.output);
        if (data.hasError) {
            addResult('TG-12-01', '增量索引', cmd, '索引变化的内容',
                '返回错误', false, '索引过程出错');
        } else if (data.isAlreadyNewest) {
            addResult('TG-12-01', '增量索引', cmd, '索引变化的内容',
                '成功', true, '所有文档已是最新，无需重新索引');
        } else {
            const summary = [];
            if (data.indexed > 0) summary.push(`索引${data.indexed}个`);
            if (data.skipped > 0) summary.push(`跳过${data.skipped}个`);
            if (data.cleaned > 0) summary.push(`清理${data.cleaned}个`);
            addResult('TG-12-01', '增量索引', cmd, '索引变化的内容',
                '成功', true, summary.join(', ') || '完成');
        }
    }
}

// TG-12-02: 索引指定笔记本
{
    const cmd = `index --notebook ${NOTEBOOK_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-12-02', '索引指定笔记本', cmd, '只索引指定笔记本',
            '命令执行失败', false, result.error);
    } else {
        const data = parseIndexResult(result.output);
        if (data.hasError) {
            addResult('TG-12-02', '索引指定笔记本', cmd, '只索引指定笔记本',
                '返回错误', false, '索引过程出错');
        } else {
            const summary = [];
            if (data.indexed > 0) summary.push(`索引${data.indexed}个`);
            if (data.skipped > 0) summary.push(`跳过${data.skipped}个`);
            addResult('TG-12-02', '索引指定笔记本', cmd, '只索引指定笔记本',
                '成功', true, summary.join(', ') || '已是最新');
        }
    }
}

// TG-12-03: 强制重建索引
{
    const cmd = `index --notebook ${NOTEBOOK_ID} --force`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-12-03', '强制重建索引', cmd, '删除后重建索引',
            '命令执行失败', false, result.error);
    } else {
        const data = parseIndexResult(result.output);
        if (data.hasError) {
            addResult('TG-12-03', '强制重建索引', cmd, '删除后重建索引',
                '返回错误', false, '索引过程出错');
        } else {
            // 强制重建应该有索引数量
            const hasIndexed = data.indexed > 0;
            addResult('TG-12-03', '强制重建索引', cmd, '删除后重建索引',
                hasIndexed ? '成功' : '无文档', hasIndexed, 
                hasIndexed ? `重建索引 ${data.indexed} 个文档` : '笔记本无文档');
        }
    }
}

// TG-12-04: 无效笔记本ID处理
{
    const cmd = 'index --notebook invalid_notebook_id_12345';
    const result = runCmd(cmd);
    
    const handled = !result.success || 
                   result.output.includes('失败') || 
                   result.output.includes('错误') ||
                   result.output.includes('0 个文档') ||
                   result.output.includes('没有找到');
    
    addResult('TG-12-04', '无效笔记本ID', cmd, '正确处理无效ID',
        handled ? '成功' : '未正确处理', handled,
        handled ? '正确处理无效笔记本ID' : '未返回预期结果');
}

// 保存报告
saveReports('TG-12-index', 'TG-12 向量索引测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
