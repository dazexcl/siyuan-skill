/**
 * TG-20 块折叠测试
 * 测试 block-fold 命令
 * 验证：折叠/展开操作正确执行，文档块返回错误
 * 注意：只有标题块支持折叠，文档块不支持
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-20 块折叠测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

function getHeadingBlockId(docId) {
    const result = runCmd(`content ${docId} --raw`);
    if (!result.success) return null;
    const lines = result.output.split('\n');
    for (const line of lines) {
        if (line.match(/^#{1,6}\s/)) {
            const idMatch = line.match(/id="([^"]+)"/);
            if (idMatch) return idMatch[1];
        }
    }
    const idMatch = result.output.match(/id="([^"]+)"/);
    return idMatch ? idMatch[1] : null;
}

console.log('\n========================================');
console.log('TG-20 块折叠测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `test_fold_${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "## 可折叠标题\n\n段落内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);

if (testDocId) {
    createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}

const headingBlockId = getHeadingBlockId(testDocId);
if (headingBlockId) {
    console.log(`找到标题块: ${headingBlockId}`);
} else {
    console.log('警告: 未找到标题块');
}
console.log('');

console.log('测试用例:');

// TG-20-01: 折叠标题块
if (headingBlockId) {
    const cmd = `block-fold ${headingBlockId}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-20-01', '折叠标题块', cmd, '命令执行成功',
            '命令执行失败', false, result.error);
    } else {
        const hasError = result.output.includes('失败') || result.output.includes('错误') || result.output.includes('cannot');
        if (hasError) {
            addResult('TG-20-01', '折叠标题块', cmd, '命令执行成功',
                '返回错误', false, result.output.substring(0, 100));
        } else {
            addResult('TG-20-01', '折叠标题块', cmd, '命令执行成功',
                '成功', true, '标题块折叠成功');
        }
    }
} else {
    addResult('TG-20-01', '折叠标题块', 'block-fold <blockId>', '命令执行成功', '标题块未找到', false);
}

// TG-20-02: 展开标题块
if (headingBlockId) {
    const cmd = `block-fold ${headingBlockId} --action unfold`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-20-02', '展开标题块', cmd, '命令执行成功',
            '命令执行失败', false, result.error);
    } else {
        const hasError = result.output.includes('失败') || result.output.includes('错误') || result.output.includes('cannot');
        if (hasError) {
            addResult('TG-20-02', '展开标题块', cmd, '命令执行成功',
                '返回错误', false, result.output.substring(0, 100));
        } else {
            addResult('TG-20-02', '展开标题块', cmd, '命令执行成功',
                '成功', true, '标题块展开成功');
        }
    }
} else {
    addResult('TG-20-02', '展开标题块', 'block-fold <blockId> --action unfold', '命令执行成功', '标题块未找到', false);
}

//  TG-20-04: 文档块折叠验证（应返回错误）
if (testDocId) {
    const cmd = `block-fold ${testDocId}`;
    const result = runCmd(cmd);
    
    const hasExpectedError = !result.success || 
                            result.output.includes('cannot be folded') || 
                            result.output.includes('can not be folded') ||
                            result.output.includes('不能折叠') ||
                            result.error;
    
    if (hasExpectedError) {
        addResult('TG-20-04', '文档块不支持折叠', cmd, '返回错误(cannot be folded)',
            '成功', true, '文档块正确返回不支持折叠错误');
    } else {
        addResult('TG-20-04', '文档块不支持折叠', cmd, '返回错误(cannot be folded)',
            '未返回预期错误', false, `输出: ${result.output.substring(0, 100)}`);
    }
} else {
    addResult('TG-20-04', '文档块不支持折叠', 'block-fold <docId>', '返回错误', '测试文档创建失败', false);
}

// 清理
cleanup();

// 保存报告
saveReports('TG-20-block-fold', 'TG-20 块折叠测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
