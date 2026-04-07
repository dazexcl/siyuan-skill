/**
 * 测试框架公共模块
 * 提供统一的命令执行、日志记录、结果报告功能
 */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const ConfigManager = require('../scripts/lib/config');

const SIYUAN_SKILL_DIR = path.join(__dirname, '../');

// 从配置中获取默认笔记本ID，环境变量优先
const configManager = new ConfigManager();
const config = configManager.getConfig();
const REAL_NOTEBOOK_ID = process.env.SIYUAN_DEFAULT_NOTEBOOK || config.defaultNotebook;
const NOTEBOOK_ID = REAL_NOTEBOOK_ID;
const PARENT_ID = process.env.TEST_ROOT_DOC_ID || REAL_NOTEBOOK_ID;

// 根文档模式：由 run-all-tests.js 统一管理文档清理
const IS_ROOT_DOC_MODE = !!process.env.TEST_ROOT_DOC_ID;

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
 * 命令到脚本文件的映射
 */
const COMMAND_SCRIPT_MAP = {
    'notebooks': 'notebooks.js',
    'structure': 'structure.js',
    'content': 'content.js',
    'info': 'info.js',
    'create': 'create.js',
    'update': 'update.js',
    'delete': 'delete.js',
    'move': 'move.js',
    'rename': 'rename.js',
    'protect': 'protect.js',
    'exists': 'exists.js',
    'convert': 'convert.js',
    'icon': 'icon.js',
    'block-get': 'block-get.js',
    'block-insert': 'block-insert.js',
    'block-update': 'block-update.js',
    'block-delete': 'block-delete.js',
    'block-move': 'block-move.js',
    'block-fold': 'block-fold.js',
    'block-transfer': 'block-transfer.js',
    'block-attrs': 'block-attrs.js',
    'search': 'search.js',
    'tags': 'tags.js',
    'index': 'index.js',
    'nlp': 'nlp.js'
};

/**
 * 执行命令并记录日志
 * 使用 execFileSync 绕过 shell，避免换行符等特殊字符破坏参数边界
 */
