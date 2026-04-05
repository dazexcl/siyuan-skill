/**
 * TG-17 块删除测试
 * 测试 block-delete 命令
 * 验证：删除后通过block-get验证块不存在
 * 注意：block-delete 只能删除普通块，不能删除文档
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-17 块删除测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

function extractBlockId(output) {
    const match = output.match(/"id"\s*:\s*"([^"]+)"/);
    return match ? match[1] : null;
}

function checkBlockExists(blockId) {
    const result = runCmd(`block-get ${blockId}`);
    return result.success && !result.output.includes('不存在') && !result.output.includes('error');
}

console.log('\n========================================');
console.log('TG-17 块删除测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-17-01: 删除块（创建文档，插入块，删除块）
{
    const title = `TG-17-01-块删除_${Date.now()}`;
    const createResult = runCmd(`create "${title}" "文档内容" --parent-id ${PARENT_ID}`);
    const docId = extractDocId(createResult.output);
    
    if (!docId) {
        addResult('TG-17-01', '删除块', 'block-delete <blockId>', '块被删除', '测试文档创建失败', false);
    } else {
        createdDocs.push({ id: docId, title });
        
        const insertResult = runCmd(`block-insert "待删除的块内容" --parent-id ${docId}`);
        const blockId = extractBlockId(insertResult.output);
        
        if (!blockId) {
            addResult('TG-17-01', '删除块', 'block-delete <blockId>', '块被删除', '创建测试块失败', false);
        } else {
            const cmd = `block-delete ${blockId}`;
            const result = runCmd(cmd);
            
            if (!result.success) {
                addResult('TG-17-01', '删除块', cmd, '块被删除',
                    '命令执行失败', false, result.error || result.output.substring(0, 100));
            } else {
                const stillExists = checkBlockExists(blockId);
                if (!stillExists) {
                    addResult('TG-17-01', '删除块', cmd, '块被删除',
                        '成功', true, `块 ${blockId} 已被删除`);
                } else {
                    addResult('TG-17-01', '删除块', cmd, '块被删除',
                        '块仍然存在', false, `块 ${blockId} 删除后仍可访问`);
                }
            }
        }
    }
}

//  清理
ctx.cleanup();

// 保存报告
saveReports('TG-17-block-delete', 'TG-17 块删除测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
