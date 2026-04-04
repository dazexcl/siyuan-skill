/**
 * 测试框架公共模块
 * 提供统一的命令执行、日志记录、结果报告功能
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const SIYUAN_JS = path.join(__dirname, '../.trae/skills/siyuan-skill/siyuan.js');
const REAL_NOTEBOOK_ID = process.env.SIYUAN_DEFAULT_NOTEBOOK || '20260227231831-yq1lxq2';
const NOTEBOOK_ID = REAL_NOTEBOOK_ID;
const PARENT_ID = process.env.TEST_ROOT_DOC_ID || REAL_NOTEBOOK_ID;

/**
 * 将命令字符串解析为参数数组（支持双引号、单引号）
 * 避免通过 shell 执行导致换行符等特殊字符破坏参数边界
 * @param {string} cmd - 命令字符串
 * @returns {string[]} 参数数组
 */
function parseCommandString(cmd) {
    const args = [];
    let current = '';
    let i = 0;

    while (i < cmd.length) {
        const ch = cmd[i];

        if (ch === '"') {
            i++;
            while (i < cmd.length && cmd[i] !== '"') {
                current += cmd[i];
                i++;
            }
            i++;
        } else if (ch === "'") {
            i++;
            while (i < cmd.length && cmd[i] !== "'") {
                current += cmd[i];
                i++;
            }
            i++;
        } else if (ch === ' ' || ch === '\t') {
            if (current.length > 0) {
                args.push(current);
                current = '';
            }
            i++;
        } else {
            current += ch;
            i++;
        }
    }

    if (current.length > 0) {
        args.push(current);
    }

    return args;
}

/**
 * 创建测试上下文
 */
function createTestContext(testName) {
    const executionLog = [];
    const results = [];
    const createdDocs = [];
    
    executionLog.push(`${testName}`);
    executionLog.push(`开始时间: ${new Date().toLocaleString('zh-CN')}`);
    executionLog.push(`笔记本: ${NOTEBOOK_ID}`);
    
    /**
     * 执行命令并记录日志
     * 使用 execFileSync 绕过 shell，避免换行符等特殊字符破坏参数边界
     */
    function runCmd(cmd) {
        const timestamp = new Date().toISOString().substring(11, 23);
        
        executionLog.push(`\n[${timestamp}] >>> node siyuan.js ${cmd}`);
        executionLog.push('-'.repeat(60));
        
        try {
            const args = parseCommandString(cmd);
            const output = execFileSync('node', [SIYUAN_JS, ...args], {
                encoding: 'utf-8',
                timeout: 60000,
                env: process.env,
                cwd: path.dirname(SIYUAN_JS)
            });
            const result = { success: true, output: output.trim(), error: null };
            executionLog.push(result.output);
            return result;
        } catch (e) {
            const result = { success: false, output: e.stdout?.trim() || '', error: e.stderr?.trim() || e.message };
            executionLog.push(`[ERROR] ${result.error}`);
            if (result.output) executionLog.push(result.output);
            return result;
        }
    }
    
    /**
     * 添加测试结果
     */
    function addResult(id, name, cmd, expected, actual, passed, details) {
        results.push({ id, name, cmd, expected, actual, passed, details: details || '' });
        console.log(`  ${id}: ${name} ... ${passed ? '✓ 通过' : '✗ 失败'}`);
        if (!passed) {
            console.log(`    执行命令: node siyuan.js ${cmd}`);
            console.log(`    预期: ${expected}`);
            console.log(`    实际: ${actual}`);
            if (details) console.log(`    详情: ${details}`);
        }
    }
    
    /**
     * 从输出提取文档ID
     */
    function extractDocId(output) {
        const match = output.match(/"id"\s*:\s*"([^"]+)"/);
        return match ? match[1] : null;
    }
    
    /**
     * 获取文档标题
     */
    function getDocTitle(docId) {
        const result = runCmd(`content ${docId} --raw`);
        const match = result.output.match(/title="([^"]+)"/);
        return match ? match[1] : null;
    }
    
    /**
     * 获取文档路径（不含笔记本名称）
     * 用于将 parent-id 转换为路径，拼接到 --path 参数前
     */
    function getDocPath(docId) {
        const result = runCmd(`convert --id ${docId}`);
        if (!result.success) return null;
        const pathMatch = result.output.match(/"path"\s*:\s*"([^"]+)"/);
        const notebookNameMatch = result.output.match(/"notebookName"\s*:\s*"([^"]+)"/);
        if (!pathMatch || !notebookNameMatch) return null;
        
        let path = pathMatch[1];
        const notebookName = notebookNameMatch[1];
        const prefix = `/${notebookName}/`;
        if (path.startsWith(prefix)) {
            path = path.substring(prefix.length);
        } else if (path.startsWith(`/${notebookName}`)) {
            path = path.substring(`/${notebookName}`.length);
        }
        return path;
    }
    
    /**
     * 构建完整路径
     * 将父文档路径与相对路径拼接
     */
    function buildPath(relativePath) {
        if (!process.env.TEST_ROOT_DOC_ID) {
            return relativePath;
        }
        const parentPath = getDocPath(PARENT_ID);
        if (!parentPath) {
            return relativePath;
        }
        const normalizedParent = parentPath.replace(/^\/+|\/+$/g, '');
        const normalizedRelative = relativePath.replace(/^\/+|\/+$/g, '');
        return `${normalizedParent}/${normalizedRelative}`;
    }
    
    /**
     * 睡眠函数
     */
    function sleep(ms) {
        const start = Date.now();
        while (Date.now() - start < ms) {}
    }
    
    /**
     * 清理详情文本（用于表格显示）
     */
    function sanitizeDetails(details, maxLen = 50) {
        if (!details) return '-';
        return details
            .replace(/[\r\n]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, maxLen);
    }
    
    /**
     * 生成并保存报告
     */
    function saveReports(testId, testTitle) {
        const reportDir = process.env.REPORT_DIR || path.join(__dirname, 'reports');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }
        
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        const total = results.length;
        const passRate = ((passed / total) * 100).toFixed(2);
        
        // 控制台报告
        console.log('\n----------------------------------------');
        console.log('测试报告');
        console.log('----------------------------------------');
        console.log(`\n总计: ${total} | 通过: ${passed} | 失败: ${failed} | 通过率: ${passRate}%\n`);
        
        console.log('| 测试ID | 测试名称 | 执行命令 | 状态 | 验证详情 |');
        console.log('|--------|----------|----------|------|----------|');
        results.forEach(r => {
            const details = sanitizeDetails(r.details);
            console.log(`| ${r.id} | ${r.name} | \`node siyuan.js ${r.cmd}\` | ${r.passed ? '✓ 通过' : '✗ 失败'} | ${details} |`);
        });
        
        if (failed > 0) {
            console.log('\n## 失败详情\n');
            results.filter(r => !r.passed).forEach(r => {
                console.log(`### ${r.id}: ${r.name}`);
                console.log(`- 执行命令: \`node siyuan.js ${r.cmd}\``);
                console.log(`- 预期结果: ${r.expected}`);
                console.log(`- 实际结果: ${r.actual}`);
                if (r.details) console.log(`- 详情: ${r.details}`);
                console.log('');
            });
        }
        
        // MD 报告
        const reportContent = `# ${testTitle}

测试时间: ${new Date().toLocaleString('zh-CN')}

## 概览

| 项目 | 数值 |
|------|------|
| 总用例 | ${total} |
| 通过 | ${passed} |
| 失败 | ${failed} |
| 通过率 | ${passRate}% |

## 详细结果

| 测试ID | 测试名称 | 执行命令 | 状态 | 验证详情 |
|--------|----------|----------|------|----------|
${results.map(r => `| ${r.id} | ${r.name} | \`node siyuan.js ${r.cmd}\` | ${r.passed ? '✓ 通过' : '✗ 失败'} | ${sanitizeDetails(r.details)} |`).join('\n')}