function runCmd(cmd) {
    const timestamp = new Date().toISOString().substring(11, 23);
    
    executionLog.push(`\n[${timestamp}] >>> node scripts/${cmd.split(' ')[0]}.js ${cmd.split(' ').slice(1).join(' ')}`);
    executionLog.push('-'.repeat(60));
    
    try {
        const args = parseCommandString(cmd);
        const command = args[0];
        const commandArgs = args.slice(1);
        
        const scriptFile = COMMAND_SCRIPT_MAP[command];
        if (!scriptFile) {
            throw new Error(`未知命令: ${command}`);
        }
        
        const scriptPath = path.join(SIYUAN_SKILL_DIR, 'scripts', scriptFile);
        
        const output = execFileSync('node', [scriptPath, ...commandArgs], {
            encoding: 'utf8',
            timeout: 60000,
            env: { ...process.env }, // 确保所有环境变量都被传递
            cwd: SIYUAN_SKILL_DIR,
            stdio: ['pipe', 'pipe', 'pipe']
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
            const command = cmd.split(' ')[0];
            const args = cmd.split(' ').slice(1).join(' ');
            console.log(`    执行命令: node scripts/${command}.js ${args}`);
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
     * 从输出提取中间目录ID列表
     */
    function extractIntermediateDirectories(output) {
        const match = output.match(/"intermediateDirectories"\s*:\s*\[([\s\S]*?)\]/);
        if (!match) return [];
        
        const arrayContent = match[1];
        const idMatches = arrayContent.match(/"([a-z0-9-]+)"/g);
        return idMatches ? idMatches.map(id => id.replace(/"/g, '')) : [];
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
     * 将父文档路径与相对路径拼接，包含笔记本名称
     */
    function buildPath(relativePath) {
        // 获取笔记本名称
        const notebooksResult = runCmd('notebooks');
        let notebookName = null;
        
        if (notebooksResult.success) {
            const notebookMatch = notebooksResult.output.match(new RegExp(`"id"\\s*:\\s*"${NOTEBOOK_ID}"[\\s\\S]*?"name"\\s*:\\s*"([^"]+)"`));
            if (notebookMatch) {
                notebookName = notebookMatch[1];
            }
        }
        
        if (!notebookName) {
            console.warn(`警告: 无法获取笔记本 ${NOTEBOOK_ID} 的名称`);
            return relativePath;
        }
        
        // 如果有 TEST_ROOT_DOC_ID，则拼接父文档路径
        if (process.env.TEST_ROOT_DOC_ID) {
            const parentPath = getDocPath(PARENT_ID);
            if (parentPath) {
                const normalizedParent = parentPath.replace(/^\/+|\/+$/g, '');
                const normalizedRelative = relativePath.replace(/^\/+|\/+$/g, '');
                return `/${notebookName}/${normalizedParent}/${normalizedRelative}`;
            }
        }
        
        // 直接拼接笔记本名称和相对路径
        const normalizedRelative = relativePath.replace(/^\/+|\/+$/g, '');
        return `/${notebookName}/${normalizedRelative}`;
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
            const command = r.cmd.split(' ')[0];
            const args = r.cmd.split(' ').slice(1).join(' ');
            const sanitizedArgs = sanitizeDetails(args);
            const displayArgs = sanitizedArgs.length > 80 ? sanitizedArgs.substring(0, 80) + '...' : sanitizedArgs;
            console.log(`| ${r.id} | ${r.name} | \`node scripts/${command}.js ${displayArgs}\` | ${r.passed ? '✓ 通过' : '✗ 失败'} | ${details} |`);
        });
        
        if (failed > 0) {
            console.log('\n## 失败详情\n');
            results.filter(r => !r.passed).forEach(r => {
                const command = r.cmd.split(' ')[0];
                const args = r.cmd.split(' ').slice(1).join(' ');
                const sanitizedArgs = sanitizeDetails(args);
                const displayArgs = sanitizedArgs.length > 50 ? sanitizedArgs.substring(0, 50) + '...' : sanitizedArgs;
                console.log(`### ${r.id}: ${r.name}`);
                console.log(`- 执行命令: \`node scripts/${command}.js ${displayArgs}\``);
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
${results.map(r => {
    const command = r.cmd.split(' ')[0];
    const args = r.cmd.split(' ').slice(1).join(' ');
    const sanitizedArgs = sanitizeDetails(args);
    const displayArgs = sanitizedArgs.length > 120 ? sanitizedArgs.substring(0, 120) + '...' : sanitizedArgs;
    return `| ${r.id} | ${r.name} | \`node scripts/${command}.js ${displayArgs}\` | ${r.passed ? '✓ 通过' : '✗ 失败'} | ${sanitizeDetails(r.details)} |`;
}).join('\n')}

${failed > 0 ? `
## 失败详情

${results.filter(r => !r.passed).map(r => {
    const command = r.cmd.split(' ')[0];
    const args = r.cmd.split(' ').slice(1).join(' ');
    const sanitizedArgs = sanitizeDetails(args);
    const displayArgs = sanitizedArgs.length > 80 ? sanitizedArgs.substring(0, 80) + '...' : sanitizedArgs;
    return `### ${r.id}: ${r.name}
- 执行命令: \`node scripts/${command}.js ${displayArgs}\`
- 预期结果: ${r.expected}
- 实际结果: ${r.actual}
${r.details ? `- 详情: ${r.details}` : ''}`;
}).join('\n')}
` : ''}`;
        
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
            const testId = doc.testId || '未知';
            if (titleToDelete) {
                console.log(`  删除 [${testId}] ${titleToDelete} (${doc.id})`);
                runCmd(`delete ${doc.id} --confirm-title "${titleToDelete}"`);
            }
        }
        console.log(`清理了 ${rootDocsOnly.length} 个根文档（子文档自动级联删除）`);
    }
    
    /**
     * 设置环境变量
     * @param {Object} envVars - 环境变量对象
     */
    function setEnv(envVars) {
        const savedVars = {};
        for (const [key, value] of Object.entries(envVars)) {
            savedVars[key] = process.env[key];
            if (value !== null && value !== undefined) {
                process.env[key] = String(value);
            } else {
                delete process.env[key];
            }
        }
        return savedVars;
    }
    
    /**
     * 恢复环境变量
     * @param {Object} savedVars - 保存的环境变量
     */
    function restoreEnv(savedVars) {
        for (const [key, value] of Object.entries(savedVars)) {
            if (value !== null && value !== undefined) {
                process.env[key] = value;
            } else {
                delete process.env[key];
            }
        }
    }

    return {
        runCmd,
        addResult,
        extractDocId,
        extractIntermediateDirectories,
        getDocTitle,
        getDocPath,
        buildPath,
        sleep,
        saveReports,
        cleanup,
        setEnv,
        restoreEnv,
        results,
        createdDocs,
        executionLog,
        NOTEBOOK_ID,
        PARENT_ID
    };
}

module.exports = {
    createTestContext,
    SIYUAN_SKILL_DIR,
    NOTEBOOK_ID,
    PARENT_ID
};
