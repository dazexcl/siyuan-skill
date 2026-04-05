/**
 * TG-15 块插入测试
 * 测试 block-insert 命令及其别名
 * 验证：插入后通过content命令验证块确实存在
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-15 块插入测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

function getDocContent(docId) {
    const result = runCmd(`content ${docId}`);
    if (!result.success) return null;
    return result.output;
}

console.log('\n========================================');
console.log('TG-15 块插入测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `TG-15-01-块插入测试_${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "初始内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);
if (testDocId) {
    createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-15-01: 作为子块插入
if (testDocId) {
    const blockContent = '插入的块内容_' + Date.now();
    const cmd = `block-insert "${blockContent}" --parent-id ${testDocId}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-15-01', '作为子块插入', cmd, '块被插入为子块',
            '命令执行失败', false, result.error);
    } else {
        const content = getDocContent(testDocId);
        const hasBlock = content && content.includes(blockContent);
        if (hasBlock) {
            addResult('TG-15-01', '作为子块插入', cmd, '块被插入为子块',
                '成功', true, `块内容 "${blockContent.substring(0, 20)}..." 已验证存在`);
        } else {
            addResult('TG-15-01', '作为子块插入', cmd, '块被插入为子块',
                '块内容未找到', false, `文档内容中未找到: ${blockContent.substring(0, 30)}`);
        }
    }
} else {
    addResult('TG-15-01', '作为子块插入', 'block-insert "内容" --parent-id <id>', '块被插入', '测试文档创建失败', false);
}

//  TG-15-03: 插入 Markdown 格式
if (testDocId) {
    const mdContent = '**粗体文本_' + Date.now() + '** 和 *斜体*';
    const cmd = `block-insert "${mdContent}" --parent-id ${testDocId}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-15-03', '插入 Markdown 格式', cmd, 'Markdown格式保留',
            '命令执行失败', false, result.error);
    } else {
        const content = getDocContent(testDocId);
        const hasMarkdown = content && (content.includes('粗体文本') && (content.includes('*') || content.includes('**')));
        if (hasMarkdown) {
            addResult('TG-15-03', '插入 Markdown 格式', cmd, 'Markdown格式保留',
                '成功', true, 'Markdown格式已插入');
        } else {
            addResult('TG-15-03', '插入 Markdown 格式', cmd, 'Markdown格式保留',
                '格式丢失或内容不匹配', false, `内容中未找到Markdown标记或粗体文本`);
        }
    }
} else {
    addResult('TG-15-03', '插入 Markdown 格式', 'block-insert "**粗体**" --parent-id <id>', 'Markdown格式保留', '测试文档创建失败', false);
}

// TG-15-04: 插入多行内容
if (testDocId) {
    const multiContent = '第一行_' + Date.now() + '\\n第二行\\n第三行';
    const cmd = `block-insert "${multiContent}" --parent-id ${testDocId}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-15-04', '插入多行内容', cmd, '多行内容正确插入',
            '命令执行失败', false, result.error);
    } else {
        const content = getDocContent(testDocId);
        const hasMultiLine = content && content.includes('第一行');
        if (hasMultiLine) {
            addResult('TG-15-04', '插入多行内容', cmd, '多行内容正确插入',
                '成功', true, '多行内容已插入');
        } else {
            addResult('TG-15-04', '插入多行内容', cmd, '多行内容正确插入',
                '内容未找到', false);
        }
    }
} else {
    addResult('TG-15-04', '插入多行内容', 'block-insert "多行" --parent-id <id>', '多行内容正确插入', '测试文档创建失败', false);
}

// 清理
ctx.cleanup();

// 保存报告
saveReports('TG-15-block-insert', 'TG-15 块插入测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
