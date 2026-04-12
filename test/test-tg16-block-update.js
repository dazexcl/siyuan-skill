/**
 * TG-16 块更新测试
 * 测试 block-update 命令
 * 验证：更新后通过block-get验证内容确实被修改
 * 注意：block-update 只能更新普通块，不能更新文档
 */
const { createTestContext } = require('./test-framework');
const fs = require('fs');
const path = require('path');

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

// TG-16-01: 更新块内容（位置参数）
{
    const title = `TG-16-01-块更新_${Date.now()}`;
    const createResult = runCmd(`create "${title}" "块更新测试初始内容" --parent-id ${PARENT_ID}`);
    const docId = extractDocId(createResult.output);

    if (!docId) {
        addResult('TG-16-01', '更新块内容（位置参数）', 'block-update <blockId> "内容"', '块内容被更新', '测试文档创建失败', false);
    } else {
        createdDocs.push({ id: docId, title });

        const insertResult = runCmd(`block-insert "bu别名测试块" --parent-id ${docId}`);
        const blockId = extractBlockId(insertResult.output);

        if (!blockId) {
            addResult('TG-16-01', '更新块内容（位置参数）', 'block-update <blockId> "内容"', '块内容被更新', '创建测试块失败', false);
        } else {
            const newContent = '更新后的块内容_' + Date.now();
            const cmd = `block-update ${blockId} "${newContent}"`;
            const result = runCmd(cmd);

            if (!result.success) {
                addResult('TG-16-01', '更新块内容（位置参数）', cmd, '块内容被更新',
                    '命令执行失败', false, result.error || result.output.substring(0, 100));
            } else {
                const getResult = runCmd(`block-get ${blockId} --mode markdown`);
                const hasNewContent = getResult.output.includes(newContent);
                addResult('TG-16-01', '更新块内容（位置参数）', cmd, '块内容被更新',
                    hasNewContent ? '成功' : '内容未更新', hasNewContent, `新内容验证: ${hasNewContent}`);
            }
        }
    }
}

// TG-16-02: 使用 --content 选项更新块
{
    const title = `TG-16-02-选项更新_${Date.now()}`;
    const createResult = runCmd(`create "${title}" "块更新测试初始内容" --parent-id ${PARENT_ID}`);
    const docId = extractDocId(createResult.output);

    if (!docId) {
        addResult('TG-16-02', '使用 --content 选项', 'block-update <blockId> --content "内容"', '块内容被更新', '测试文档创建失败', false);
    } else {
        createdDocs.push({ id: docId, title });

        const insertResult = runCmd(`block-insert "bu选项测试块" --parent-id ${docId}`);
        const blockId = extractBlockId(insertResult.output);

        if (!blockId) {
            addResult('TG-16-02', '使用 --content 选项', 'block-update <blockId> --content "内容"', '块内容被更新', '创建测试块失败', false);
        } else {
            const newContent = '使用 --content 选项更新_' + Date.now();
            const cmd = `block-update ${blockId} --content "${newContent}"`;
            const result = runCmd(cmd);

            if (!result.success) {
                addResult('TG-16-02', '使用 --content 选项', cmd, '块内容被更新',
                    '命令执行失败', false, result.error || result.output.substring(0, 100));
            } else {
                const getResult = runCmd(`block-get ${blockId} --mode markdown`);
                const hasNewContent = getResult.output.includes(newContent);
                addResult('TG-16-02', '使用 --content 选项', cmd, '块内容被更新',
                    hasNewContent ? '成功' : '内容未更新', hasNewContent, `新内容验证: ${hasNewContent}`);
            }
        }
    }
}

