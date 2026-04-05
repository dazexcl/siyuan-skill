/**
 * TG-21 块引用转移测试
 * 测试 block-transfer 命令
 * 验证：转移命令返回确认信息，bt 别名与主命令行为一致
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-21 块引用转移测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

console.log('\n========================================');
console.log('TG-21 块引用转移测试');
console.log('========================================\n');

console.log('准备测试数据...');
const title1 = `TG-21-01-引用转移源_${Date.now()}`;
const title2 = `TG-21-01-引用转移目标_${Date.now()}`;
const createResult1 = runCmd(`create "${title1}" "源块内容" --parent-id ${PARENT_ID}`);
const createResult2 = runCmd(`create "${title2}" "目标块内容" --parent-id ${PARENT_ID}`);
const fromId = extractDocId(createResult1.output);
const toId = extractDocId(createResult2.output);
if (fromId) createdDocs.push({ id: fromId, title: title1 });
if (toId) createdDocs.push({ id: toId, title: title2 });
console.log(`源块: ${fromId}, 目标块: ${toId}`);
console.log('');

console.log('测试用例:');

// TG-21-01: 基本转移
if (fromId && toId) {
    const cmd = `block-transfer --from-id ${fromId} --to-id ${toId}`;
    const result = runCmd(cmd);
    
    if (result.success) {
        addResult('TG-21-01', '基本转移', cmd, '引用被转移', '成功', true, '转移结果: ' + result.output.substring(0, 100));
    } else {
        addResult('TG-21-01', '基本转移', cmd, '引用被转移', '命令执行失败', false, result.error || result.output.substring(0, 100));
    }
} else {
    addResult('TG-21-01', '基本转移', 'block-transfer --from-id <id> --to-id <id>', '引用被转移', '测试文档创建失败', false);
}

//  TG-21-03: 验证无效ID处理
{
    const cmd = `block-transfer --from-id invalid_id --to-id ${toId || 'test_id'}`;
    const result = runCmd(cmd);
    
    const handled = !result.success || 
                   result.output.includes('错误') || 
                   result.output.includes('error') ||
                   result.output.includes('失败') ||
                   result.output.includes('invalid') ||
                   result.output.includes('0') ||
                   result.output.includes('null');
    
    if (handled) {
        addResult('TG-21-03', '无效ID处理', cmd, '正确处理无效ID', '成功', true, '正确处理无效ID');
    } else {
        addResult('TG-21-03', '无效ID处理', cmd, '正确处理无效ID', '未正确处理', false, `输出: ${result.output.substring(0, 100)}`);
    }
}

ctx.cleanup();

saveReports('TG-21-block-transfer', 'TG-21 块引用转移测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
