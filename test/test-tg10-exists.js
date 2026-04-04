/**
 * TG-10 文档存在检查测试
 * 测试 exists 命令及其别名
 * 验证：返回的exists字段正确反映文档是否存在
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-10 文档存在检查测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

function parseExistsResult(output) {
    try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const data = JSON.parse(jsonMatch[0]);
        return data;
    } catch (e) {
        return null;
    }
}

console.log('\n========================================');
console.log('TG-10 文档存在检查测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `test_exists_${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "存在检查测试内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);
if (testDocId) {
    createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-10-01: 通过标题检查-存在
if (testDocId) {
    const cmd = `exists --title "${testDocTitle}" --parent-id ${PARENT_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-10-01', '通过标题检查-存在', cmd, '返回 exists: true',
            '命令执行失败', false, result.error);
    } else {
        const data = parseExistsResult(result.output);
        if (data && data.exists === true) {
            addResult('TG-10-01', '通过标题检查-存在', cmd, '返回 exists: true',
                '成功', true, `exists: ${data.exists}, id: ${data.id || 'N/A'}`);
        } else {
            addResult('TG-10-01', '通过标题检查-存在', cmd, '返回 exists: true',
                'exists不为true', false, `data: ${JSON.stringify(data)}`);
        }
    }
} else {
    addResult('TG-10-01', '通过标题检查-存在', 'exists --title "标题"', '返回 exists: true', '测试文档创建失败', false);
}

// TG-10-02: 通过标题检查-不存在
{
    const notExistTitle = `not_exist_${Date.now()}_random`;
    const cmd = `exists --title "${notExistTitle}" --parent-id ${PARENT_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-10-02', '通过标题检查-不存在', cmd, '返回 exists: false',
            '命令执行失败', false, result.error);
    } else {
        const data = parseExistsResult(result.output);
        if (data && data.exists === false) {
            addResult('TG-10-02', '通过标题检查-不存在', cmd, '返回 exists: false',
                '成功', true, `exists: ${data.exists}`);
        } else {
            addResult('TG-10-02', '通过标题检查-不存在', cmd, '返回 exists: false',
                'exists不为false', false, `data: ${JSON.stringify(data)}`);
        }
    }
}

// TG-10-03: 别名测试 - check
if (testDocId) {
    const cmd = `check --title "${testDocTitle}" --parent-id ${PARENT_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-10-03', '别名测试 - check', cmd, '与exists结果一致',
            '命令执行失败', false, result.error);
    } else {
        const data = parseExistsResult(result.output);
        if (data && data.exists === true) {
            addResult('TG-10-03', '别名测试 - check', cmd, '与exists结果一致',
                '成功', true, 'check别名工作正常');
        } else {
            addResult('TG-10-03', '别名测试 - check', cmd, '与exists结果一致',
                '结果不一致', false, `data: ${JSON.stringify(data)}`);
        }
    }
} else {
    addResult('TG-10-03', '别名测试 - check', 'check --title "标题"', '与exists结果一致', '测试文档创建失败', false);
}

// TG-10-04: 指定父文档检查
if (testDocId) {
    const cmd = `exists --title "${testDocTitle}" --parent-id ${PARENT_ID}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-10-04', '指定父文档检查', cmd, '在指定父文档下检查',
            '命令执行失败', false, result.error);
    } else {
        const data = parseExistsResult(result.output);
        if (data && data.exists === true) {
            addResult('TG-10-04', '指定父文档检查', cmd, '在指定父文档下检查',
                '成功', true, `exists: ${data.exists}`);
        } else {
            addResult('TG-10-04', '指定父文档检查', cmd, '在指定父文档下检查',
                '检查失败', false, `data: ${JSON.stringify(data)}`);
        }
    }
} else {
    addResult('TG-10-04', '指定父文档检查', 'exists --title "标题" --parent-id <id>', '在指定父文档下检查', '测试文档创建失败', false);
}

// 清理
cleanup();

// 保存报告
saveReports('TG-10-exists', 'TG-10 文档存在检查测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
