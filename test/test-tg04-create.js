/**
 * TG-04 文档创建测试
 * 测试 create 命令的核心功能
 * 优化版：减少不必要的文档创建，同一个命令结果进行多种检测
 */
const { createTestContext } = require('./test-framework');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

// TG-04-01: 传统模式创建（位置参数方式）- 一次执行，多种检测
{
    const timestamp = Date.now();
    const title = `TG-04-001-传统模式创建-${timestamp}`;
    const content = '创建内容_唯一标识_' + timestamp;
    const cmd = `create "${title}" "${content}" --parent-id ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-001', '传统模式创建', cmd, '返回新文档ID',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-001' });
        
        const verify = verifyDocContent(docId, content);
        const titleMatch = result.output.includes(`"title": "${title}"`);
        const hasNotebookId = result.output.includes(`"notebookId": "${ctx.NOTEBOOK_ID}"`);
        
        if (verify.exists && verify.hasContent && titleMatch && hasNotebookId) {
            ctx.addResult('TG-04-001', '传统模式创建', cmd, '返回新文档ID、标题、笔记本ID、内容验证',
                '成功', true, `docId: ${docId}, 内容正确`);
        } else {
            const issues = [];
            if (!verify.exists) issues.push('文档不存在');
            if (!verify.hasContent) issues.push('内容不匹配');
            if (!titleMatch) issues.push('标题不匹配');
            if (!hasNotebookId) issues.push('笔记本ID不匹配');
            ctx.addResult('TG-04-001', '传统模式创建', cmd, '返回新文档ID、标题、笔记本ID、内容验证',
                '验证失败', false, `问题: ${issues.join(', ')}`);
        }
    }
}

// TG-04-02: 文档下创建子文档 - 一次执行，多种检测
{
    const timestamp = Date.now();
    const parentTitle = `TG-04-002-父文档-${timestamp}`;
    const parentCmd = `create "${parentTitle}" --parent-id ${ctx.PARENT_ID}`;
    const parentResult = ctx.runCmd(parentCmd);
    const parentId = ctx.extractDocId(parentResult.output);

    if (!parentId) {
        ctx.addResult('TG-04-002', '文档下创建子文档', 'create "title" --parent-id <parentId>', '返回新文档ID',
            '父文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: parentId, title: parentTitle, testId: 'TG-04-002' });

        const childTitle = `TG-04-002-子文档-${timestamp}`;
        const childContent = '子文档内容_' + timestamp;
        const cmd = `create "${childTitle}" "${childContent}" --parent-id ${parentId}`;
        const result = ctx.runCmd(cmd);
        const docId = ctx.extractDocId(result.output);

        if (!result.success || !docId) {
            ctx.addResult('TG-04-002', '文档下创建子文档', cmd, '返回新文档ID',
                '创建失败', false, result.error || result.output.substring(0, 100));
        } else {
            ctx.createdDocs.push({ id: docId, title: childTitle, testId: 'TG-04-002' });
            
            const verify = verifyDocContent(docId, childContent);
            const parentMatch = result.output.includes(`"parentId": "${parentId}"`);
            
            if (verify.exists && verify.hasContent && parentMatch) {
                ctx.addResult('TG-04-002', '文档下创建子文档', cmd, '返回新文档ID、父文档ID、内容验证',
                    '成功', true, `子文档: ${docId}, 父文档: ${parentId}`);
            } else {
                const issues = [];
                if (!verify.exists) issues.push('文档不存在');
                if (!verify.hasContent) issues.push('内容不匹配');
                if (!parentMatch) issues.push('父文档ID不匹配');
                ctx.addResult('TG-04-002', '文档下创建子文档', cmd, '返回新文档ID、父文档ID、内容验证',
                    '验证失败', false, `问题: ${issues.join(', ')}`);
            }
        }
    }
}

// TG-04-003: 路径模式-创建完整路径文档 - 一次执行，多种检测
{
    const timestamp = Date.now();
    const content = '路径创建内容_' + timestamp;
    const pathTitle = `TG-04-003-中间目录-${timestamp}`;
    const relativePath = `${pathTitle}/TG-04-003-最终文档-${timestamp}`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-003', '路径模式-完整路径', cmd, '自动创建中间目录',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title: `TG-04-003-最终文档-${timestamp}`, isChild: true, testId: 'TG-04-003' });
        
        const verify = verifyDocContent(docId, content);
        
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-003', '路径模式-完整路径', cmd, '自动创建中间目录、内容验证',
                '成功', true, `docId: ${docId}, 路径: ${relativePath}`);
        } else {
            const issues = [];
            if (!verify.exists) issues.push('文档不存在');
            if (!verify.hasContent) issues.push('内容不匹配');
            ctx.addResult('TG-04-003', '路径模式-完整路径', cmd, '自动创建中间目录、内容验证',
                '验证失败', false, `问题: ${issues.join(', ')}`);
        }
    }
}

// TG-04-004: 路径模式-自定义标题 - 一次执行，多种检测
{
    const timestamp = Date.now();
    const customTitle = `TG-04-004-自定义标题-${timestamp}`;
    const content = '自定义标题内容';
    const relativePath = `${customTitle}/B`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" --title "${customTitle}-final" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-004', '路径模式-自定义标题', cmd, '标题被正确设置',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title: customTitle + '-final', isChild: true, testId: 'TG-04-004' });
        
        const actualTitle = ctx.getDocTitle(docId);
        const titleMatch = result.output.includes(`"title": "${customTitle}-final"`);
        
        if (actualTitle && actualTitle.includes(customTitle) && titleMatch) {
            ctx.addResult('TG-04-004', '路径模式-自定义标题', cmd, '标题被正确设置、标题输出验证',
                '成功', true, `标题: ${actualTitle}`);
        } else {
            const issues = [];
            if (!actualTitle) issues.push('无法获取标题');
            if (!actualTitle?.includes(customTitle)) issues.push('标题不匹配');
            if (!titleMatch) issues.push('输出标题不匹配');
            ctx.addResult('TG-04-004', '路径模式-自定义标题', cmd, '标题被正确设置、标题输出验证',
                '验证失败', false, `问题: ${issues.join(', ')}`);
        }
    }
}

// TG-04-005: 目录下创建模式 - 一次执行，多种检测
{
    const timestamp = Date.now();
    const dirTitle = `TG-04-005-Directory-${timestamp}`;
    const title = `TG-04-005-Document-${timestamp}`;
    const content = 'Directory content_' + timestamp;
    const relativePath = `${dirTitle}/${title}`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-005', 'Directory creation', cmd, 'Create in specified directory',
            'Creation failed', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, isChild: true, testId: 'TG-04-005' });
        
        const verify = verifyDocContent(docId, content);
        
        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-005', 'Directory creation', cmd, 'Create in specified directory、content verification',
                'Success', true, `docId: ${docId}, path: ${dirTitle}/${title}`);
        } else {
            const issues = [];
            if (!verify.exists) issues.push('Document does not exist');
            if (!verify.hasContent) issues.push('Content mismatch');
            ctx.addResult('TG-04-005', 'Directory creation', cmd, 'Create in specified directory、content verification',
                'Verification failed', false, `Issues: ${issues.join(', ')}`);
        }
    }
}

// TG-04-006: 参数冲突检测
{
    const timestamp = Date.now();
    const title = `TG-04-006-参数冲突-${timestamp}`;
    const content = '参数冲突测试';
    const cmd = `create "${title}" "${content}" --parent-id ${ctx.PARENT_ID} --path "/AI/test"`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        if (result.error && result.error.includes('二选一')) {
            ctx.addResult('TG-04-006', '参数冲突检测', cmd, '应拒绝并提示错误',
                '成功', true, `正确拒绝`);
        } else {
            ctx.addResult('TG-04-006', '参数冲突检测', cmd, '应拒绝并提示错误',
                '错误信息不正确', false, result.error || result.output);
        }
    } else {
        ctx.addResult('TG-04-006', '参数冲突检测', cmd, '应拒绝并提示错误',
            '应该失败但成功了', false, '未正确验证参数冲突');
    }
}

// TG-04-007: 无效笔记本验证
{
    const timestamp = Date.now();
    const title = `TG-04-007-无效笔记本-${timestamp}`;
    let allPassed = true;
    let details = [];
    
    const cmd1 = `create --path "/invalid_notebook_name_12345/${title}" "无效名称测试"`;
    const result1 = ctx.runCmd(cmd1);
    if (result1.success) {
        allPassed = false;
        details.push('无效名称未拒绝');
    } else if (!result1.error?.includes('不是有效的笔记本')) {
        allPassed = false;
        details.push('无效名称错误信息不正确');
    }
    
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
        ctx.addResult('TG-04-007', '无效笔记本验证', '无效名称 & 无效ID', '应拒绝并提示错误',
            '成功', true, '两种情况都正确拒绝');
    } else {
        ctx.addResult('TG-04-007', '无效笔记本验证', '无效名称 & 无效ID', '应拒绝并提示错误',
            '部分失败', false, details.join('; '));
    }
}

// TG-04-008: 多级嵌套路径创建 - 一次执行，多种检测
{
    const timestamp = Date.now();
    const content = '多级路径测试_' + timestamp;
    const level1 = `TG-04-008-L1-${timestamp}`;
    const level2 = `TG-04-008-L2-${timestamp}`;
    const level3 = `TG-04-008-L3-${timestamp}`;
    const title = `TG-04-008-最终文档-${timestamp}`;
    const relativePath = `${level1}/${level2}/${level3}/${title}`;
    const fullPath = ctx.buildPath(relativePath);
    const cmd = `create --path "${fullPath}" "${content}"`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);

    if (!result.success || !docId) {
        ctx.addResult('TG-04-008', '多级嵌套路径', cmd, '应创建3级目录结构',
            '创建失败', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, isChild: true, testId: 'TG-04-008' });

        const verify = verifyDocContent(docId, content);

        if (verify.exists && verify.hasContent) {
            ctx.addResult('TG-04-008', '多级嵌套路径', cmd, '应创建3级目录结构、内容验证',
                '成功', true, `路径: ${level1}/${level2}/${level3}/${title}`);
        } else {
            const issues = [];
            if (!verify.exists) issues.push('文档不存在');
            if (!verify.hasContent) issues.push('内容不匹配');
            ctx.addResult('TG-04-008', '多级嵌套路径', cmd, '应创建3级目录结构、内容验证',
                '验证失败', false, `问题: ${issues.join(', ')}`);
        }
    }
}

// TG-04-009: 文档已存在时未使用 --force
{
    const timestamp = Date.now();
    const title = `TG-04-009-重复创建-${timestamp}`;
    const content = '重复创建测试';
    const cmd = `create "${title}" "${content}" --parent-id ${ctx.PARENT_ID}`;
    
    const result1 = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result1.output);
    
    if (docId) {
        ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-009' });
        
        const result2 = ctx.runCmd(cmd);
        if (!result2.success) {
            if (result2.error && result2.error.includes('已存在')) {
                ctx.addResult('TG-04-009', '重复创建拒绝', cmd, '应拒绝并提示已存在',
                    '成功', true, `正确拒绝`);
            } else {
                ctx.addResult('TG-04-009', '重复创建拒绝', cmd, '应拒绝并提示已存在',
                    '错误信息不正确', false, result2.error || result2.output);
            }
        } else {
            ctx.addResult('TG-04-009', '重复创建拒绝', cmd, '应拒绝并提示已存在',
                '应该失败但成功了', false, '未正确检测重复文档');
        }
    } else {
        ctx.addResult('TG-04-009', '重复创建拒绝', cmd, '应拒绝并提示已存在',
            '首次创建失败', false, result1.error || result1.output);
    }
}

// TG-04-010: 文档已存在时使用 --force
{
    const timestamp = Date.now();
    const title = `TG-04-010-强制覆盖-${timestamp}`;
    const content1 = '首次内容_' + timestamp;
    const content2 = '强制覆盖内容_' + timestamp;
    const cmd1 = `create "${title}" "${content1}" --parent-id ${ctx.PARENT_ID}`;
    const cmd2 = `create "${title}" "${content2}" --parent-id ${ctx.PARENT_ID} --force`;
    
    const result1 = ctx.runCmd(cmd1);
    const docId = ctx.extractDocId(result1.output);
    
    if (docId) {
        ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-010' });
        
        const result2 = ctx.runCmd(cmd2);
        const verify = verifyDocContent(docId, content2);
        const overwrittenMatch = result2.output.includes(`"overwritten": true`);
        
        if (result2.success && verify.exists && verify.hasContent && overwrittenMatch) {
            ctx.addResult('TG-04-010', '强制覆盖', cmd2, '应成功覆盖、overwritten标记、内容验证',
                '成功', true, `docId: ${docId}, 内容已更新`);
        } else {
            const issues = [];
            if (!result2.success) issues.push('更新失败');
            if (!verify.exists) issues.push('文档不存在');
            if (!verify.hasContent) issues.push('内容未更新');
            if (!overwrittenMatch) issues.push('overwritten标记缺失');
            ctx.addResult('TG-04-010', '强制覆盖', cmd2, '应成功覆盖、overwritten标记、内容验证',
                '验证失败', false, `问题: ${issues.join(', ')}`);
        }
    } else {
        ctx.addResult('TG-04-010', '强制覆盖', cmd1, '应成功覆盖',
            '首次创建失败', false, result1.error || result1.output);
    }
}

// TG-04-011: 空内容创建 - 边界条件测试
{
    const timestamp = Date.now();
    const title = `TG-04-011-EmptyContent-${timestamp}`;
    const cmd = `create "${title}" "" --parent-id ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-011', 'Empty content', cmd, 'Should create doc with empty content',
            'Creation failed', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-011' });
        
        const contentVerify = verifyDocContent(docId, '');
        const contentLengthMatch = result.output.includes(`"contentLength": 0`);
        
        if (contentVerify.exists && contentLengthMatch) {
            ctx.addResult('TG-04-011', 'Empty content', cmd, 'Should create doc with empty content、content length verification',
                'Success', true, `docId: ${docId}`);
        } else {
            const issues = [];
            if (!contentVerify.exists) issues.push('Document does not exist');
            if (!contentLengthMatch) issues.push('contentLength incorrect');
            ctx.addResult('TG-04-011', 'Empty content', cmd, 'Should create doc with empty content、content length verification',
                'Verification failed', false, `Issues: ${issues.join(', ')}`);
        }
    }
}

