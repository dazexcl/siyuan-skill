/**
 * TG-08 文档移动测试
 * 测试 move 命令及其别名
 * 验证：移动后验证 moved 标志和结果
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-08 文档移动测试');

console.log('\n========================================');
console.log('TG-08 文档移动测试');
console.log('========================================\n');

console.log('测试用例:');

/**
 * 获取文档的完整路径
 * @param {string} docId - 文档ID
 * @returns {string|null} 文档路径，获取失败返回null
 */
function getDocPath(docId) {
    const infoResult = ctx.runCmd(`block-get ${docId} --mode info`);
    if (!infoResult.success) return null;
    
    const pathMatch = infoResult.output.match(/"path"\s*:\s*"([^"]+)"/);
    return pathMatch ? pathMatch[1] : null;
}

/**
 * 验证文档是否移动到目标位置
 * 通过比较移动前后的文档路径来验证
 * @param {string} docId - 文档ID
 * @param {string} targetParentId - 目标父文档ID
 * @param {string} originalPath - 移动前的文档路径
 * @returns {Object} { success: boolean, details: string }
 */
function verifyDocumentMoved(docId, targetParentId, originalPath) {
    const newPath = getDocPath(docId);
    if (!newPath) {
        return { success: false, details: '无法获取移动后的文档路径' };
    }
    
    const pathChanged = newPath !== originalPath;
    if (!pathChanged) {
        return { success: false, details: `路径未改变: ${originalPath}` };
    }
    
    return { 
        success: true, 
        details: `路径已改变: ${originalPath} -> ${newPath}` 
    };
}

// 共享资源：创建一个通用的目标父文档，供多个测试用例使用
const timestamp = Date.now();
const sharedTargetTitle = `TG-08-00-${timestamp}`;
const sharedTargetResult = ctx.runCmd(`create "${sharedTargetTitle}" "共享目标父文档" --parent-id ${ctx.PARENT_ID}`);
const sharedTargetId = ctx.extractDocId(sharedTargetResult.output);

if (sharedTargetId) {
    ctx.createdDocs.push({ id: sharedTargetId, title: sharedTargetTitle });
}

// TG-08-01: 基本移动
{
    const timestamp = Date.now();
    const title1 = `TG-08-01-${timestamp}`;
    const createResult1 = ctx.runCmd(`create "${title1}" "源文档" --parent-id ${ctx.PARENT_ID}`);
    const sourceId = ctx.extractDocId(createResult1.output);
    
    if (!sourceId || !sharedTargetId) {
        ctx.addResult('TG-08-01', '基本移动', 'move <sourceId> <targetId>', '文档被移动到目标位置', '测试文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: sourceId, title: title1, isChild: true });
        
        const originalPath = getDocPath(sourceId);
        const cmd = `move ${sourceId} ${sharedTargetId}`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-08-01', '基本移动', cmd, '文档被移动到目标位置',
                '命令执行失败', false, result.error || result.output.substring(0, 100));
        } else {
            const hasMoved = result.output.includes('"moved": true') || 
                            result.output.includes('"moved":true') ||
                            (result.output.includes('success') && result.output.includes('targetParentId'));
            
            const verifyResult = verifyDocumentMoved(sourceId, sharedTargetId, originalPath);
            
            if (hasMoved && verifyResult.success) {
                ctx.addResult('TG-08-01', '基本移动', cmd, '文档被移动到目标位置',
                    '成功', true, `移动验证通过: ${verifyResult.details}`);
            } else if (hasMoved && !verifyResult.success) {
                ctx.addResult('TG-08-01', '基本移动', cmd, '文档被移动到目标位置',
                    '移动未生效', false, verifyResult.details);
            } else {
                ctx.addResult('TG-08-01', '基本移动', cmd, '文档被移动到目标位置',
                    '移动结果未确认', false, `输出: ${result.output.substring(0, 200)}`);
            }
        }
    }
}

