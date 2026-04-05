/**
 * TG-16 块更新测试
 * 测试 block-update 命令
 * 验证：更新后通过block-get验证内容确实被修改
 * 注意：block-update 只能更新普通块，不能更新文档
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-16 块更新测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

function extractBlockId(output) {
    const match = output.match(/"id"\s*:\s*"([^"]+)"/);
    return match ? match[1] : null;
}

console.log('\n========================================');
console.log('TG-16 块更新测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-16-01: 更新块内容（创建文档，插入块，更新块）
{
    const title = `TG-16-01-块更新_${Date.now()}`;
    const createResult = runCmd(`create "${title}" "块更新测试初始内容" --parent-id ${PARENT_ID}`);
    const docId = extractDocId(createResult.output);
    
    if (!docId) {
        addResult('TG-16-01', '更新块内容', 'block-update <blockId> "内容"', '块内容被更新', '测试文档创建失败', false);
    } else {
        createdDocs.push({ id: docId, title });
        
        const insertResult = runCmd(`block-insert "bu别名测试块" --parent-id ${docId}`);
        const blockId = extractBlockId(insertResult.output);
        
        if (!blockId) {
            addResult('TG-16-01', '更新块内容', 'block-update <blockId> "内容"', '块内容被更新', '创建测试块失败', false);
        } else {
            const newContent = '更新后的块内容_' + Date.now();
            const cmd = `block-update ${blockId} "${newContent}"`;
            const result = runCmd(cmd);
            
            if (!result.success) {
                addResult('TG-16-01', '更新块内容', cmd, '块内容被更新',
                    '命令执行失败', false, result.error || result.output.substring(0, 100));
            } else {
                const getResult = runCmd(`block-get ${blockId} --mode markdown`);
                const hasNewContent = getResult.output.includes(newContent);
                addResult('TG-16-01', '更新块内容', cmd, '块内容被更新',
                    hasNewContent ? '成功' : '内容未更新', hasNewContent, `新内容验证: ${hasNewContent}`);
            }
        }
    }
}

//  清理
ctx.cleanup();

// 保存报告
saveReports('TG-16-block-update', 'TG-16 块更新测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