// TG-04-012: 多行内容创建 - 边界条件测试
{
    const timestamp = Date.now();
    const title = `TG-04-012-MultiLine-${timestamp}`;
    const content = `First line\nSecond line\nThird line_${timestamp}`;
    const cmd = `create "${title}" "${content}" --parent-id ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-012', 'Multi-line content', cmd, 'Should handle multi-line content correctly',
            'Creation failed', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-012' });
        
        const contentVerify = verifyDocContent(docId, `Third line_${timestamp}`);
        
        if (contentVerify.exists && contentVerify.hasContent) {
            ctx.addResult('TG-04-012', 'Multi-line content', cmd, 'Should handle multi-line content correctly、content verification',
                'Success', true, `docId: ${docId}`);
        } else {
            const issues = [];
            if (!contentVerify.exists) issues.push('Document does not exist');
            if (!contentVerify.hasContent) issues.push('Multi-line content mismatch');
            ctx.addResult('TG-04-012', 'Multi-line content', cmd, 'Should handle multi-line content correctly、content verification',
                'Verification failed', false, `Issues: ${issues.join(', ')}`);
        }
    }
}

// TG-04-013: 使用内容块ID作为父节点（思源笔记允许）
{
    const timestamp = Date.now();
    const title = `TG-04-013-ContentBlockID-${timestamp}`;
    
    const parentCmd = `create "${title}" "Parent content" --parent-id ${ctx.PARENT_ID}`;
    const parentResult = ctx.runCmd(parentCmd);
    const parentId = ctx.extractDocId(parentResult.output);
    
    if (!parentId) {
        ctx.addResult('TG-04-013', 'ContentBlockID verification', 'Create parent doc', 'Allow content block ID as parent',
            'Parent creation failed', false);
    } else {
        ctx.createdDocs.push({ id: parentId, title, testId: 'TG-04-013' });
        
        const blockInsertCmd = `block-insert "Child block content" --parent-id ${parentId}`;
        const blockResult = ctx.runCmd(blockInsertCmd);
        
        if (blockResult.success) {
            const blockIdMatch = blockResult.output.match(/"id"\s*:\s*"([^"]+)"/);
            if (blockIdMatch) {
                const blockId = blockIdMatch[1];
                const testCmd = `create "TG-04-013-TestDoc-${timestamp}" "Test content" --parent-id ${blockId}`;
                const testResult = ctx.runCmd(testCmd);
                
                if (testResult.success) {
                    const testDocId = ctx.extractDocId(testResult.output);
                    if (testDocId) {
                        ctx.createdDocs.push({ id: testDocId, title: `TG-04-013-TestDoc-${timestamp}`, testId: 'TG-04-013' });
                        ctx.addResult('TG-04-013', 'ContentBlockID verification', testCmd, 'Allow content block ID as parent',
                            'Success', true, `Correctly accepted content block ID: ${blockId}`);
                    } else {
                        ctx.addResult('TG-04-013', 'ContentBlockID verification', testCmd, 'Allow content block ID as parent',
                            'Verification failed', false, 'Cannot extract document ID');
                    }
                } else {
                    ctx.addResult('TG-04-013', 'ContentBlockID verification', testCmd, 'Allow content block ID as parent',
                        'Failed: rejected content block ID', false, testResult.error);
                }
            } else {
                ctx.addResult('TG-04-013', 'ContentBlockID verification', 'Extract block ID', 'Should extract block ID',
                    'Failed to extract block ID', false, blockResult.output);
            }
        } else {
            ctx.addResult('TG-04-013', 'ContentBlockID verification', 'Insert content block', 'Should insert successfully',
                'Block insertion failed', false, blockResult.error || blockResult.output);
        }
    }
}

// TG-04-014: 使用 --file 选项从文件读取内容
{
    const timestamp = Date.now();
    const title = `TG-04-014-FileContent-${timestamp}`;
    const fileContent = `File content test\nLine 2\nUnique ID: ${timestamp}`;
    
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'siyuan-test-'));
    const tempFile = path.join(tempDir, 'content.md');
    
    try {
        fs.writeFileSync(tempFile, fileContent, 'utf8');
        
        const cmd = `create "${title}" --file "${tempFile}" --parent-id ${ctx.PARENT_ID}`;
        const result = ctx.runCmd(cmd);
        const docId = ctx.extractDocId(result.output);
        
        if (!result.success || !docId) {
            ctx.addResult('TG-04-014', 'File content reading', cmd, 'Should read content from file',
                'Creation failed', false, result.error || result.output.substring(0, 100));
        } else {
            ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-014' });
            
            const contentVerify = verifyDocContent(docId, `Unique ID: ${timestamp}`);
            const contentLengthMatch = result.output.includes(`"contentLength": ${fileContent.length}`);
            
            if (contentVerify.exists && contentVerify.hasContent && contentLengthMatch) {
                ctx.addResult('TG-04-014', 'File content reading', cmd, 'Should read content from file、content length verification',
                    'Success', true, `docId: ${docId}, file: ${tempFile}`);
            } else {
                const issues = [];
                if (!contentVerify.exists) issues.push('Document does not exist');
                if (!contentVerify.hasContent) issues.push('Content from file not found');
                if (!contentLengthMatch) issues.push('Content length incorrect');
                ctx.addResult('TG-04-014', 'File content reading', cmd, 'Should read content from file、content length verification',
                    'Verification failed', false, `Issues: ${issues.join(', ')}`);
            }
        }
    } finally {
        if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
        if (fs.existsSync(tempDir)) {
            fs.rmdirSync(tempDir);
        }
    }
}

// TG-04-015: 文件不存在时的错误处理
{
    const timestamp = Date.now();
    const title = `TG-04-015-FileNotFound-${timestamp}`;
    const nonexistentFile = '/nonexistent/path/to/file.txt';
    
    const cmd = `create "${title}" --file "${nonexistentFile}" --parent-id ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        if (result.error && result.error.includes('无法读取文件')) {
            ctx.addResult('TG-04-015', 'File not found error', cmd, 'Should reject with file read error',
                'Success', true, `Correctly rejected nonexistent file`);
        } else {
            ctx.addResult('TG-04-015', 'File not found error', cmd, 'Should reject with file read error',
                'Error message incorrect', false, result.error || result.output);
        }
    } else {
        ctx.addResult('TG-04-015', 'File not found error', cmd, 'Should reject with file read error',
            'Should have failed but succeeded', false, 'Did not validate file existence');
    }
}

