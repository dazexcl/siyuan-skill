/**
 * TG-07 文档保护测试
 * 测试 protect 命令
 * 验证：
 * 1. 临时保护能正确设置/移除
 * 2. 临时保护能阻止删除
 * 3. 永久保护能正确设置
 * 4. 永久保护能阻止删除
 * 5. 永久保护无法通过命令移除
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-07 文档保护测试');

function checkProtection(docId) {
    const result = ctx.runCmd(`ba ${docId} --get`);
    if (!result.success) return { hasProtect: false, protectValue: null, raw: result.output };
    const output = result.output;
    const match = output.match(/"protected"\s*:\s*"([^"]+)"/);
    if (match) {
        return { hasProtect: true, protectValue: match[1], raw: output };
    }
    return { hasProtect: false, protectValue: null, raw: output };
}

function docExists(docId) {
    const result = ctx.runCmd(`content ${docId} --raw`);
    return result.success && result.output.includes('id=');
}

console.log('\n========================================');
console.log('TG-07 文档保护测试');
console.log('========================================\n');

console.log('测试用例:');

// TG-07-01: 临时保护 - 设置并验证标记
{
    const title = `test_temp_protect_${Date.now()}`;
    const createResult = ctx.runCmd(`create "${title}" "临时保护测试" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-07-01', '临时保护-设置', 'protect <docId>', '文档被标记保护', '文档创建失败', false);
    } else {
        ctx.createdDocs.push({ id: docId, title });
        const cmd = `protect ${docId}`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-07-01', '临时保护-设置', cmd, '文档被标记保护',
                '命令执行失败', false, result.error);
        } else {
            const protection = checkProtection(docId);
            if (protection.hasProtect && protection.protectValue === 'true') {
                ctx.addResult('TG-07-01', '临时保护-设置', cmd, '文档被标记保护(protected=true)',
                    '成功', true, `保护值: ${protection.protectValue}`);
            } else {
                ctx.addResult('TG-07-01', '临时保护-设置', cmd, '文档被标记保护(protected=true)',
                    '保护标记不正确', false, `protectValue: ${protection.protectValue}`);
            }
        }
    }
}

// TG-07-02: 临时保护 - 验证能阻止删除
{
    const title = `test_temp_protect_block_${Date.now()}`;
    const createResult = ctx.runCmd(`create "${title}" "临时保护阻止删除测试" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-07-02', '临时保护-阻止删除', 'protect后delete应失败', '删除被阻止', '文档创建失败', false);
    } else {
        ctx.runCmd(`protect ${docId}`);
        const cmd = `delete ${docId} --confirm-title "${title}"`;
        const result = ctx.runCmd(cmd);
        
        const wasBlocked = !result.success || 
                          result.output.includes('保护') || 
                          result.output.includes('protect') ||
                          result.output.includes('拒绝') ||
                          result.output.includes('阻止');
        
        ctx.sleep(300);
        const stillExists = docExists(docId);
        
        if (wasBlocked && stillExists) {
            ctx.addResult('TG-07-02', '临时保护-阻止删除', cmd, '删除被阻止，文档仍存在',
                '成功', true, '临时保护成功阻止删除');
            ctx.createdDocs.push({ id: docId, title });
        } else if (!stillExists) {
            ctx.addResult('TG-07-02', '临时保护-阻止删除', cmd, '删除被阻止，文档仍存在',
                '保护失效，文档被删除', false, '临时保护未能阻止删除');
        } else {
            ctx.addResult('TG-07-02', '临时保护-阻止删除', cmd, '删除被阻止，文档仍存在',
                '删除未明确被阻止', false, `output: ${result.output.substring(0, 100)}`);
            ctx.createdDocs.push({ id: docId, title });
        }
    }
}

// TG-07-03: 临时保护 - 移除后可删除
{
    const title = `test_temp_unprotect_${Date.now()}`;
    const createResult = ctx.runCmd(`create "${title}" "移除保护后删除测试" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-07-03', '临时保护-移除后删除', 'protect --remove后delete', '删除成功', '文档创建失败', false);
    } else {
        ctx.runCmd(`protect ${docId}`);
        const cmd = `protect ${docId} --remove`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-07-03', '临时保护-移除后删除', cmd, '保护被移除',
                '移除命令失败', false, result.error);
            ctx.createdDocs.push({ id: docId, title });
        } else {
            const protection = checkProtection(docId);
            if (!protection.hasProtect) {
                const delResult = ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
                ctx.sleep(300);
                const deleted = !docExists(docId);
                if (deleted) {
                    ctx.addResult('TG-07-03', '临时保护-移除后删除', cmd, '保护移除后可删除',
                        '成功', true, '移除保护后删除成功');
                } else {
                    ctx.addResult('TG-07-03', '临时保护-移除后删除', cmd, '保护移除后可删除',
                        '删除失败', false, '保护已移除但文档仍存在');
                    ctx.createdDocs.push({ id: docId, title });
                }
            } else {
                ctx.addResult('TG-07-03', '临时保护-移除后删除', cmd, '保护被移除',
                    '保护标记仍存在', false, `protectValue: ${protection.protectValue}`);
                ctx.createdDocs.push({ id: docId, title });
            }
        }
    }
}

// TG-07-04/05/06: 永久保护 - 复用同一文档测试设置、阻止删除、无法移除
{
    const title = `test_perm_protect_${Date.now()}`;
    const createResult = ctx.runCmd(`create "${title}" "永久保护测试" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    
    if (!docId) {
        ctx.addResult('TG-07-04', '永久保护-设置', 'protect --permanent', '文档被标记永久保护', '文档创建失败', false);
        ctx.addResult('TG-07-05', '永久保护-阻止删除', 'delete应失败', '删除被阻止', '前置失败', false);
        ctx.addResult('TG-07-06', '永久保护-无法移除', '--remove应无效', '保护仍存在', '前置失败', false);
    } else {
        // TG-07-04: 设置永久保护
        const cmd04 = `protect ${docId} --permanent`;
        const result04 = ctx.runCmd(cmd04);
        
        if (!result04.success) {
            ctx.addResult('TG-07-04', '永久保护-设置', cmd04, '文档被标记永久保护',
                '命令执行失败', false, result04.error);
        } else {
            const protection = checkProtection(docId);
            if (protection.hasProtect && protection.protectValue === 'permanent') {
                ctx.addResult('TG-07-04', '永久保护-设置', cmd04, '文档被标记永久保护(protected=permanent)',
                    '成功', true, `保护值: ${protection.protectValue}`);
            } else {
                ctx.addResult('TG-07-04', '永久保护-设置', cmd04, '文档被标记永久保护(protected=permanent)',
                    '保护标记不正确', false, `protectValue: ${protection.protectValue}`);
            }
        }
        
        // TG-07-05: 验证永久保护能阻止删除
        const cmd05 = `delete ${docId} --confirm-title "${title}"`;
        const result05 = ctx.runCmd(cmd05);
        
        const wasBlocked = !result05.success || 
                          result05.output.includes('保护') || 
                          result05.output.includes('protect') ||
                          result05.output.includes('永久') ||
                          result05.output.includes('拒绝') ||
                          result05.output.includes('阻止');
        
        ctx.sleep(300);
        const stillExists = docExists(docId);
        
        if (wasBlocked && stillExists) {
            ctx.addResult('TG-07-05', '永久保护-阻止删除', cmd05, '删除被阻止，文档仍存在',
                '成功', true, '永久保护成功阻止删除');
        } else if (!stillExists) {
            ctx.addResult('TG-07-05', '永久保护-阻止删除', cmd05, '删除被阻止，文档仍存在',
                '保护失效，文档被删除', false, '永久保护未能阻止删除');
        } else {
            ctx.addResult('TG-07-05', '永久保护-阻止删除', cmd05, '删除被阻止，文档仍存在',
                '删除未明确被阻止', false, `output: ${result05.output.substring(0, 100)}`);
        }
        
        // TG-07-06: 验证永久保护无法通过命令移除
        const cmd06 = `protect ${docId} --remove`;
        const result06 = ctx.runCmd(cmd06);
        
        const protection = checkProtection(docId);
        if (protection.hasProtect && protection.protectValue === 'permanent') {
            ctx.addResult('TG-07-06', '永久保护-无法移除', cmd06, '保护仍存在(protected=permanent)',
                '成功', true, '永久保护无法通过命令移除');
        } else if (!protection.hasProtect) {
            ctx.addResult('TG-07-06', '永久保护-无法移除', cmd06, '保护仍存在(protected=permanent)',
                '保护被移除了', false, '永久保护不应能被移除');
        } else {
            ctx.addResult('TG-07-06', '永久保护-无法移除', cmd06, '保护仍存在(protected=permanent)',
                '保护值改变', false, `protectValue: ${protection.protectValue}`);
        }
        
        ctx.createdDocs.push({ id: docId, title });
    }
}

// 清理 - 需要先移除临时保护才能删除
console.log('\n清理测试数据...');
for (const doc of ctx.createdDocs) {
    const protection = checkProtection(doc.id);
    if (protection.protectValue === 'true') {
        ctx.runCmd(`protect ${doc.id} --remove`);
    }
    if (protection.protectValue !== 'permanent') {
        const actualTitle = ctx.getDocTitle(doc.id);
        if (actualTitle) {
            const delResult = ctx.runCmd(`delete ${doc.id} --confirm-title "${actualTitle}"`);
            if (delResult.success) {
                console.log(`删除测试文档: ${doc.id}`);
            }
        }
    }
}

const permanentDocs = ctx.createdDocs.filter(doc => {
    const p = checkProtection(doc.id);
    return p.protectValue === 'permanent';
});
if (permanentDocs.length > 0) {
    console.log(`\n注意: ${permanentDocs.length} 个永久保护文档需要手动在思源中解除保护后删除`);
}

ctx.saveReports('TG-07-protect', 'TG-07 文档保护测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: ' + permanentDocs.length);
console.log('需要手动删除: ' + (permanentDocs.length > 0 ? '是（永久保护文档）' : '否'));
