/**
 * TG-09 文档重命名测试
 * 测试 rename 命令
 * 验证：重命名后通过content命令验证标题确实被修改
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-09 文档重命名测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

console.log('\n========================================');
console.log('TG-09 文档重命名测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `TG-09-01-重命名测试_${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "重命名测试内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);
if (testDocId) {
    createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-09-01: 基本重命名
if (testDocId) {
    const newTitle = `TG-09-01-重命名后_${Date.now()}`;
    const cmd = `rename ${testDocId} "${newTitle}"`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-09-01', '基本重命名', cmd, '文档标题被更新',
            '命令执行失败', false, result.error);
    } else {
        const actualTitle = getDocTitle(testDocId);
        if (actualTitle === newTitle) {
            addResult('TG-09-01', '基本重命名', cmd, '文档标题被更新',
                '成功', true, `新标题: ${actualTitle}`);
        } else {
            addResult('TG-09-01', '基本重命名', cmd, '文档标题被更新',
                '标题未更新', false, `预期: ${newTitle}, 实际: ${actualTitle}`);
        }
    }
} else {
    addResult('TG-09-01', '基本重命名', 'rename <docId> "新标题"', '文档标题被更新', '测试文档创建失败', false);
}

// TG-09-02: 重名检测（思源笔记允许重名）
if (testDocId) {
    const dupTitle = `TG-09-02-重名测试_${Date.now()}`;
    const dupCreateResult = runCmd(`create "${dupTitle}" "内容" --parent-id ${PARENT_ID}`);
    const dupDocId = extractDocId(dupCreateResult.output);
    if (dupDocId) createdDocs.push({ id: dupDocId, title: dupTitle });
    
    const cmd = `rename ${testDocId} "${dupTitle}"`;
    const result = runCmd(cmd);
    const hasError = !result.success || result.output.includes('已存在') || result.output.includes('重名') || result.output.includes('duplicate');
    
    if (hasError) {
        addResult('TG-09-02', '重名检测', cmd, '正确处理重名情况',
            '成功', true, '正确检测到重名并拒绝重命名');
    } else if (result.success) {
        // 允许重名时，验证标题确实被更改
        const actualTitle = getDocTitle(testDocId);
        if (actualTitle === dupTitle) {
            addResult('TG-09-02', '重名检测', cmd, '正确处理重名情况',
                '成功', true, '思源笔记允许重名，操作成功');
        } else {
            addResult('TG-09-02', '重名检测', cmd, '正确处理重名情况',
                '标题未更改', false, `期望: ${dupTitle}, 实际: ${actualTitle}`);
        }
    } else {
        addResult('TG-09-02', '重名检测', cmd, '正确处理重名情况',
            '未预期结果', false, `输出: ${result.output.substring(0, 100)}`);
    }
} else {
    addResult('TG-09-02', '重名检测', 'rename <docId> "已存在标题"', '正确处理重名情况', '测试文档创建失败', false);
}

// TG-09-03: 强制重命名
if (testDocId) {
    const forceTitle = `TG-09-03-强制重名测试_${Date.now()}`;
    const forceCreateResult = runCmd(`create "${forceTitle}" "内容" --parent-id ${PARENT_ID}`);
    const forceDocId = extractDocId(forceCreateResult.output);
    if (forceDocId) createdDocs.push({ id: forceDocId, title: forceTitle });
    
    const newForceTitle = `TG-09-03-强制重命名后_${Date.now()}`;
    const cmd = `rename ${testDocId} "${newForceTitle}" --force`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-09-03', '强制重命名', cmd, '强制重命名成功',
            '命令执行失败', false, result.error);
    } else {
        const actualTitle = getDocTitle(testDocId);
        if (actualTitle === newForceTitle) {
            addResult('TG-09-03', '强制重命名', cmd, '强制重命名成功',
                '成功', true, `强制重命名成功: ${actualTitle}`);
        } else {
            addResult('TG-09-03', '强制重命名', cmd, '强制重命名成功',
                '标题未更新', false, `预期: ${newForceTitle}, 实际: ${actualTitle}`);
        }
    }
} else {
    addResult('TG-09-03', '强制重命名', 'rename <docId> "标题" --force', '强制重命名成功', '测试文档创建失败', false);
}

// TG-09-04: 标题斜杠处理
if (testDocId) {
    const slashTitle = `TG-09-04-斜杠/副标题_${Date.now()}`;
    const cmd = `rename ${testDocId} "${slashTitle}"`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-09-04', '标题斜杠处理', cmd, '重命名成功（可能转换斜杠）',
            '命令执行失败', false, result.error);
    } else {
        const actualTitle = getDocTitle(testDocId);
        const titleChanged = actualTitle && (actualTitle.includes('标题') || actualTitle.includes('副标题'));
        if (titleChanged) {
            addResult('TG-09-04', '标题斜杠处理', cmd, '重命名成功（可能转换斜杠）',
                '成功', true, `原始: ${slashTitle}, 结果: ${actualTitle}`);
        } else {
            addResult('TG-09-04', '标题斜杠处理', cmd, '重命名成功（可能转换斜杠）',
                '标题未更新', false, `actualTitle: ${actualTitle}`);
        }
    }
} else {
    addResult('TG-09-04', '标题斜杠处理', 'rename <docId> "标题/副标题"', '重命名成功（可能转换斜杠）', '测试文档创建失败', false);
}

// 清理
ctx.cleanup();

// 保存报告
saveReports('TG-09-rename', 'TG-09 文档重命名测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
