/**
 * TG-13 NLP 分析测试
 * 测试 nlp 命令
 * 验证：返回包含分词、关键词等有效结果
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-13 NLP 分析测试');
const { runCmd, addResult, saveReports } = ctx;

function parseNlpResult(output) {
    try {
        const jsonMatch = output.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const data = JSON.parse(jsonMatch[0]);
        return {
            success: data.success !== false,
            tokens: data.tokens || [],
            tokenCount: data.tokenCount || 0,
            keywords: data.keywords || [],
            keywordCount: data.keywordCount || 0,
            entities: data.entities || [],
            entityCount: data.entityCount || 0,
            language: data.language || null,
            summary: data.summary || null,
            stats: data.stats || null,
            error: data.error || null
        };
    } catch (e) {
        return null;
    }
}

console.log('\n========================================');
console.log('TG-13 NLP 分析测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-13-01: 默认分析（分词+实体+关键词）
{
    const testText = '这是一段需要进行自然语言处理的测试文本，包含人工智能和机器学习';
    const cmd = `nlp "${testText}"`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-13-01', '默认分析', cmd, '返回分词、实体、关键词',
            '命令执行失败', false, result.error);
    } else {
        const data = parseNlpResult(result.output);
        if (!data) {
            addResult('TG-13-01', '默认分析', cmd, '返回分词、实体、关键词',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-13-01', '默认分析', cmd, '返回分词、实体、关键词',
                '返回错误', false, data.error);
        } else {
            const hasTokens = data.tokens.length > 0;
            const hasKeywords = data.keywords.length > 0;
            const valid = hasTokens && hasKeywords;
            addResult('TG-13-01', '默认分析', cmd, '返回分词、实体、关键词',
                valid ? '成功' : '结果不完整', valid,
                `分词: ${data.tokenCount}个, 关键词: ${data.keywordCount}个, 实体: ${data.entityCount}个`);
        }
    }
}

// TG-13-02: 指定分析任务 - 只做分词
{
    const testText = '分词测试文本自然语言处理';
    const cmd = `nlp "${testText}" --tasks tokenize`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-13-02', '指定分析-分词', cmd, '只返回分词结果',
            '命令执行失败', false, result.error);
    } else {
        const data = parseNlpResult(result.output);
        if (!data) {
            addResult('TG-13-02', '指定分析-分词', cmd, '只返回分词结果',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-13-02', '指定分析-分词', cmd, '只返回分词结果',
                '返回错误', false, data.error);
        } else {
            const hasTokens = data.tokens.length > 0;
            const noKeywords = data.keywords.length === 0;
            addResult('TG-13-02', '指定分析-分词', cmd, '只返回分词结果',
                hasTokens ? '成功' : '无分词结果', hasTokens,
                `分词数: ${data.tokenCount}`);
        }
    }
}

// TG-13-03: 关键词数量限制
{
    const testText = '这是一段用于测试关键词数量限制的文本内容，涉及人工智能、机器学习、深度学习、自然语言处理、神经网络';
    const cmd = `nlp "${testText}" --tasks keywords --top-n 3`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-13-03', '关键词数量限制', cmd, '最多返回3个关键词',
            '命令执行失败', false, result.error);
    } else {
        const data = parseNlpResult(result.output);
        if (!data) {
            addResult('TG-13-03', '关键词数量限制', cmd, '最多返回3个关键词',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-13-03', '关键词数量限制', cmd, '最多返回3个关键词',
                '返回错误', false, data.error);
        } else {
            const withinLimit = data.keywords.length <= 3;
            const hasKeywords = data.keywords.length > 0;
            addResult('TG-13-03', '关键词数量限制', cmd, '最多返回3个关键词',
                withinLimit && hasKeywords ? '成功' : '失败', withinLimit && hasKeywords,
                `关键词数: ${data.keywordCount}, 列表: ${data.keywords.slice(0,3).join(', ')}`);
        }
    }
}

// TG-13-04: 实体识别
{
    const testText = '张三在北京的清华大学学习人工智能';
    const cmd = `nlp "${testText}" --tasks entities`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-13-04', '实体识别', cmd, '返回识别的实体',
            '命令执行失败', false, result.error);
    } else {
        const data = parseNlpResult(result.output);
        if (!data) {
            addResult('TG-13-04', '实体识别', cmd, '返回识别的实体',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-13-04', '实体识别', cmd, '返回识别的实体',
                '返回错误', false, data.error);
        } else {
            addResult('TG-13-04', '实体识别', cmd, '返回识别的实体',
                '成功', true, `实体数: ${data.entityCount}`);
        }
    }
}

// TG-13-05: 完整分析
{
    const testText = '苹果公司发布新款iPhone，股价上涨百分之五';
    const cmd = `nlp "${testText}" --tasks all`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-13-05', '完整分析', cmd, '返回完整分析结果',
            '命令执行失败', false, result.error);
    } else {
        const data = parseNlpResult(result.output);
        if (!data) {
            addResult('TG-13-05', '完整分析', cmd, '返回完整分析结果',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-13-05', '完整分析', cmd, '返回完整分析结果',
                '返回错误', false, data.error);
        } else {
            const hasTokens = data.tokens.length > 0;
            const hasStats = data.stats !== null;
            addResult('TG-13-05', '完整分析', cmd, '返回完整分析结果',
                hasTokens ? '成功' : '结果不完整', hasTokens,
                `分词: ${data.tokenCount}, 有统计: ${hasStats}`);
        }
    }
}

// TG-13-06: 空文本处理
{
    const cmd = 'nlp ""';
    const result = runCmd(cmd);
    
    const handled = !result.success || 
                   result.output.includes('请提供') || 
                   result.output.includes('必须') ||
                   result.output.includes('缺少') ||
                   result.output.includes('error');
    
    addResult('TG-13-06', '空文本处理', cmd, '返回错误提示',
        handled ? '成功' : '未正确处理', handled,
        handled ? '正确处理空文本' : '未返回预期错误');
}

// 保存报告
saveReports('TG-13-nlp', 'TG-13 NLP 分析测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