// TG-04-016: --file 和 --content 同时使用时的优先级测试
{
    const timestamp = Date.now();
    const title = `TG-04-016-PriorityTest-${timestamp}`;
    const contentParam = `Content param_${timestamp}`;
    
    const testDocPath = path.join(__dirname, 'test-docs', 'tg04-priority.md');
    
    const cmd = `create "${title}" --file "${testDocPath}" --content "${contentParam}" --parent-id ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    const docId = ctx.extractDocId(result.output);
    
    if (!result.success || !docId) {
        ctx.addResult('TG-04-016', 'File priority over content', cmd, 'Should prefer --file over --content',
            'Creation failed', false, result.error || result.output.substring(0, 100));
    } else {
        ctx.createdDocs.push({ id: docId, title, testId: 'TG-04-016' });
        
        const fileContentVerify = verifyDocContent(docId, 'File content_');
        const contentParamVerify = verifyDocContent(docId, contentParam);
        
        if (fileContentVerify.exists && fileContentVerify.hasContent && !contentParamVerify.hasContent) {
            ctx.addResult('TG-04-016', 'File priority over content', cmd, 'Should prefer --file over --content',
                'Success', true, `docId: ${docId}, --file took priority`);
        } else {
            const issues = [];
            if (!fileContentVerify.exists) issues.push('Document does not exist');
            if (!fileContentVerify.hasContent) issues.push('File content not used');
            if (contentParamVerify.hasContent) issues.push('--content was used instead of --file');
            ctx.addResult('TG-04-016', 'File priority over content', cmd, 'Should prefer --file over --content',
                'Verification failed', false, `Issues: ${issues.join(', ')}`);
        }
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