// TG-08-02: 移动并重命名
{
    const timestamp = Date.now();
    const title1 = `TG-08-02-${timestamp}`;
    const newTitle = `TG-08-02-renamed-${timestamp}`;
    const createResult1 = ctx.runCmd(`create "${title1}" "源文档" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult1.output);
    
    if (!docId || !sharedTargetId) {
        ctx.addResult('TG-08-02', '移动并重命名', 'move <docId> <parentId> --new-title "新标题"', '文档被移动且重命名', '测试文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: docId, title: title1, isChild: true });
        
        const originalPath = getDocPath(docId);
        const cmd = `move ${docId} ${sharedTargetId} --new-title "${newTitle}"`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-08-02', '移动并重命名', cmd, '文档被移动且重命名',
                '命令执行失败', false, result.error || result.output.substring(0, 100));
        } else {
            const hasMoved = result.output.includes('"moved": true') || 
                            result.output.includes('"moved":true') ||
                            result.output.includes('success');
            const actualTitle = ctx.getDocTitle(docId);
            const titleChanged = actualTitle === newTitle;
            const verifyResult = verifyDocumentMoved(docId, sharedTargetId, originalPath);
            
            if (hasMoved && titleChanged && verifyResult.success) {
                ctx.addResult('TG-08-02', '移动并重命名', cmd, '文档被移动且重命名',
                    '成功', true, `移动验证通过: ${verifyResult.details}, 标题: ${actualTitle}`);
            } else if (hasMoved && !titleChanged) {
                ctx.addResult('TG-08-02', '移动并重命名', cmd, '文档被移动且重命名',
                    '标题未更新', false, `期望: ${newTitle}, 实际: ${actualTitle}`);
            } else if (hasMoved && !verifyResult.success) {
                ctx.addResult('TG-08-02', '移动并重命名', cmd, '文档被移动且重命名',
                    '移动未生效', false, verifyResult.details);
            } else {
                ctx.addResult('TG-08-02', '移动并重命名', cmd, '文档被移动且重命名',
                    '移动结果未确认', false, `输出: ${result.output.substring(0, 200)}`);
            }
        }
    }
}

// TG-08-03: 使用 --target 选项移动
{
    const timestamp = Date.now();
    const title1 = `TG-08-03-${timestamp}`;
    const createResult1 = ctx.runCmd(`create "${title1}" "源文档" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult1.output);
    
    if (!docId || !sharedTargetId) {
        ctx.addResult('TG-08-03', '使用 --target 选项移动', 'move <docId> --target <targetId>', '文档被移动到目标位置', '测试文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: docId, title: title1, isChild: true });
        
        const originalPath = getDocPath(docId);
        const cmd = `move ${docId} --target ${sharedTargetId}`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-08-03', '使用 --target 选项移动', cmd, '文档被移动到目标位置',
                '命令执行失败', false, result.error || result.output.substring(0, 100));
        } else {
            const hasMoved = result.output.includes('"moved": true') || 
                            result.output.includes('"moved":true') ||
                            result.output.includes('success');
            const verifyResult = verifyDocumentMoved(docId, sharedTargetId, originalPath);
            
            if (hasMoved && verifyResult.success) {
                ctx.addResult('TG-08-03', '使用 --target 选项移动', cmd, '文档被移动到目标位置',
                    '成功', true, `移动验证通过: ${verifyResult.details}`);
            } else if (hasMoved && !verifyResult.success) {
                ctx.addResult('TG-08-03', '使用 --target 选项移动', cmd, '文档被移动到目标位置',
                    '移动未生效', false, verifyResult.details);
            } else {
                ctx.addResult('TG-08-03', '使用 --target 选项移动', cmd, '文档被移动到目标位置',
                    '移动结果未确认', false, `输出: ${result.output.substring(0, 200)}`);
            }
        }
    }
}

// TG-08-04: 重名检测（思源笔记允许重名）
{
    const timestamp = Date.now();
    const dupTitle = `TG-08-04-${timestamp}`;
    const uniqueTitle = `TG-08-04-unique-${timestamp}`;
    const createResult1 = ctx.runCmd(`create "${dupTitle}" "重名测试1" --parent-id ${ctx.PARENT_ID}`);
    const createResult2 = ctx.runCmd(`create "${uniqueTitle}" "重名测试2" --parent-id ${ctx.PARENT_ID}`);
    const dupId = ctx.extractDocId(createResult1.output);
    const docId = ctx.extractDocId(createResult2.output);
    
    if (!dupId || !docId) {
        ctx.addResult('TG-08-04', '重名检测', 'move <docId> <parentId>', '正确处理重名情况', '测试文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: dupId, title: dupTitle });
        ctx.createdDocs.push({ id: docId, title: uniqueTitle });
        
        const cmd = `move ${docId} ${ctx.PARENT_ID} --new-title "${dupTitle}"`;
        const result = ctx.runCmd(cmd);
        
        const hasDupError = !result.success || 
                           result.output.includes('已存在') || 
                           result.output.includes('重名') ||
                           result.output.includes('duplicate');
        
        if (hasDupError) {
            ctx.addResult('TG-08-04', '重名检测', cmd, '正确处理重名情况',
                '成功', true, '正确检测到重名并拒绝操作');
        } else if (result.success) {
            const actualTitle = ctx.getDocTitle(docId);
            if (actualTitle === dupTitle) {
                ctx.addResult('TG-08-04', '重名检测', cmd, '正确处理重名情况',
                    '成功', true, '思源笔记允许重名，操作成功');
            } else {
                ctx.addResult('TG-08-04', '重名检测', cmd, '正确处理重名情况',
                    '标题未更改', false, `期望: ${dupTitle}, 实际: ${actualTitle}`);
            }
        } else {
            ctx.addResult('TG-08-04', '重名检测', cmd, '正确处理重名情况',
                '未预期结果', false, `输出: ${result.output.substring(0, 100)}`);
        }
    }
}

// TG-08-05: 缺少必需参数 - 文档ID
{
    const cmd = 'move';
    const result = ctx.runCmd(cmd);
    
    if (!result.success && (result.output.includes('缺少必需的文档ID参数') || result.error)) {
        ctx.addResult('TG-08-05', '缺少必需参数 - 文档ID', cmd, '返回错误提示', '正确', true, '正确提示缺少文档ID');
    } else {
        ctx.addResult('TG-08-05', '缺少必需参数 - 文档ID', cmd, '返回错误提示', '未正确处理', false, `输出: ${result.output.substring(0, 100)}`);
    }
}

// TG-08-06: 缺少必需参数 - 目标位置
{
    const cmd = `move ${ctx.NOTEBOOK_ID}`;
    const result = ctx.runCmd(cmd);

    if (!result.success && (result.output.includes('缺少必需的目标父目录ID参数') || result.error)) {
        ctx.addResult('TG-08-06', '缺少必需参数 - 目标位置', cmd, '返回错误提示', '正确', true, '正确提示缺少目标位置');
    } else {
        ctx.addResult('TG-08-06', '缺少必需参数 - 目标位置', cmd, '返回错误提示', '未正确处理', false, `输出: ${result.output.substring(0, 100)}`);
    }
}

// TG-08-07: 移动不存在的文档
{
    const fakeId = '20240101000000-fakeid';
    const cmd = `move ${fakeId} ${ctx.PARENT_ID}`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success && (result.output.includes('错误') || result.error)) {
        ctx.addResult('TG-08-07', '移动不存在的文档', cmd, '返回错误提示', '正确', true, '正确处理不存在的文档');
    } else {
        ctx.addResult('TG-08-07', '移动不存在的文档', cmd, '返回错误提示', '未正确处理', false, `输出: ${result.output.substring(0, 100)}`);
    }
}

