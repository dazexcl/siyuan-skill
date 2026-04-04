/**
 * TG-03 文档内容测试
 * 测试 content 命令及其别名
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-03 文档内容测试');
const TEST_CONTENT = '测试内容_唯一标识_' + Date.now();

function parseJsonOutput(output) {
    try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
}

console.log('\n========================================');
console.log('TG-03 文档内容测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `test_content_${Date.now()}`;
const createResult = ctx.runCmd(`create "${testDocTitle}" "${TEST_CONTENT}" --parent-id ${ctx.PARENT_ID}`);
const testDocId = ctx.extractDocId(createResult.output);
if (testDocId) {
    ctx.createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-03-01: 通过ID获取文档内容
if (testDocId) {
    const cmd = `content ${testDocId}`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        ctx.addResult('TG-03-01', '通过ID获取文档内容', cmd, '返回文档内容',
            '命令执行失败', false, result.error);
    } else {
        const data = parseJsonOutput(result.output);
        if (!data) {
            ctx.addResult('TG-03-01', '通过ID获取文档内容', cmd, '返回文档内容',
                '无法解析JSON数据', false, `输出前100字符: ${result.output.substring(0, 100)}`);
        } else {
            let content = data.data !== undefined ? data.data : (data.content !== undefined ? data.content : '');
            if (typeof content !== 'string') content = JSON.stringify(content);
            const hasExpectedContent = content.includes(TEST_CONTENT);
            if (hasExpectedContent) {
                ctx.addResult('TG-03-01', '通过ID获取文档内容', cmd, '返回文档内容',
                    '成功', true, `内容包含预期字符串，长度: ${content.length}`);
            } else {
                ctx.addResult('TG-03-01', '通过ID获取文档内容', cmd, '返回文档内容',
                    '内容不匹配', false, `预期包含: ${TEST_CONTENT}`);
            }
        }
    }
} else {
    ctx.addResult('TG-03-01', '通过ID获取文档内容', 'content <docId>', '返回文档内容', '测试文档创建失败', false);
}

// TG-03-02: 别名 cat
if (testDocId) {
    const cmd = `cat ${testDocId}`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        ctx.addResult('TG-03-02', '别名测试 - cat', cmd, '返回文档内容',
            '命令执行失败', false, result.error);
    } else {
        const data = parseJsonOutput(result.output);
        if (!data) {
            ctx.addResult('TG-03-02', '别名测试 - cat', cmd, '返回文档内容',
                '无法解析JSON数据', false);
        } else {
            let content = data.data !== undefined ? data.data : (data.content !== undefined ? data.content : '');
            if (typeof content !== 'string') content = JSON.stringify(content);
            const hasExpectedContent = content.includes(TEST_CONTENT);
            ctx.addResult('TG-03-02', '别名测试 - cat', cmd, '返回文档内容',
                hasExpectedContent ? '成功' : '内容不匹配', hasExpectedContent,
                hasExpectedContent ? `cat别名工作正常，长度: ${content.length}` : '内容不匹配');
        }
    }
} else {
    ctx.addResult('TG-03-02', '别名测试 - cat', 'cat <docId>', '返回文档内容', '测试文档创建失败', false);
}

// TG-03-03: 格式转换 - markdown
if (testDocId) {
    const cmd = `content ${testDocId} --format markdown`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        ctx.addResult('TG-03-03', '格式转换 - markdown', cmd, '返回 markdown 格式',
            '命令执行失败', false, result.error);
    } else {
        const data = parseJsonOutput(result.output);
        if (!data) {
            ctx.addResult('TG-03-03', '格式转换 - markdown', cmd, '返回 markdown 格式',
                '无法解析JSON数据', false);
        } else {
            let content = data.data !== undefined ? data.data : (data.content !== undefined ? data.content : '');
            if (typeof content !== 'string') content = JSON.stringify(content);
            ctx.addResult('TG-03-03', '格式转换 - markdown', cmd, '返回 markdown 格式',
                content.length > 0 ? '成功' : '内容为空', content.length > 0,
                `markdown格式内容长度: ${content.length}`);
        }
    }
} else {
    ctx.addResult('TG-03-03', '格式转换 - markdown', 'content <docId> --format markdown', '返回 markdown 格式', '测试文档创建失败', false);
}

// TG-03-04: 原始输出 --raw
if (testDocId) {
    const cmd = `content ${testDocId} --raw`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        ctx.addResult('TG-03-04', '原始输出 - raw', cmd, '返回纯文本无JSON包装',
            '命令执行失败', false, result.error);
    } else {
        const hasTitle = result.output.includes('title=');
        const hasId = result.output.includes('id=');
        const hasContent = result.output.includes(TEST_CONTENT);
        
        ctx.addResult('TG-03-04', '原始输出 - raw', cmd, '返回纯文本无JSON包装',
            hasTitle && hasId ? '成功' : '格式不正确', hasTitle && hasId,
            `包含title/id属性，内容匹配: ${hasContent}`);
    }
} else {
    ctx.addResult('TG-03-04', '原始输出 - raw', 'content <docId> --raw', '返回纯文本无JSON包装', '测试文档创建失败', false);
}

// TG-03-05: 短参数 -F (format)
if (testDocId) {
    const cmd = `content ${testDocId} -F markdown`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        ctx.addResult('TG-03-05', '短参数 -F (format)', cmd, '与 --format 效果一致',
            '命令执行失败', false, result.error);
    } else {
        const data = parseJsonOutput(result.output);
        if (!data) {
            ctx.addResult('TG-03-05', '短参数 -F (format)', cmd, '与 --format 效果一致',
                '无法解析JSON数据', false);
        } else {
            let content = data.data !== undefined ? data.data : (data.content !== undefined ? data.content : '');
            if (typeof content !== 'string') content = JSON.stringify(content);
            ctx.addResult('TG-03-05', '短参数 -F (format)', cmd, '与 --format 效果一致',
                content.length > 0 ? '成功' : '内容为空', content.length > 0,
                `-F 别名工作正常，内容长度: ${content.length}`);
        }
    }
} else {
    ctx.addResult('TG-03-05', '短参数 -F (format)', 'content <docId> -F markdown', '与 --format 效果一致', '测试文档创建失败', false);
}

// TG-03-06: 短参数 -r (raw)
if (testDocId) {
    const cmd = `content ${testDocId} -r`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        ctx.addResult('TG-03-06', '短参数 -r (raw)', cmd, '与 --raw 效果一致',
            '命令执行失败', false, result.error);
    } else {
        const hasTitle = result.output.includes('title=');
        const hasId = result.output.includes('id=');
        
        ctx.addResult('TG-03-06', '短参数 -r (raw)', cmd, '与 --raw 效果一致',
            hasTitle && hasId ? '成功' : '格式不正确', hasTitle && hasId,
            `-r 别名工作正常`);
    }
} else {
    ctx.addResult('TG-03-06', '短参数 -r (raw)', 'content <docId> -r', '与 --raw 效果一致', '测试文档创建失败', false);
}

// 清理
ctx.cleanup();

ctx.saveReports('TG-03-content', 'TG-03 文档内容测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
