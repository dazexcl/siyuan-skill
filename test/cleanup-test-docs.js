/**
 * 清理测试残留文档脚本
 */
const { execSync } = require('child_process');
const path = require('path');
const ConfigManager = require('../scripts/lib/config');

const SIYUAN_SKILL_DIR = path.join(__dirname, '..');

// 从配置中获取默认笔记本ID，环境变量优先
const configManager = new ConfigManager();
const config = configManager.getConfig();
const NOTEBOOK_ID = process.env.SIYUAN_DEFAULT_NOTEBOOK || config.defaultNotebook;

/**
 * 命令到脚本文件的映射
 */
const COMMAND_SCRIPT_MAP = {
    'content': 'content.js',
    'delete': 'delete.js',
    'ls': 'structure.js'
};

function runCmd(cmd) {
    try {
        const args = cmd.trim().split(/\s+/);
        const command = args[0];
        const commandArgs = args.slice(1);
        
        const scriptFile = COMMAND_SCRIPT_MAP[command];
        if (!scriptFile) {
            throw new Error(`未知命令: ${command}`);
        }
        
        const scriptPath = path.join(SIYUAN_SKILL_DIR, 'scripts', scriptFile);
        const output = execSync(`node "${scriptPath}" ${commandArgs.join(' ')}`, {
            encoding: 'utf-8',
            timeout: 30000,
            env: process.env,
            cwd: SIYUAN_SKILL_DIR
        });
        return { success: true, output: output.trim(), error: null };
    } catch (e) {
        return { success: false, output: e.stdout?.trim() || '', error: e.stderr?.trim() || e.message };
    }
}

function getDocTitle(docId) {
    const result = runCmd(`content ${docId} --raw`);
    const match = result.output.match(/title="([^"]+)"/);
    return match ? match[1] : null;
}

console.log('开始清理测试残留文档...\n');

const testDocPatterns = [
    'test_',
    'dup_test_',
    'force_test_',
    'target_doc',
    '测试笔记本',
    '自定义标题_'
];

const result = runCmd(`ls ${NOTEBOOK_ID}`);
if (!result.success) {
    console.error('无法获取笔记本结构');
    process.exit(1);
}

let data;
try {
    const jsonMatch = result.output.match(/\{[\s\S]*"type"\s*:\s*"notebook"[\s\S]*\}/);
    if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
    }
} catch (e) {
    console.error('解析JSON失败');
    process.exit(1);
}

if (!data || !data.data) {
    console.error('无数据');
    process.exit(1);
}

const docsToDelete = [];

function collectTestDocs(items, isFolder = false) {
    if (!items) return;
    
    for (const item of items) {
        const title = item.title || item.name;
        const isTest = testDocPatterns.some(p => title.includes(p) || title.startsWith(p));
        
        if (isTest) {
            docsToDelete.push({ id: item.id, title: title });
        }
        
        if (item.documents) {
            collectTestDocs(item.documents, false);
        }
        if (item.folders) {
            collectTestDocs(item.folders, true);
        }
    }
}

collectTestDocs(data.data.documents);
collectTestDocs(data.data.folders);

console.log(`发现 ${docsToDelete.length} 个测试文档需要清理:\n`);
docsToDelete.forEach(d => console.log(`  - ${d.title} (${d.id})`));
console.log('');

let deleted = 0;
let failed = 0;

for (const doc of docsToDelete) {
    const actualTitle = getDocTitle(doc.id);
    if (actualTitle) {
        const delResult = runCmd(`delete ${doc.id} --confirm-title "${actualTitle}"`);
        if (delResult.success) {
            console.log(`✓ 已删除: ${actualTitle}`);
            deleted++;
        } else {
            console.log(`✗ 删除失败: ${actualTitle} - ${delResult.error || delResult.output.substring(0, 100)}`);
            failed++;
        }
    } else {
        console.log(`- 文档已不存在: ${doc.title}`);
    }
}

console.log(`\n清理完成: 删除 ${deleted} 个, 失败 ${failed} 个`);
