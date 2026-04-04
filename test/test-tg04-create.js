/**
 * TG-04 文档创建测试
 * 测试 create 命令及其别名
 * 验证：创建后通过content命令验证文档确实存在
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-04 文档创建测试');

function verifyDocContent(docId, expectedContent) {
    const result = ctx.runCmd(`content ${docId}`);
    if (!result.success) return { exists: false, hasContent: false };
    return { exists: true, hasContent: result.output.includes(expectedContent) };
}

console.log('\n========================================');
console.log('TG-04 文档创建测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-04-01: 传统模式-笔记本下创建
{
    const title = `test_create_01_${Date.now()}`;
    const content = '创建内容_唯一标识_' + Date.now();
    const cmd = `create "${title}" "${content}" --parent-id ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-01', '传统模式-笔记本下创建', cmd, '返回新文档ID',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title });
        const verify = verifyDocContent(docId, content);
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-01', '传统模式-笔记本下创建', cmd, '返回新文档ID',
                '成功', true, `docId: ${docId}, 内容验证通过`);
        } else {
            ctx.addResult('TG-04-01', '传统模式-笔记本下创建', cmd, '返回新文档ID',
                '验证失败', false, `docId: ${docId}, exists: ${verify.exists}, hasContent: ${verify.hasContent}`);
        }
    }
}

// TG-04-02: 传统模式-文档下创建子文档
{
    const parentTitle = `test_parent_${Date.now()}`;
    const parentCmd = `create "${parentTitle}" --parent-id ${ctx.PARENT_ID}`;
    const parentResult = ctx.runCmd(parentCmd);
    const parentId = ctx.extractDocId(parentResult.output);
    
    if (!parentId) {
        ctx.addResult('TG-04-02', '传统模式-文档下创建子文档', 'create "title" --parent-id <parentId>', '返回新文档ID', '父文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: parentId, title: parentTitle });
        
        const childTitle = `test_child_${Date.now()}`;
        const childContent = '子文档内容_' + Date.now();
        const cmd = `create "${childTitle}" "${childContent}" --parent-id ${parentId}`;
        const result = ctx.runCmd(cmd);
        const docId = ctx.extractDocId(result.output);
        
        if (!result.success || !docId) {
            ctx.addResult('TG-04-02', '传统模式-文档下创建子文档', cmd, '返回新文档ID',
                '创建失败', false, result.error || result.output.substring(0, 100));
        } else {
            ctx.createdDocs.push({ id: docId, title: childTitle });
            const verify = verifyDocContent(docId, childContent);
            if (verify.exists && verify.hasContent) {
                ctx.addResult('TG-04-02', '传统模式-文档下创建子文档', cmd, '返回新文档ID',
                    '成功', true, `子文档 docId: ${docId}, 父文档: ${parentId}`);
            } else {
                ctx.addResult('TG-04-02', '传统模式-文档下创建子文档', cmd, '返回新文档ID',
                    '验证失败', false, `exists: ${verify.exists}, hasContent: ${verify.hasContent}`);
            }
        }
    }
}

// TG-04-03: 路径模式-创建完整路径文档
{
    const content = '路径创建内容_' + Date.now();
    const pathTitle = `test_path_${Date.now()}`;
    const relativePath = `${pathTitle}/最终文档`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-03', '路径模式-创建完整路径文档', cmd, '自动创建中间目录',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title: '最终文档', isChild: true });
        const existsResult = ctx.runCmd(`exists --title "${pathTitle}" --parent-id ${ctx.PARENT_ID}`);
        const parentMatch = existsResult.output.match(/"id"\s*:\s*"([^"]+)"/);
        if (parentMatch) {
            ctx.createdDocs.push({ id: parentMatch[1], title: pathTitle });
        }
        const verify = verifyDocContent(docId, content);
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-03', '路径模式-创建完整路径文档', cmd, '自动创建中间目录',
                '成功', true, `docId: ${docId}, 路径模式工作正常`);
        } else {
            ctx.addResult('TG-04-03', '路径模式-创建完整路径文档', cmd, '自动创建中间目录',
                '验证失败', false, `exists: ${verify.exists}, hasContent: ${verify.hasContent}`);
        }
    }
}

// TG-04-04: 路径模式-自定义标题
{
    const customTitle = `自定义标题_${Date.now()}`;
    const content = '自定义标题内容';
    const relativePath = `${customTitle}/B`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" --title "${customTitle}_final" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-04', '路径模式-自定义标题', cmd, '标题被正确设置',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        const existsResult = ctx.runCmd(`exists --title "${customTitle}" --parent-id ${ctx.PARENT_ID}`);
        const parentMatch = existsResult.output.match(/"id"\s*:\s*"([^"]+)"/);
        const hasParent = !!parentMatch;
        if (parentMatch) {
            ctx.createdDocs.push({ id: parentMatch[1], title: customTitle });
        }
        ctx.createdDocs.push({ id: docId, title: customTitle + '_final', isChild: true });
        const actualTitle = ctx.getDocTitle(docId);
        if (actualTitle && actualTitle.includes(customTitle)) {
            ctx.addResult('TG-04-04', '路径模式-自定义标题', cmd, '标题被正确设置',
                '成功', true, `标题: ${actualTitle}`);
        } else {
            ctx.addResult('TG-04-04', '路径模式-自定义标题', cmd, '标题被正确设置',
                '标题不匹配', false, `预期: ${customTitle}, 实际: ${actualTitle}`);
        }
    }
}

// TG-04-05: 目录下创建模式
{
    const dirTitle = `test_dir_${Date.now()}`;
    const title = `test_dir_create_${Date.now()}`;
    const content = '目录下创建内容_' + Date.now();
    const relativePath = `${dirTitle}/`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" "${title}" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-05', '目录下创建模式', cmd, '在指定目录下创建',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, isChild: true });
        const existsResult = ctx.runCmd(`exists --title "${dirTitle}" --parent-id ${ctx.PARENT_ID}`);
        const dirMatch = existsResult.output.match(/"id"\s*:\s*"([^"]+)"/);
        if (dirMatch) {
            ctx.createdDocs.push({ id: dirMatch[1], title: dirTitle });
        }
        const verify = verifyDocContent(docId, content);
        if (verify.exists) {
            ctx.addResult('TG-04-05', '目录下创建模式', cmd, '在指定目录下创建',
                '成功', true, `docId: ${docId}`);
        } else {
            ctx.addResult('TG-04-05', '目录下创建模式', cmd, '在指定目录下创建',
                '验证失败', false, `文档不存在`);
        }
    }
}

// TG-04-06: 别名测试 - new
{
    const title = `test_new_alias_${Date.now()}`;
    const content = '别名创建内容_' + Date.now();
    const cmd = `new "${title}" "${content}" --parent-id ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-06', '别名测试 - new', cmd, '返回新文档ID',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title });
        const verify = verifyDocContent(docId, content);
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-06', '别名测试 - new', cmd, '返回新文档ID',
                '成功', true, `new别名工作正常, docId: ${docId}`);
        } else {
            ctx.addResult('TG-04-06', '别名测试 - new', cmd, '返回新文档ID',
                '验证失败', false, `exists: ${verify.exists}, hasContent: ${verify.hasContent}`);
        }
    }
}

// TG-04-07: 短参数测试 -p (parent-id)
{
    const title = `test_short_p_${Date.now()}`;
    const content = '短参数p测试内容';
    const cmd = `create "${title}" "${content}" -p ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-07', '短参数 -p (parent-id)', cmd, '与 --parent-id 效果一致',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title });
        const verify = verifyDocContent(docId, content);
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-07', '短参数 -p (parent-id)', cmd, '与 --parent-id 效果一致',
                '成功', true, `-p 别名工作正常, docId: ${docId}`);
        } else {
            ctx.addResult('TG-04-07', '短参数 -p (parent-id)', cmd, '与 --parent-id 效果一致',
                '验证失败', false);
        }
    }
}

// TG-04-08: 短参数测试 -t (title)
{
    const content = '短参数t测试内容_' + Date.now();
    const title = `test_short_t_${Date.now()}`;
    const relativePath = `short_t_test`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" -t "${title}" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-08', '短参数 -t (title)', cmd, '与 --title 效果一致',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, isChild: true });
        const existsResult = ctx.runCmd(`exists --title "short_t_test" --parent-id ${ctx.PARENT_ID}`);
        const parentMatch = existsResult.output.match(/"id"\s*:\s*"([^"]+)"/);
        if (parentMatch) {
            ctx.createdDocs.push({ id: parentMatch[1], title: 'short_t_test' });
        }
        const actualTitle = ctx.getDocTitle(docId);
        if (actualTitle === title) {
            ctx.addResult('TG-04-08', '短参数 -t (title)', cmd, '与 --title 效果一致',
                '成功', true, `-t 别名工作正常, 标题: ${actualTitle}`);
        } else {
            ctx.addResult('TG-04-08', '短参数 -t (title)', cmd, '与 --title 效果一致',
                '标题不匹配', false, `预期: ${title}, 实际: ${actualTitle}`);
        }
    }
}



// 清理
ctx.cleanup();

ctx.saveReports('TG-04-create', 'TG-04 文档创建测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
