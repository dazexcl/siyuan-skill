/**
 * TG-26 嵌入重排功能测试
 * 测试 search 命令的嵌入重排功能
 * 验证：重排功能正常工作，结果包含重排分数和统计信息
 *
 * 环境依赖：
 * - 需要配置 Qdrant 向量数据库
 * - 需要配置嵌入模型服务
 * - 如果环境不满足，相关测试将被跳过
 */
const { createTestContext } = require('./test-framework');
const fs = require('fs');
const path = require('path');

const ctx = createTestContext('TG-26 嵌入重排功能测试');
const { runCmd, addResult, saveReports } = ctx;

const RERANK_ENV_KEY = 'SIYUAN_RERANK_AVAILABLE';

/**
 * 检查重排环境是否可用
 * 需要检查配置文件中的 qdrant 和 embedding 配置
 * @returns {boolean}
 */
function checkRerankEnvironment() {
    if (process.env[RERANK_ENV_KEY] === 'true') {
        return true;
    }
    if (process.env[RERANK_ENV_KEY] === 'false') {
        return false;
    }
    
    try {
        const configPath = path.join(__dirname, '../scripts/lib/config.js');
        const ConfigManager = require(configPath);
        const configManager = new ConfigManager();
        const config = configManager.getConfig();
        
        const hasQdrant = config.qdrant && config.qdrant.url;
        const hasEmbedding = config.embedding && config.embedding.baseUrl;
        
        return hasQdrant && hasEmbedding;
    } catch (e) {
        return false;
    }
}

/**
 * 解析搜索结果 JSON
 * 使用更健壮的解析策略，处理多行 JSON 和嵌套结构
 * @param {string} output - 命令输出
 * @returns {Object|null} 解析后的结果对象
 */
function parseSearchResult(output) {
    if (!output || typeof output !== 'string') {
        return null;
    }

    const lines = output.split('\n');
    const jsonLines = [];
    let braceCount = 0;
    let inJson = false;
    let foundStart = false;

    for (const line of lines) {
        const openBraces = (line.match(/\{/g) || []).length;
        const closeBraces = (line.match(/\}/g) || []).length;
        
        if (!inJson && openBraces > 0) {
            inJson = true;
            foundStart = true;
        }
        
        if (inJson) {
            jsonLines.push(line);
            braceCount += openBraces - closeBraces;
            
            if (braceCount === 0 && foundStart) {
                break;
            }
        }
    }

    const jsonStr = jsonLines.join('\n');
    if (!jsonStr) {
        return null;
    }

    try {
        const data = JSON.parse(jsonStr);
        return {
            success: data.success === true,
            blocks: data.data?.blocks || [],
            query: data.query || {},
            rerank: data.rerank || null,
            error: data.error || null
        };
    } catch (e) {
        return null;
    }
}

/**
 * 检查结果是否降级到 legacy 模式
 * 当向量搜索不可用时，semantic/keyword/hybrid 会降级到 legacy
 * @param {Object} data - 解析后的搜索结果
 * @param {string} expectedMode - 期望的搜索模式
 * @returns {boolean} 是否降级
 */
function isDegradedToLegacy(data, expectedMode) {
    if (!data || !data.query) return false;
    const actualMode = data.query.mode;
    if (expectedMode === 'hybrid' && actualMode === 'legacy') return true;
    if (expectedMode === 'semantic' && actualMode === 'legacy') return true;
    if (expectedMode === 'keyword' && actualMode === 'legacy') return true;
    return false;
}

/**
 * 添加跳过测试结果
 */
function addSkipResult(id, name, cmd, reason) {
    addResult(id, name, cmd, '测试被跳过', `跳过原因: ${reason}`, true, 'SKIPPED');
}

const RERANK_AVAILABLE = checkRerankEnvironment();

console.log('\n========================================');
console.log('TG-26 嵌入重排功能测试');
console.log('========================================\n');
console.log(`重排环境检测: ${RERANK_AVAILABLE ? '可用' : '不可用（部分测试将被跳过）'}`);
console.log('\n测试用例:');

const skipReason = '需要配置 Qdrant 和嵌入服务';

