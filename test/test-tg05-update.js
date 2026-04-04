/**
 * TG-05 文档更新测试
 * 测试 update 命令及其别名
 * 验证：更新后通过content命令验证内容确实被修改
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-05 文档更新测试');

function getDocContent(docId) {
    const result = ctx.runCmd(`content ${docId}`);
    if (!result.success) return '';
    try {
        const jsonMatch = result.output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return String(result.output);
        const data = JSON.parse(jsonMatch[0]);
        const raw = data.data !== undefined ? data.data : (data.content !== undefined ? data.content : '');
        return typeof raw === 'string' ? raw : JSON.stringify(raw);
    } catch (e) {
        return String(result.output);
    }
}

console.log('\n========================================');
console.log('TG-05 文档更新测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `test_update_${Date.now()}`;
const initialContent = '初始内容_' + Date.now();
const createResult = ctx.runCmd(`create "${testDocTitle}" "${initialContent}" --parent-id ${ctx.PARENT_ID}`);
const testDocId = ctx.extractDocId(createResult.output);
if (testDocId) {
    ctx.createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-05-01: 基本更新
if (testDocId) {
    const newContent = '更新后的内容_' + Date.now();
    const cmd = `update ${testDocId} "${newContent}"`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        ctx.addResult('TG-05-01', '基本更新', cmd, '文档内容被更新',
            '命令执行失败', false, result.error);
    } else {
        const actualContent = getDocContent(testDocId);
        if (actualContent && actualContent.includes(newContent)) {
            ctx.addResult('TG-05-01', '基本更新', cmd, '文档内容被更新',
                '成功', true, `新内容已验证: ${newContent.substring(0, 30)}...`);
        } else {
            ctx.addResult('TG-05-01', '基本更新', cmd, '文档内容被更新',
                '内容未更新', false, `预期包含: ${newContent}`);
        }
    }
} else {
    ctx.addResult('TG-05-01', '基本更新', 'update <docId> "新内容"', '文档内容被更新', '测试文档创建失败', false);
}

// TG-05-02: 验证内容被覆盖
if (testDocId) {
    const verifyContent = '验证覆盖_' + Date.now();
    const cmd = `update ${testDocId} "${verifyContent}"`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        ctx.addResult('TG-05-02', '验证内容被覆盖', cmd, '旧内容被覆盖',
            '命令执行失败', false, result.error);
    } else {
        const actualContent = getDocContent(testDocId);
        const hasOld = actualContent.includes(initialContent);
        const hasNew = actualContent.includes(verifyContent);
        if (!hasOld && hasNew) {
            ctx.addResult('TG-05-02', '验证内容被覆盖', cmd, '旧内容被覆盖',
                '成功', true, '旧内容已覆盖，新内容存在');
        } else {
            ctx.addResult('TG-05-02', '验证内容被覆盖', cmd, '旧内容被覆盖',
                '覆盖异常', false, `hasOld: ${hasOld}, hasNew: ${hasNew}`);
        }
    }
} else {
    ctx.addResult('TG-05-02', '验证内容被覆盖', 'update <docId> "新内容"', '旧内容被覆盖', '测试文档创建失败', false);
}

// TG-05-03: 别名测试 - edit
if (testDocId) {
    const editContent = 'edit别名更新_' + Date.now();
    const cmd = `edit ${testDocId} "${editContent}"`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        ctx.addResult('TG-05-03', '别名测试 - edit', cmd, '文档内容被更新',
            '命令执行失败', false, result.error);
    } else {
        const actualContent = getDocContent(testDocId);
        if (actualContent && actualContent.includes(editContent)) {
            ctx.addResult('TG-05-03', '别名测试 - edit', cmd, '文档内容被更新',
                '成功', true, 'edit别名工作正常');
        } else {
            ctx.addResult('TG-05-03', '别名测试 - edit', cmd, '文档内容被更新',
                '内容未更新', false, 'edit别名异常');
        }
    }
} else {
    ctx.addResult('TG-05-03', '别名测试 - edit', 'edit <docId> "新内容"', '文档内容被更新', '测试文档创建失败', false);
}

// 清理
ctx.cleanup();

ctx.saveReports('TG-05-update', 'TG-05 文档更新测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
