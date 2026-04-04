/**
 * Siyuan Skill 测试运行器
 * - 解决中文乱码问题
 * - 每轮测试输出到独立文件夹（包含 log 和 md）
 * - 支持并行执行（默认并发数：4）
 * - 根文档模式：所有测试文档创建在一个根文档下，结束后统一删除
 */
const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TEST_DIR = __dirname;
const REPORT_BASE_DIR = path.join(TEST_DIR, 'reports');
const CONCURRENCY = parseInt(process.env.TEST_CONCURRENCY, 10) || 4;
const SIYUAN_JS = path.join(__dirname, '../.trae/skills/siyuan-skill/siyuan.js');
const NOTEBOOK_ID = process.env.SIYUAN_DEFAULT_NOTEBOOK || '20260227231831-yq1lxq2';

/**
 * 通过 API 创建根文档，返回文档 ID
 */
function createRootDoc(title) {
    const cmd = `node "${SIYUAN_JS}" create "${title}" "测试运行根文档" --parent-id ${NOTEBOOK_ID}`;
    const output = execSync(cmd, { encoding: 'utf-8', cwd: path.dirname(SIYUAN_JS) });
    const match = output.match(/"id"\s*:\s*"([^"]+)"/);
    if (!match) throw new Error(`创建根文档失败: ${output}`);
    return match[1];
}

/**
 * 通过 API 删除根文档（级联删除所有子文档）
 */
function deleteRootDoc(docId, title) {
    const cmd = `node "${SIYUAN_JS}" delete ${docId} --confirm-title "${title}"`;
    execSync(cmd, { encoding: 'utf-8', cwd: path.dirname(SIYUAN_JS) });
}

function createRunDirectory() {
    const now = new Date();
    const beijingTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const year = beijingTime.getFullYear();
    const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getDate()).padStart(2, '0');
    const hour = String(beijingTime.getHours()).padStart(2, '0');
    const min = String(beijingTime.getMinutes()).padStart(2, '0');
    const sec = String(beijingTime.getSeconds()).padStart(2, '0');
    const timestamp = `${year}-${month}-${day}_${hour}-${min}-${sec}`;
    const runDir = path.join(REPORT_BASE_DIR, `run-${timestamp}`);
    
    if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
    }
    
    return runDir;
}

function runTestFileAsync(testFile, runDir, rootDocId) {
    return new Promise((resolve) => {
        const testName = path.basename(testFile, '.js');
        const tgId = testName.replace(/^test-tg(?=\d)/i, 'TG-');
        const expectedLogName = `test-${tgId}.log`;
        
        exec(`node "${testFile}"`, {
            cwd: TEST_DIR,
            encoding: 'utf8',
            env: { ...process.env, REPORT_DIR: runDir, TEST_ROOT_DOC_ID: rootDocId },
            maxBuffer: 10 * 1024 * 1024
        }, (error, stdout, stderr) => {
            let output = stdout || stderr || '';
            let passed = 0;
            let failed = 0;
            let passRate = '0.00%';
            
            if (error) {
                output = error.stdout || error.stderr || error.message;
            }
            
            const match = output.match(/通过率[:\s]+(\d+\.?\d*)%?/);
            if (match) {
                passRate = match[1] + '%';
            }
            
            const passedMatch = output.match(/通过[:\s]+(\d+)/);
            const failedMatch = output.match(/失败[:\s]+(\d+)/);
            
            if (passedMatch) passed = parseInt(passedMatch[1], 10);
            if (failedMatch) failed = parseInt(failedMatch[1], 10);
            
            const reportMatch = output.match(/报告已保存:\s*[^\s]*[\\\/]([^\s]+\.md)/);
            const logMatch = output.match(/执行日志已保存:\s*[^\s]*[\\\/]([^\s]+\.log)/);
            const reportFile = reportMatch ? reportMatch[1] : null;
            const logFile = logMatch ? logMatch[1] : expectedLogName;
            
            const status = failed === 0 ? '✓' : '✗';
            console.log(`  ${status} ${testName}: ${passed}/${passed + failed} (${passRate})`);
            
            resolve({
                name: testName,
                passed,
                failed,
                passRate,
                reportFile,
                logFile
            });
        });
    });
}