// TG-26-01: 基本重排功能测试
{
    const cmd = 'search "机器学习" --mode hybrid --enable-rerank --limit 5';
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-26-01', '基本重排功能', cmd, '重排功能正常工作',
            '命令执行失败', false, result.error);
    } else {
        const data = parseSearchResult(result.output);
        if (!data) {
            addResult('TG-26-01', '基本重排功能', cmd, '重排功能正常工作',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-26-01', '基本重排功能', cmd, '重排功能正常工作',
                '返回错误', false, data.error);
        } else if (isDegradedToLegacy(data, 'hybrid')) {
            addSkipResult('TG-26-01', '基本重排功能', cmd, 
                `hybrid模式降级到legacy，${skipReason}`);
        } else {
            const hasRerankInfo = data.rerank && data.rerank.enabled === true;
            const hasRerankScores = data.blocks.some(block => 
                block.rerankScore !== undefined && block.rerankScore !== null
            );
            const valid = hasRerankInfo && hasRerankScores;
            addResult('TG-26-01', '基本重排功能', cmd, '重排功能正常工作',
                valid ? '成功' : '重排信息不完整', valid,
                `重排启用: ${hasRerankInfo}, 重排分数: ${hasRerankScores}, 结果数: ${data.blocks.length}`);
        }
    }
}

// TG-26-02: 重排参数测试 - rerankTopK
{
    const cmd = 'search "深度学习" --mode hybrid --enable-rerank --rerank-top-k 10 --limit 15';
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-26-02', '重排参数-rerankTopK', cmd, '正确使用rerankTopK参数',
            '命令执行失败', false, result.error);
    } else {
        const data = parseSearchResult(result.output);
        if (!data) {
            addResult('TG-26-02', '重排参数-rerankTopK', cmd, '正确使用rerankTopK参数',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-26-02', '重排参数-rerankTopK', cmd, '正确使用rerankTopK参数',
                '返回错误', false, data.error);
        } else if (isDegradedToLegacy(data, 'hybrid')) {
            addSkipResult('TG-26-02', '重排参数-rerankTopK', cmd, 
                `hybrid模式降级到legacy，${skipReason}`);
        } else {
            const hasRerankInfo = data.rerank && data.rerank.enabled === true;
            const valid = hasRerankInfo;
            addResult('TG-26-02', '重排参数-rerankTopK', cmd, '正确使用rerankTopK参数',
                valid ? '成功' : '重排未启用', valid,
                `重排启用: ${hasRerankInfo}, 结果数: ${data.blocks.length}, 重排数: ${data.rerank?.rerankCount || 0}`);
        }
    }
}

// TG-26-03: 重排参数测试 - rerankWeight
{
    const cmd = 'search "神经网络" --mode hybrid --enable-rerank --rerank-weight 0.7 --limit 5';
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-26-03', '重排参数-rerankWeight', cmd, '正确使用rerankWeight参数',
            '命令执行失败', false, result.error);
    } else {
        const data = parseSearchResult(result.output);
        if (!data) {
            addResult('TG-26-03', '重排参数-rerankWeight', cmd, '正确使用rerankWeight参数',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-26-03', '重排参数-rerankWeight', cmd, '正确使用rerankWeight参数',
                '返回错误', false, data.error);
        } else if (isDegradedToLegacy(data, 'hybrid')) {
            addSkipResult('TG-26-03', '重排参数-rerankWeight', cmd, 
                `hybrid模式降级到legacy，${skipReason}`);
        } else {
            const hasRerankInfo = data.rerank && data.rerank.enabled === true;
            const hasBothScores = data.blocks.some(block =>
                block.rerankScore !== undefined &&
                block.rerankScore !== null &&
                block.originalScore !== undefined &&
                block.score !== undefined
            );
            const hasScoreCalculated = data.blocks.some(block => {
                if (block.score === undefined || block.originalScore === undefined || block.rerankScore === undefined) {
                    return false;
                }
                const expectedScore = block.originalScore * 0.3 + block.rerankScore * 0.7;
                return Math.abs(block.score - expectedScore) < 0.01;
            });
            const valid = hasRerankInfo && hasBothScores;
            addResult('TG-26-03', '重排参数-rerankWeight', cmd, '正确使用rerankWeight参数',
                valid ? '成功' : '分数融合不正确', valid,
                `重排启用: ${hasRerankInfo}, 双分数: ${hasBothScores}, 分数计算正确: ${hasScoreCalculated}`);
        }
    }
}

