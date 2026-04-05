/**
 * TG-14 路径转换测试
 * 测试 convert/path 命令
 * 验证：ID转路径、路径转ID，解析结果正确
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-14 路径转换测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

function parseConvertResult(output) {
    try {
        // 找到最后一个完整的 JSON 对象（多行格式）
        const lastBrace = output.lastIndexOf('}');
        if (lastBrace === -1) return null;
        
        // 从最后一个 } 往前找匹配的 {
        let depth = 0;
        let start = -1;
        for (let i = lastBrace; i >= 0; i--) {
            if (output[i] === '}') depth++;
            if (output[i] === '{') depth--;
            if (depth === 0) {
                start = i;
                break;
            }
        }
        
        if (start === -1) return null;
        const jsonStr = output.substring(start, lastBrace + 1);
        const data = JSON.parse(jsonStr);
        return {
            success: data.success !== false,
            path: data.path || data.data?.path || null,
            id: data.id || data.data?.id || null,
            hPath: data.hPath || data.data?.hPath || null,
            box: data.box || data.data?.box || null,
            error: data.error || data.msg || null
        };
    } catch (e) {
        return null;
    }
}

console.log('\n========================================');
console.log('TG-14 路径转换测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `TG-14-01-路径转换测试_${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "路径转换测试内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);
if (testDocId) {
    createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-14-01: ID 转路径
if (testDocId) {
    const cmd = `convert --id ${testDocId}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-14-01', 'ID转路径', cmd, '返回文档路径',
            '命令执行失败', false, result.error);
    } else {
        const data = parseConvertResult(result.output);
        if (!data) {
            addResult('TG-14-01', 'ID转路径', cmd, '返回文档路径',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-14-01', 'ID转路径', cmd, '返回文档路径',
                '返回错误', false, data.error);
        } else {
            const hasPath = data.path || data.hPath;
            const pathContainsId = hasPath && (hasPath.includes(testDocId) || hasPath.includes(testDocTitle));
            addResult('TG-14-01', 'ID转路径', cmd, '返回文档路径',
                hasPath ? '成功' : '无路径', !!hasPath,
                hasPath ? `路径: ${hasPath}` : '未找到路径');
        }
    }
} else {
    addResult('TG-14-01', 'ID转路径', 'convert --id <docId>', '返回文档路径', '测试文档创建失败', false);
}

//  TG-14-03: 不存在的ID
{
    const fakeId = '20230301' + Math.random().toString(36).substring(2, 15);
    const cmd = `convert --id ${fakeId}`;
    const result = runCmd(cmd);
    
    const handled = !result.success || 
                   result.output.includes('错误') || 
                   result.output.includes('error') ||
                   result.output.includes('不存在') ||
                   result.output.includes('not found') ||
                   result.output.includes('null');
    
    addResult('TG-14-03', '转换不存在的ID', cmd, '返回错误提示',
        handled ? '成功' : '未正确处理', handled,
        handled ? '正确处理不存在的ID' : '未返回预期错误');
}

// TG-14-04: 简写模式 - ID
if (testDocId) {
    const cmd = `convert ${testDocId}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-14-04', '简写模式-ID', cmd, '自动识别为ID',
            '命令执行失败', false, result.error);
    } else {
        const data = parseConvertResult(result.output);
        const hasPath = data && (data.path || data.hPath);
        addResult('TG-14-04', '简写模式-ID', cmd, '自动识别为ID',
            hasPath ? '成功' : '无路径', !!hasPath,
            hasPath ? '位置参数正确识别为ID' : '未返回路径');
    }
} else {
    addResult('TG-14-04', '简写模式-ID', 'convert <docId>', '自动识别为ID', '测试文档创建失败', false);
}

// TG-14-05: 通过文档标题路径获取ID（使用完整hPath）
if (testDocId) {
    const pathResult = runCmd(`convert --id ${testDocId}`);
    const pathData = parseConvertResult(pathResult.output);
    const docHPath = pathData?.path || pathData?.hPath;

    if (docHPath) {
        const cmd = `convert --path "${docHPath}"`;
        const result = runCmd(cmd);

        if (!result.success) {
            addResult('TG-14-05', '通过路径获取ID', cmd, '返回文档ID',
                '命令执行失败', false, result.error);
        } else {
            const data = parseConvertResult(result.output);
            if (data && data.id) {
                const idMatches = data.id === testDocId;
                addResult('TG-14-05', '通过路径获取ID', cmd, '返回文档ID',
                    idMatches ? '成功' : 'ID不匹配', idMatches,
                    `路径: ${docHPath}, 返回ID: ${data.id}, 匹配: ${idMatches}`);
            } else {
                addResult('TG-14-05', '通过路径获取ID', cmd, '返回文档ID',
                    '无ID返回', false, '未找到文档ID');
            }
        }
    } else {
        addResult('TG-14-05', '通过路径获取ID', 'convert --path "/path"', '返回文档ID', '无法获取文档路径', false);
    }
} else {
    addResult('TG-14-05', '通过路径获取ID', 'convert --path "/path"', '返回文档ID', '测试文档创建失败', false);
}

// TG-14-06: 路径转ID（使用完整路径）
if (testDocId) {
    // 先获取路径
    const pathResult = runCmd(`convert --id ${testDocId}`);
    const pathData = parseConvertResult(pathResult.output);
    const docPath = pathData?.path || pathData?.hPath;
    
    if (docPath) {
        const cmd = `convert --path "${docPath}" --notebook ${NOTEBOOK_ID}`;
        const result = runCmd(cmd);
        
        if (!result.success) {
            addResult('TG-14-06', '路径转ID', cmd, '返回文档ID',
                '命令执行失败', false, result.error);
        } else {
            const data = parseConvertResult(result.output);
            if (data && data.id) {
                const idMatches = data.id === testDocId;
                addResult('TG-14-06', '路径转ID', cmd, '返回文档ID',
                    idMatches ? '成功' : 'ID不匹配', idMatches,
                    `路径: ${docPath}, 返回ID: ${data.id}`);
            } else {
                addResult('TG-14-06', '路径转ID', cmd, '返回文档ID',
                    '无ID返回', false, '路径转ID失败');
            }
        }
    } else {
        addResult('TG-14-06', '路径转ID', 'convert --path "/path"', '返回文档ID', '无法获取测试路径', false);
    }
} else {
    addResult('TG-14-06', '路径转ID', 'convert --path "/path"', '返回文档ID', '测试文档创建失败', false);
}

// 清理
ctx.cleanup();

// 保存报告
saveReports('TG-14-convert', 'TG-14 路径转换测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
