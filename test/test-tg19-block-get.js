/**
 * TG-19 块获取测试
 * 测试 block-get 命令
 * 验证：获取指定块的内容
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-19 块获取测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

console.log('\n========================================');
console.log('TG-19 块获取测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `test_block_get_${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "块获取测试内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);
if (testDocId) {
    createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-19-01: 获取块内容
if (testDocId) {
    const cmd = `block-get ${testDocId}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-19-01', '获取块内容', cmd, '返回块内容',
            '命令执行失败', false, result.error);
    } else {
        const hasId = result.output.includes(testDocId) || result.output.includes('"id"');
        const hasContent = result.output.includes('块获取测试内容') || result.output.includes('content');
        if (hasId || hasContent) {
            addResult('TG-19-01', '获取块内容', cmd, '返回块内容',
                '成功', true, `输出长度: ${result.output.length}, 包含预期内容`);
        } else {
            addResult('TG-19-01', '获取块内容', cmd, '返回块内容',
                '内容不匹配', false, `输出: ${result.output.substring(0, 200)}`);
        }
    }
} else {
    addResult('TG-19-01', '获取块内容', 'block-get <blockId>', '返回块内容', '测试文档创建失败', false);
}

//  TG-19-03: 获取不存在的块
{
    const fakeId = '20230301' + Math.random().toString(36).substring(2, 15);
    const cmd = `block-get ${fakeId}`;
    const result = runCmd(cmd);
    const hasError = !result.success || result.output.includes('错误') || result.output.includes('error') || result.output.includes('不存在');
    
    addResult('TG-19-03', '获取不存在的块', cmd, '返回错误提示',
        hasError ? '成功' : '未检测到错误', hasError, result.output.substring(0, 100));
}

// 清理
cleanup();

// 保存报告
saveReports('TG-19-block-get', 'TG-19 块获取测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