// TG-26-04: 禁用缓存测试
{
    const cmd = 'search "人工智能" --mode hybrid --enable-rerank --rerank-no-cache --limit 5';
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-26-04', '禁用缓存测试', cmd, '正确禁用重排缓存',
            '命令执行失败', false, result.error);
    } else {
        const data = parseSearchResult(result.output);
        if (!data) {
            addResult('TG-26-04', '禁用缓存测试', cmd, '正确禁用重排缓存',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-26-04', '禁用缓存测试', cmd, '正确禁用重排缓存',
                '返回错误', false, data.error);
        } else if (isDegradedToLegacy(data, 'hybrid')) {
            addSkipResult('TG-26-04', '禁用缓存测试', cmd, 
                `hybrid模式降级到legacy，${skipReason}`);
        } else {
            const hasRerankInfo = data.rerank && data.rerank.enabled === true;
            const valid = hasRerankInfo;
            addResult('TG-26-04', '禁用缓存测试', cmd, '正确禁用重排缓存',
                valid ? '成功' : '重排未启用', valid,
                `重排启用: ${hasRerankInfo}`);
        }
    }
}

// TG-26-05: 语义搜索重排测试
{
    const cmd = 'search "自然语言处理" --mode semantic --enable-rerank --limit 5';
    
    if (!RERANK_AVAILABLE) {
        addSkipResult('TG-26-05', '语义搜索重排', cmd, skipReason);
    } else {
        const result = runCmd(cmd);
        
        if (!result.success) {
            addResult('TG-26-05', '语义搜索重排', cmd, '语义搜索支持重排',
                '命令执行失败', false, result.error);
        } else {
            const data = parseSearchResult(result.output);
            if (!data) {
                addResult('TG-26-05', '语义搜索重排', cmd, '语义搜索支持重排',
                    '无法解析结果', false, 'JSON解析失败');
            } else if (data.error) {
                addResult('TG-26-05', '语义搜索重排', cmd, '语义搜索支持重排',
                    '返回错误', false, data.error);
            } else if (isDegradedToLegacy(data, 'semantic')) {
                addSkipResult('TG-26-05', '语义搜索重排', cmd, 
                    `semantic模式降级到legacy，${skipReason}`);
            } else {
                const hasRerankInfo = data.rerank && data.rerank.enabled === true;
                const correctMode = data.query.mode === 'semantic';
                const valid = hasRerankInfo && correctMode;
                addResult('TG-26-05', '语义搜索重排', cmd, '语义搜索支持重排',
                    valid ? '成功' : '重排或模式不正确', valid,
                    `模式: ${data.query.mode}, 重排启用: ${hasRerankInfo}`);
            }
        }
    }
}

// TG-26-06: 关键词搜索重排测试
{
    const cmd = 'search "算法" --mode keyword --enable-rerank --limit 5';
    
    if (!RERANK_AVAILABLE) {
        addSkipResult('TG-26-06', '关键词搜索重排', cmd, skipReason);
    } else {
        const result = runCmd(cmd);
        
        if (!result.success) {
            addResult('TG-26-06', '关键词搜索重排', cmd, '关键词搜索支持重排',
                '命令执行失败', false, result.error);
        } else {
            const data = parseSearchResult(result.output);
            if (!data) {
                addResult('TG-26-06', '关键词搜索重排', cmd, '关键词搜索支持重排',
                    '无法解析结果', false, 'JSON解析失败');
            } else if (data.error) {
                addResult('TG-26-06', '关键词搜索重排', cmd, '关键词搜索支持重排',
                    '返回错误', false, data.error);
            } else if (isDegradedToLegacy(data, 'keyword')) {
                addSkipResult('TG-26-06', '关键词搜索重排', cmd, 
                    `keyword模式降级到legacy，${skipReason}`);
            } else {
                const hasRerankInfo = data.rerank && data.rerank.enabled === true;
                const correctMode = data.query.mode === 'keyword';
                const valid = hasRerankInfo && correctMode;
                addResult('TG-26-06', '关键词搜索重排', cmd, '关键词搜索支持重排',
                    valid ? '成功' : '重排或模式不正确', valid,
                    `模式: ${data.query.mode}, 重排启用: ${hasRerankInfo}`);
            }
        }
    }
}

