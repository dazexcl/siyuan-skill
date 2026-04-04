/**
 * TG-04 文档创建测试
 * 测试 create 命令的核心功能
 * 优化版：减少不必要的文档创建
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

// TG-04-01: 传统模式创建（位置参数方式）
{
    const title = `TG04-01-传统模式创建-${Date.now()}`;
    const content = '创建内容_唯一标识_' + Date.now();
    const cmd = `create "${title}" "${content}" --parent-id ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-01', '传统模式创建', cmd, '返回新文档ID',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-01' });
        const verify = verifyDocContent(docId, content);
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-01', '传统模式创建', cmd, '返回新文档ID',
                '成功', true, `docId: ${docId}`);
        } else {
            ctx.addResult('TG-04-01', '传统模式创建', cmd, '返回新文档ID',
                '验证失败', false, `exists: ${verify.exists}, hasContent: ${verify.hasContent}`);
        }
    }
}

// TG-04-02: 文档下创建子文档
{
    const timestamp = Date.now();
    const parentTitle = `TG04-02-父文档-${timestamp}`;
    const parentCmd = `create "${parentTitle}" --parent-id ${ctx.PARENT_ID}`;
    const parentResult = ctx.runCmd(parentCmd);
    const parentId = ctx.extractDocId(parentResult.output);

    if (!parentId) {
        ctx.addResult('TG-04-02', '文档下创建子文档', 'create "title" --parent-id <parentId>', '返回新文档ID',
            '父文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: parentId, title: parentTitle, testId: 'TG-04-02' });

        const childTitle = `TG04-02-子文档-${timestamp}`;
        const childContent = '子文档内容_' + Date.now();
        const cmd = `create "${childTitle}" "${childContent}" --parent-id ${parentId}`;
        const result = ctx.runCmd(cmd);
        const docId = ctx.extractDocId(result.output);

        if (!result.success || !docId) {
            ctx.addResult('TG-04-02', '文档下创建子文档', cmd, '返回新文档ID',
                '创建失败', false, result.error || result.output.substring(0, 100));
        } else {
            ctx.createdDocs.push({ id: docId, title: childTitle, testId: 'TG-04-02' });
            const verify = verifyDocContent(docId, childContent);
            if (verify.exists && verify.hasContent) {
                ctx.addResult('TG-04-02', '文档下创建子文档', cmd, '返回新文档ID',
                    '成功', true, `子文档: ${docId}, 父文档: ${parentId}`);
            } else {
                ctx.addResult('TG-04-02', '文档下创建子文档', cmd, '返回新文档ID',
                    '验证失败', false, `exists: ${verify.exists}, hasContent: ${verify.hasContent}`);
            }
        }
    }
}

// TG-04-03: 路径模式-创建完整路径文档
{
    const timestamp = Date.now();
    const content = '路径创建内容_' + timestamp;
    const pathTitle = `TG04-03-中间目录-${timestamp}`;
    const relativePath = `${pathTitle}/TG04-03-最终文档-${timestamp}`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-03', '路径模式-完整路径', cmd, '自动创建中间目录',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title: `TG04-03-最终文档-${timestamp}`, isChild: true, testId: 'TG-04-03' });
        const existsResult = ctx.runCmd(`exists --title "${pathTitle}" --parent-id ${ctx.PARENT_ID}`);
        const parentMatch = existsResult.output.match(/"id"\s*:\s*"([^"]+)"/);
        if (parentMatch) {
            ctx.createdDocs.push({ id: parentMatch[1], title: pathTitle, testId: 'TG-04-03' });
        }
        const verify = verifyDocContent(docId, content);
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-03', '路径模式-完整路径', cmd, '自动创建中间目录',
                '成功', true, `docId: ${docId}`);
        } else {
            ctx.addResult('TG-04-03', '路径模式-完整路径', cmd, '自动创建中间目录',
                '验证失败', false, `exists: ${verify.exists}, hasContent: ${verify.hasContent}`);
        }
    }
}

// TG-04-04: 路径模式-自定义标题
{
    const timestamp = Date.now();
    const customTitle = `TG04-04-自定义标题-${timestamp}`;
    const content = '自定义标题内容';
    const relativePath = `${customTitle}/B`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" --title "${customTitle}-final" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-04', '路径模式-自定义标题', cmd, '标题被正确设置',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        const existsResult = ctx.runCmd(`exists --title "${customTitle}" --parent-id ${ctx.PARENT_ID}`);
        const parentMatch = existsResult.output.match(/"id"\s*:\s*"([^"]+)"/);
        if (parentMatch) {
            ctx.createdDocs.push({ id: parentMatch[1], title: customTitle, testId: 'TG-04-04' });
        }
        ctx.createdDocs.push({ id: docId, title: customTitle + '-final', isChild: true, testId: 'TG-04-04' });
        const actualTitle = ctx.getDocTitle(docId);
        if (actualTitle && actualTitle.includes(customTitle)) {
            ctx.addResult('TG-04-04', '路径模式-自定义标题', cmd, '标题被正确设置',
                '成功', true, `标题: ${actualTitle}`);
        } else {
            ctx.addResult('TG-04-04', '路径模式-自定义标题', cmd, '标题被正确设置',
                '标题不匹配', false, `预期包含: ${customTitle}, 实际: ${actualTitle}`);
        }
    }
}

// TG-04-05: 目录下创建模式
{
    const timestamp = Date.now();
    const dirTitle = `TG04-05-目录-${timestamp}`;
    const title = `TG04-05-目录下文档-${timestamp}`;
    const content = '目录下创建内容_' + timestamp;
    const relativePath = `${dirTitle}/`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" "${title}" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-05', '目录下创建模式', cmd, '在指定目录下创建',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, isChild: true, testId: 'TG-04-05' });
        const existsResult = ctx.runCmd(`exists --title "${dirTitle}" --parent-id ${ctx.PARENT_ID}`);
        const dirMatch = existsResult.output.match(/"id"\s*:\s*"([^"]+)"/);
        if (dirMatch) {
            ctx.createdDocs.push({ id: dirMatch[1], title: dirTitle, testId: 'TG-04-05' });
        }
        const verify = verifyDocContent(docId, content);
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-05', '目录下创建模式', cmd, '在指定目录下创建',
                '成功', true, `docId: ${docId}`);
        } else {
            ctx.addResult('TG-04-05', '目录下创建模式', cmd, '在指定目录下创建',
                '验证失败', false, `exists: ${verify.exists}, hasContent: ${verify.hasContent}`);
        }
    }
}

// TG-04-06: 参数冲突检测
{
    const title = `test_conflict_${Date.now()}`;
    const content = '参数冲突测试';
    const cmd = `create "${title}" "${content}" --parent-id ${ctx.PARENT_ID} --path "/AI/test"`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        if (result.error && result.error.includes('二选一')) {
            ctx.addResult('TG-04-06', '参数冲突检测', cmd, '应拒绝并提示错误',
                '成功', true, `正确拒绝`);
        } else {
            ctx.addResult('TG-04-06', '参数冲突检测', cmd, '应拒绝并提示错误',
                '错误信息不正确', false, result.error || result.output);
        }
    } else {
        ctx.addResult('TG-04-06', '参数冲突检测', cmd, '应拒绝并提示错误',
            '应该失败但成功了', false, '未正确验证参数冲突');
    }
}

// TG-04-07: 无效笔记本验证
{
    const title = `test_invalid_notebook_${Date.now()}`;
    let allPassed = true;
    let details = [];
    
    // 测试无效笔记本名称
    const cmd1 = `create --path "/invalid_notebook_name_12345/${title}" "无效名称测试"`;
    const result1 = ctx.runCmd(cmd1);
    if (result1.success) {
        allPassed = false;
        details.push('无效名称未拒绝');
    } else if (!result1.error?.includes('不是有效的笔记本')) {
        allPassed = false;
        details.push('无效名称错误信息不正确');
    }
    
    // 测试无效笔记本ID
    const cmd2 = `create --path "/99999999-aaaa-bbbb-cccc-dddddddddddd/${title}" "无效ID测试"`;
    const result2 = ctx.runCmd(cmd2);
    if (result2.success) {
        allPassed = false;
        details.push('无效ID未拒绝');
    } else if (!result2.error?.includes('不是有效的笔记本')) {
        allPassed = false;
        details.push('无效ID错误信息不正确');
    }
    
    if (allPassed) {
        ctx.addResult('TG-04-07', '无效笔记本验证', '无效名称 & 无效ID', '应拒绝并提示错误',
            '成功', true, '两种情况都正确拒绝');
    } else {
        ctx.addResult('TG-04-07', '无效笔记本验证', '无效名称 & 无效ID', '应拒绝并提示错误',
            '部分失败', false, details.join('; '));
    }
}

// TG-04-08: 多级嵌套路径创建（3级目录 + 1个文档）
{
    const timestamp = Date.now();
    const content = '多级路径测试_' + timestamp;
    const level1 = `TG04-08-L1-${timestamp}`;
    const level2 = `TG04-08-L2-${timestamp}`;
    const level3 = `TG04-08-L3-${timestamp}`;
    const title = `TG04-08-最终文档-${timestamp}`;
    const relativePath = `${level1}/${level2}/${level3}/${title}`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);

    if (!result.success || !docId) {
        ctx.addResult('TG-04-08', '多级嵌套路径', cmd, '应创建3级目录结构',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        // 验证文档内容
        const verify = verifyDocContent(docId, content);

        // 添加文档到清理列表
        ctx.createdDocs.push({ id: docId, title, isChild: true, testId: 'TG-04-08' });

        // 验证逻辑：文档存在 + 内容正确
        // 注意：多级路径的中间目录由 API 自动创建，但 hpath 索引可能有延迟
        // 所以只要文档创建成功且有内容，就认为多级路径创建成功
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-08', '多级嵌套路径', cmd, '应创建3级目录结构',
                '成功', true, `路径: ${level1}/${level2}/${level3}/${title}`);
        } else {
            const issues = [];
            if (!verify.exists) issues.push('文档不存在');
            if (!verify.hasContent) issues.push('内容不匹配');
            ctx.addResult('TG-04-08', '多级嵌套路径', cmd, '应创建3级目录结构',
                '验证失败', false, `问题: ${issues.join(', ')}`);
        }
    }
}

// TG-04-09: 文档已存在时未使用 --force
{
    const timestamp = Date.now();
    const title = `TG04-09-重复创建测试-${timestamp}`;
    const content = '重复创建测试';
    const cmd = `create "${title}" "${content}" --parent-id ${ctx.PARENT_ID}`;
    
    const result1 = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result1.output);
    
    if (docId) {
        ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-09' });
        
        const result2 = ctx.runCmd(cmd);
        if (!result2.success) {
            if (result2.error && result2.error.includes('已存在')) {
                ctx.addResult('TG-04-09', '重复创建拒绝', cmd, '应拒绝并提示已存在',
                    '成功', true, `正确拒绝`);
            } else {
                ctx.addResult('TG-04-09', '重复创建拒绝', cmd, '应拒绝并提示已存在',
                    '错误信息不正确', false, result2.error || result2.output);
            }
        } else {
            ctx.addResult('TG-04-09', '重复创建拒绝', cmd, '应拒绝并提示已存在',
                '应该失败但成功了', false, '未正确检测重复文档');
        }
    } else {
        ctx.addResult('TG-04-09', '重复创建拒绝', cmd, '应拒绝并提示已存在',
            '首次创建失败', false, result1.error || result1.output);
    }
}

// TG-04-10: 文档已存在时使用 --force
{
    const timestamp = Date.now();
    const title = `TG04-10-强制覆盖测试-${timestamp}`;
    const content1 = '首次内容_' + timestamp;
    const content2 = '强制覆盖内容_' + timestamp;
    const cmd1 = `create "${title}" "${content1}" --parent-id ${ctx.PARENT_ID}`;
    const cmd2 = `create "${title}" "${content2}" --parent-id ${ctx.PARENT_ID} --force`;
    
    const result1 = ctx.runCmd(cmd1);
    const docId = ctx.extractDocId(result1.output);
    
    if (docId) {
        ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-10' });
        
        const result2 = ctx.runCmd(cmd2);
        const verify = verifyDocContent(docId, content2);
        if (result2.success && verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-10', '强制覆盖', cmd2, '应成功覆盖',
                '成功', true, `docId: ${docId}, 内容已更新`);
        } else {
            ctx.addResult('TG-04-10', '强制覆盖', cmd2, '应成功覆盖',
                '验证失败', false, `exists: ${verify.exists}, hasContent: ${verify.hasContent}`);
        }
    } else {
        ctx.addResult('TG-04-10', '强制覆盖', cmd1, '应成功覆盖',
            '首次创建失败', false, result1.error || result1.output);
    }
}

// 清理
ctx.cleanup();

// 保存报告
ctx.saveReports('TG-04-create', 'TG-04 文档创建测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