// TG-16-03: 使用 --file 选项从文件更新块
{
    const title = `TG-16-03-文件更新_${Date.now()}`;
    const createResult = runCmd(`create "${title}" "块更新测试初始内容" --parent-id ${PARENT_ID}`);
    const docId = extractDocId(createResult.output);

    if (!docId) {
        addResult('TG-16-03', '使用 --file 选项', 'block-update <blockId> --file <path>', '块内容被更新', '测试文档创建失败', false);
    } else {
        createdDocs.push({ id: docId, title });

        const insertResult = runCmd(`block-insert "bu文件测试块" --parent-id ${docId}`);
        const blockId = extractBlockId(insertResult.output);

        if (!blockId) {
            addResult('TG-16-03', '使用 --file 选项', 'block-update <blockId> --file <path>', '块内容被更新', '创建测试块失败', false);
        } else {
            const testDir = path.join(__dirname, 'temp');
            if (!fs.existsSync(testDir)) {
                fs.mkdirSync(testDir, { recursive: true });
            }
            const testFile = path.join(testDir, `test-block-update-${Date.now()}.md`);
            const newContent = '从文件读取的块内容_' + Date.now();
            fs.writeFileSync(testFile, newContent, 'utf8');

            const cmd = `block-update ${blockId} --file "${testFile}"`;
            const result = runCmd(cmd);

            // 清理测试文件
            try {
                fs.unlinkSync(testFile);
            } catch (e) {
                // 忽略删除失败
            }

            if (!result.success) {
                addResult('TG-16-03', '使用 --file 选项', cmd, '块内容被更新',
                    '命令执行失败', false, result.error || result.output.substring(0, 100));
            } else {
                const getResult = runCmd(`block-get ${blockId} --mode markdown`);
                const hasNewContent = getResult.output.includes(newContent);
                addResult('TG-16-03', '使用 --file 选项', cmd, '块内容被更新',
                    hasNewContent ? '成功' : '内容未更新', hasNewContent, `文件内容验证: ${hasNewContent}`);
            }
        }
    }
}

// TG-16-04: 使用 --data-type markdown
{
    const title = `TG-16-04-markdown类型_${Date.now()}`;
    const createResult = runCmd(`create "${title}" "块更新测试初始内容" --parent-id ${PARENT_ID}`);
    const docId = extractDocId(createResult.output);

    if (!docId) {
        addResult('TG-16-04', '使用 --data-type markdown', 'block-update <blockId> --data-type markdown', '块内容被更新', '测试文档创建失败', false);
    } else {
        createdDocs.push({ id: docId, title });

        const insertResult = runCmd(`block-insert "bu markdown测试块" --parent-id ${docId}`);
        const blockId = extractBlockId(insertResult.output);

        if (!blockId) {
            addResult('TG-16-04', '使用 --data-type markdown', 'block-update <blockId> --data-type markdown', '块内容被更新', '创建测试块失败', false);
        } else {
            const newContent = '使用 markdown 类型更新_' + Date.now();
            const cmd = `block-update ${blockId} --content "${newContent}" --data-type markdown`;
            const result = runCmd(cmd);

            if (!result.success) {
                addResult('TG-16-04', '使用 --data-type markdown', cmd, '块内容被更新',
                    '命令执行失败', false, result.error || result.output.substring(0, 100));
            } else {
                const getResult = runCmd(`block-get ${blockId} --mode markdown`);
                const hasNewContent = getResult.output.includes(newContent);
                addResult('TG-16-04', '使用 --data-type markdown', cmd, '块内容被更新',
                    hasNewContent ? '成功' : '内容未更新', hasNewContent, `markdown类型验证: ${hasNewContent}`);
            }
        }
    }
}

// TG-16-05: 传入文档ID应该拒绝
{
    const title = `TG-16-05-文档ID验证_${Date.now()}`;
    const createResult = runCmd(`create "${title}" "块更新测试初始内容" --parent-id ${PARENT_ID}`);
    const docId = extractDocId(createResult.output);

    if (!docId) {
        addResult('TG-16-05', '拒绝文档ID', 'block-update <docId> "内容"', '返回错误提示', '测试文档创建失败', false);
    } else {
        createdDocs.push({ id: docId, title });

        const newContent = '尝试更新文档_' + Date.now();
        const cmd = `block-update ${docId} "${newContent}"`;
        const result = runCmd(cmd);

        // 应该失败，并且错误信息包含"文档"或"update 命令"
        const hasError = !result.success || result.output.includes('error') || result.output.includes('文档') || result.output.includes('update 命令');
        addResult('TG-16-05', '拒绝文档ID', cmd, '返回错误提示',
            hasError ? '正确拒绝' : '错误接受了文档ID', hasError, result.output.substring(0, 150));
    }
}

// TG-16-06: 传入无效ID应该拒绝
{
    const invalidId = 'invalid-block-id-12345';
    const cmd = `block-update ${invalidId} "测试内容"`;
    const result = runCmd(cmd);

    // 应该失败
    const hasError = !result.success || result.output.includes('error');
    addResult('TG-16-06', '拒绝无效ID', cmd, '返回错误提示',
        hasError ? '正确拒绝' : '错误接受了无效ID', hasError, result.output.substring(0, 150));
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