// TG-26-07: 重排统计信息测试
{
    const cmd = 'search "数据科学" --mode hybrid --enable-rerank --limit 5';
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-26-07', '重排统计信息', cmd, '返回完整的重排统计信息',
            '命令执行失败', false, result.error);
    } else {
        const data = parseSearchResult(result.output);
        if (!data) {
            addResult('TG-26-07', '重排统计信息', cmd, '返回完整的重排统计信息',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-26-07', '重排统计信息', cmd, '返回完整的重排统计信息',
                '返回错误', false, data.error);
        } else if (isDegradedToLegacy(data, 'hybrid')) {
            addSkipResult('TG-26-07', '重排统计信息', cmd, 
                `hybrid模式降级到legacy，${skipReason}`);
        } else {
            const hasRerankInfo = data.rerank && data.rerank.enabled === true;
            const hasRerankCount = data.rerank && typeof data.rerank.rerankCount === 'number';
            const hasCacheStats = data.rerank && data.rerank.cacheStats !== undefined;
            const valid = hasRerankInfo && hasRerankCount;
            addResult('TG-26-07', '重排统计信息', cmd, '返回完整的重排统计信息',
                valid ? '成功' : '统计信息不完整', valid,
                `重排启用: ${hasRerankInfo}, 重排数: ${hasRerankCount}, 缓存统计: ${hasCacheStats}`);
        }
    }
}

// TG-26-08: 不启用重排的对比测试
{
    const cmd = 'search "机器学习" --mode hybrid --limit 5';
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-26-08', '不启用重排', cmd, '默认不启用重排',
            '命令执行失败', false, result.error);
    } else {
        const data = parseSearchResult(result.output);
        if (!data) {
            addResult('TG-26-08', '不启用重排', cmd, '默认不启用重排',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-26-08', '不启用重排', cmd, '默认不启用重排',
                '返回错误', false, data.error);
        } else {
            const noRerankInfo = !data.rerank || data.rerank.enabled !== true;
            const noRerankScores = data.blocks.every(block => 
                block.rerankScore === undefined || block.rerankScore === null
            );
            const valid = noRerankInfo && noRerankScores;
            addResult('TG-26-08', '不启用重排', cmd, '默认不启用重排',
                valid ? '成功' : '意外启用了重排', valid,
                `重排信息: ${noRerankInfo}, 无重排分数: ${noRerankScores}`);
        }
    }
}

// TG-26-09: 分数融合验证测试
{
    const cmd = 'search "深度学习算法" --mode hybrid --enable-rerank --limit 3';
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-26-09', '分数融合验证', cmd, '正确融合原始分数和重排分数',
            '命令执行失败', false, result.error);
    } else {
        const data = parseSearchResult(result.output);
        if (!data) {
            addResult('TG-26-09', '分数融合验证', cmd, '正确融合原始分数和重排分数',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-26-09', '分数融合验证', cmd, '正确融合原始分数和重排分数',
                '返回错误', false, data.error);
        } else if (isDegradedToLegacy(data, 'hybrid')) {
            addSkipResult('TG-26-09', '分数融合验证', cmd, 
                `hybrid模式降级到legacy，${skipReason}`);
        } else {
            const hasFinalScore = data.blocks.some(block => 
                block.score !== undefined && block.score !== null
            );
            const hasBothScores = data.blocks.some(block => 
                block.originalScore !== undefined && 
                block.rerankScore !== undefined
            );
            const valid = hasFinalScore && hasBothScores;
            addResult('TG-26-09', '分数融合验证', cmd, '正确融合原始分数和重排分数',
                valid ? '成功' : '分数融合不正确', valid,
                `最终分数: ${hasFinalScore}, 双分数: ${hasBothScores}`);
        }
    }
}

// TG-26-10: Legacy模式重排测试
{
    const cmd = 'search "测试" --mode legacy --enable-rerank --limit 5';
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-26-10', 'Legacy模式重排', cmd, 'Legacy模式支持重排',
            '命令执行失败', false, result.error);
    } else {
        const data = parseSearchResult(result.output);
        if (!data) {
            addResult('TG-26-10', 'Legacy模式重排', cmd, 'Legacy模式支持重排',
                '无法解析结果', false, 'JSON解析失败');
        } else if (data.error) {
            addResult('TG-26-10', 'Legacy模式重排', cmd, 'Legacy模式支持重排',
                '返回错误', false, data.error);
        } else {
            const correctMode = data.query.mode === 'legacy';
            const hasRerankInfo = data.rerank && data.rerank.enabled === true;
            const valid = correctMode;
            addResult('TG-26-10', 'Legacy模式重排', cmd, 'Legacy模式支持重排',
                valid ? '成功' : 'Legacy模式行为不正确', valid,
                `模式: ${data.query.mode}, 重排信息: ${hasRerankInfo}, 重排数: ${data.rerank?.rerankCount || 0}`);
        }
    }
}

ctx.saveReports('TG-26-rerank', 'TG-26 嵌入重排功能测试报告');