async function runWithConcurrency(tasks, concurrency) {
    const results = [];
    const executing = new Set();
    
    for (const task of tasks) {
        const promise = task().then(result => {
            executing.delete(promise);
            return result;
        });
        
        executing.add(promise);
        results.push(promise);
        
        if (executing.size >= concurrency) {
            await Promise.race(executing);
        }
    }
    
    return Promise.all(results);
}

async function main() {
    console.log('========================================');
    console.log('Siyuan Skill 自动化测试 (并行模式)');
    console.log(`并发数: ${CONCURRENCY}`);
    console.log('========================================');
    
    const runDir = createRunDirectory();
    const runDirName = path.basename(runDir);
    console.log(`报告目录: ${runDir}`);
    
    let rootDocId = null;
    try {
        rootDocId = createRootDoc(runDirName);
        console.log(`根文档已创建: ${runDirName} (${rootDocId})`);
    } catch (e) {
        console.error(`创建根文档失败，回退到普通模式: ${e.message}`);
    }
    
    const testFiles = fs.readdirSync(TEST_DIR)
        .filter(f => f.startsWith('test-tg') && f.endsWith('.js'))
        .sort();
    
    console.log(`\n发现 ${testFiles.length} 个测试文件\n`);
    console.log('执行测试:');
    console.log('-'.repeat(50));
    
    const startTime = Date.now();
    
    const tasks = testFiles.map(file => () => runTestFileAsync(path.join(TEST_DIR, file), runDir, rootDocId));
    const results = await runWithConcurrency(tasks, CONCURRENCY);
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalTests = totalPassed + totalFailed;
    const overallRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : '0.00';
    
    const now = new Date();
    const beijingTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
    const timestamp = beijingTime.toLocaleString('zh-CN');
    
    let report = `# Siyuan Skill 自动化测试汇总报告

**测试时间**: ${timestamp}
**测试输出目录**: ${runDir}
**执行耗时**: ${elapsed}秒
**并发数**: ${CONCURRENCY}

## 概览

| 项目 | 数值 |
|------|------|
| 总测试数 | ${totalTests} |
| 通过数 | ${totalPassed} |
| 失败数 | ${totalFailed} |
| 通过率 | ${overallRate}% |

## 测试详情

| 测试文件 | 通过 | 失败 | 通过率 | 报告 |
|----------|------|------|--------|------|
`;

    for (const r of results) {
        report += `| ${r.name} | ${r.passed} | ${r.failed} | ${r.passRate} | ${r.reportFile || '-'} |\n`;
    }

    report += `
## 失败详情

`;

    const failedTests = results.filter(r => r.failed > 0);
    if (failedTests.length === 0) {
        report += '无失败测试\n';
    } else {
        for (const r of failedTests) {
            report += `### ${r.name}\n\n`;
            if (r.logFile) {
                report += `详细日志: ${r.logFile}\n\n`;
            }
        }
    }

    const summaryFile = path.join(runDir, 'summary.md');
    fs.writeFileSync(summaryFile, report, 'utf8');
    
    console.log('-'.repeat(50));
    console.log('\n测试汇总');
    console.log('========================================');
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${totalPassed}`);
    console.log(`失败: ${totalFailed}`);
    console.log(`通过率: ${overallRate}%`);
    console.log(`执行耗时: ${elapsed}秒`);
    console.log(`\n汇总报告: ${summaryFile}`);
    
    if (rootDocId) {
        console.log(`\n清理根文档: ${runDirName} (${rootDocId})...`);
        try {
            deleteRootDoc(rootDocId, runDirName);
            console.log('根文档已删除（所有测试文档级联清理完成）');
        } catch (e) {
            console.error(`根文档删除失败，需手动清理: ${e.message}`);
        }
    }
}

main().catch(console.error);