${failed > 0 ? `
## 失败详情

${results.filter(r => !r.passed).map(r => `### ${r.id}: ${r.name}
- 执行命令: \`node siyuan.js ${r.cmd}\`
- 预期结果: ${r.expected}
- 实际结果: ${r.actual}
${r.details ? `- 详情: ${r.details}` : ''}
`).join('\n')}
` : ''}
`;
        
        const reportFile = path.join(reportDir, `${testId}-${Date.now()}.md`);
        fs.writeFileSync(reportFile, reportContent, 'utf8');
        console.log(`\n报告已保存: ${reportFile}`);
        
        // 执行日志
        executionLog.push(`\n\n结束时间: ${new Date().toLocaleString('zh-CN')}`);
        executionLog.push(`通过: ${passed}, 失败: ${failed}, 通过率: ${passRate}%`);
        
        const logFile = path.join(reportDir, `test-${testId}.log`);
        fs.writeFileSync(logFile, executionLog.join('\n'), 'utf8');
        console.log(`执行日志已保存: ${logFile}`);
        
        return { passed, failed, total, passRate };
    }
    
    /**
     * 清理测试文档
     * 当使用根文档模式（TEST_ROOT_DOC_ID）时，跳过删除——由 run-all-tests.js 统一删除根文档
     * 否则逐个删除注册的根级文档
     */
    function cleanup() {
        if (process.env.TEST_ROOT_DOC_ID) {
            console.log(`\n根文档模式：跳过清理（由测试运行器统一删除根文档 ${process.env.TEST_ROOT_DOC_ID}）`);
            return;
        }
        console.log('\n清理测试数据...');
        const rootDocsOnly = createdDocs.filter(doc => !doc.isChild);
        for (const doc of rootDocsOnly) {
            const actualTitle = getDocTitle(doc.id);
            const titleToDelete = actualTitle || doc.title;
            if (titleToDelete) {
                runCmd(`delete ${doc.id} --confirm-title "${titleToDelete}"`);
            }
        }
        console.log(`清理了 ${rootDocsOnly.length} 个根文档（子文档自动级联删除）`);
    }
    
    return {
        runCmd,
        addResult,
        extractDocId,
        getDocTitle,
        getDocPath,
        buildPath,
        sleep,
        saveReports,
        cleanup,
        results,
        createdDocs,
        executionLog,
        NOTEBOOK_ID,
        PARENT_ID
    };
}

module.exports = {
    createTestContext,
    SIYUAN_JS,
    NOTEBOOK_ID,
    PARENT_ID
};
