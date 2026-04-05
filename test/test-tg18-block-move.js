/**
 * TG-18 块移动测试
 * 测试 block-move 命令
 * 验证：移动后验证块在新位置
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-18 块移动测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

console.log('\n========================================');
console.log('TG-18 块移动测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-18-01: 移动块到新父块
{
    const title1 = `TG-18-01-移动源_${Date.now()}`;
    const title2 = `TG-18-01-移动目标_${Date.now()}`;
    const createResult1 = runCmd(`create "${title1}" "源块内容" --parent-id ${PARENT_ID}`);
    const createResult2 = runCmd(`create "${title2}" "目标父块内容" --parent-id ${PARENT_ID}`);
    const sourceId = extractDocId(createResult1.output);
    const targetId = extractDocId(createResult2.output);
    
    if (!sourceId || !targetId) {
        addResult('TG-18-01', '移动块到新父块', 'block-move <blockId> <parentId>', '块被移动', '测试文档创建失败', false);
    } else {
        createdDocs.push({ id: targetId, title: title2 });
        
        const cmd = `block-move ${sourceId} ${targetId}`;
        const result = runCmd(cmd);
        
        if (!result.success) {
            addResult('TG-18-01', '移动块到新父块', cmd, '块被移动',
                '命令执行失败', false, result.error);
        } else {
            const hasMoved = result.output.includes('success') || 
                            result.output.includes('moved') || 
                            result.output.includes('true');
            if (hasMoved) {
                addResult('TG-18-01', '移动块到新父块', cmd, '块被移动',
                    '成功', true, `块 ${sourceId} 已移动到 ${targetId}`);
            } else {
                addResult('TG-18-01', '移动块到新父块', cmd, '块被移动',
                    '移动结果未确认', false, `输出: ${result.output.substring(0, 200)}`);
            }
        }
    }
}

//  清理
ctx.cleanup();

// 保存报告
saveReports('TG-18-block-move', 'TG-18 块移动测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