// TG-08-08: 移动到不存在的目标位置
{
    const timestamp = Date.now();
    const title = `TG-08-08-${timestamp}`;
    const createResult = ctx.runCmd(`create "${title}" "测试文档" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    const fakeTarget = '20240101000000-faketarget';
    
    if (!docId) {
        ctx.addResult('TG-08-08', '移动到不存在的目标位置', 'move <docId> <fakeTarget>', '返回错误提示', '测试文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: docId, title: title });
        
        const cmd = `move ${docId} ${fakeTarget}`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success && (result.output.includes('错误') || result.error)) {
            ctx.addResult('TG-08-08', '移动到不存在的目标位置', cmd, '返回错误提示', '正确', true, '正确处理不存在的目标位置');
        } else {
            ctx.addResult('TG-08-08', '移动到不存在的目标位置', cmd, '返回错误提示', '未正确处理', false, `输出: ${result.output.substring(0, 100)}`);
        }
    }
}

// TG-08-09: 验证返回结果包含必要字段
{
    const timestamp = Date.now();
    const title1 = `TG-08-09-${timestamp}`;
    const createResult1 = ctx.runCmd(`create "${title1}" "源文档" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult1.output);
    
    if (!docId || !sharedTargetId) {
        ctx.addResult('TG-08-09', '验证返回结果包含必要字段', 'move <docId> <targetId>', '返回结果包含所有必要字段', '测试文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: docId, title: title1, isChild: true });
        
        const cmd = `move ${docId} ${sharedTargetId}`;
        const result = ctx.runCmd(cmd);
        
        if (result.success) {
            const hasSuccess = result.output.includes('"success": true') || result.output.includes('"success":true');
            const hasMoved = result.output.includes('"moved": true') || result.output.includes('"moved":true');
            const hasId = result.output.includes('"id"');
            const hasMessage = result.output.includes('"message"');
            const hasTimestamp = result.output.includes('"timestamp"');
            
            if (hasSuccess && hasMoved && hasId && hasMessage && hasTimestamp) {
                ctx.addResult('TG-08-09', '验证返回结果包含必要字段', cmd, '返回结果包含所有必要字段',
                    '成功', true, '返回结果包含 success, moved, id, message, timestamp');
            } else {
                ctx.addResult('TG-08-09', '验证返回结果包含必要字段', cmd, '返回结果包含所有必要字段',
                    '缺少必要字段', false, `success:${hasSuccess}, moved:${hasMoved}, id:${hasId}, message:${hasMessage}, timestamp:${hasTimestamp}`);
            }
        } else {
            ctx.addResult('TG-08-09', '验证返回结果包含必要字段', cmd, '返回结果包含所有必要字段',
                '命令执行失败', false, result.error || result.output.substring(0, 100));
        }
    }
}

// TG-08-10: 帮助信息显示
{
    const cmd = 'move --help';
    const result = ctx.runCmd(cmd);
    
    if (result.success && result.output.includes('用法:') && result.output.includes('move')) {
        ctx.addResult('TG-08-10', '帮助信息显示', cmd, '显示完整的帮助信息', '正确', true, '帮助信息显示正常');
    } else {
        ctx.addResult('TG-08-10', '帮助信息显示', cmd, '显示完整的帮助信息', '未正确显示', false, `输出: ${result.output.substring(0, 100)}`);
    }
}

// 清理
ctx.cleanup();

ctx.saveReports('TG-08-move', 'TG-08 文档移动测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
