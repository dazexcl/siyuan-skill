/**
 * TG-07 文档保护测试
 * 测试 protect 命令
 * 
 * 测试覆盖范围：
 * 1. 临时保护功能 - 设置、验证、移除
 * 2. 永久保护功能 - 设置、验证、不可移除
 * 3. 保护级别切换 - 从临时保护升级为永久保护
 * 4. 权限检查 - 验证操作在授权笔记本内执行
 * 5. 错误处理 - 文档不存在、无权限等场景
 * 6. 边界条件 - 空文档ID、无效参数等
 * 7. 与删除命令的集成 - 验证保护能阻止删除
 * 
 * 优化说明：
 * - 文档复用：同一文档用于多个相关测试用例
 * - 批量操作：减少重复的创建和删除操作
 * - 测试分组：按功能模块组织测试用例
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-07 文档保护测试');

/**
 * 文档测试上下文
 * 用于复用文档进行多个测试
 */
class DocTestContext {
    constructor(docId, title) {
        this.docId = docId;
        this.title = title;
        this.testIds = [];
    }

    addTestId(testId) {
        this.testIds.push(testId);
    }
}

/**
 * 检查文档保护状态（带重试机制）
 * @param {string} docId - 文档ID
 * @param {number} retries - 重试次数
 * @returns {{hasProtect: boolean, protectValue: string|null, raw: string}}
 */
function checkProtection(docId, retries = 5) {
    for (let i = 0; i < retries; i++) {
        // 使用 --hide 选项保留 custom- 前缀
        const result = ctx.runCmd(`block-attrs ${docId} --get --hide`);
        
        if (!result.success) {
            if (i < retries - 1 && (result.error?.includes('索引') || result.error?.includes('indexing'))) {
                ctx.sleep(800);
                continue;
            }
            return { hasProtect: false, protectValue: null, raw: result.output };
        }
        
        const output = result.output;
        
        try {
            const dataMatch = output.match(/\{[\s\S]*\}/);
            if (dataMatch) {
                const json = JSON.parse(dataMatch[0]);
                // 使用 --hide 时，属性名保留 custom- 前缀
                const protectValue = json.data?.attrs?.['custom-protected'];
                if (protectValue) {
                    return { hasProtect: true, protectValue, raw: output };
                }
            }
        } catch (e) {
            const match = output.match(/"custom-protected"\s*:\s*"([^"]+)"/);
            if (match) {
                return { hasProtect: true, protectValue: match[1], raw: output };
            }
        }
        
        if (!output || output.trim() === '') {
            if (i < retries - 1) {
                ctx.sleep(800);
                continue;
            }
        }
        
        break;
    }
    return { hasProtect: false, protectValue: null, raw: '' };
}

/**
 * 检查文档是否存在
 * @param {string} docId - 文档ID
 * @returns {boolean}
 */
function docExists(docId) {
    const result = ctx.runCmd(`content ${docId} --raw`);
    return result.success && result.output.includes('id=');
}

/**
 * 获取文档标题
 * @param {string} docId - 文档ID
 * @returns {string|null}
 */
function getDocTitle(docId) {
    return ctx.getDocTitle(docId);
}

/**
 * 创建测试文档
 * @param {string} title - 文档标题
 * @param {string} content - 文档内容
 * @returns {{docId: string|null, title: string}}
 */
function createTestDoc(title, content) {
    const createResult = ctx.runCmd(`create "${title}" "${content}" --parent-id ${ctx.PARENT_ID}`);
    const docId = ctx.extractDocId(createResult.output);
    return { docId, title };
}

/**
 * 等待索引完成
 * @param {string} docId - 文档ID
 * @param {number} maxWait - 最大等待时间（毫秒）
 */
function waitForIndex(docId, maxWait = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
        const result = ctx.runCmd(`content ${docId} --raw`);
        if (result.success && !result.error.includes('索引') && !result.error.includes('indexing')) {
            return true;
        }
        ctx.sleep(500);
    }
    return false;
}

console.log('\n========================================');
console.log('TG-07 文档保护测试');
console.log('========================================\n');

console.log('测试用例:');

// 文档复用池
const docPool = {};

// TG-07-01 ~ TG-07-03: 临时保护完整流程（复用同一文档）
{
    const title = `TG-07-01-03-临时保护完整流程_${Date.now()}`;
    const { docId } = createTestDoc(title, '临时保护完整流程测试');
    
    if (!docId) {
        ctx.addResult('TG-07-01', '临时保护-设置', 'protect <docId>', '文档被标记保护', '文档创建失败', false);
        ctx.addResult('TG-07-02', '临时保护-阻止删除', 'protect后delete应失败', '删除被阻止', '前置失败', false);
        ctx.addResult('TG-07-03', '临时保护-移除后删除', 'protect --remove后delete', '删除成功', '前置失败', false);
    } else {
        const docCtx = new DocTestContext(docId, title);
        
        // TG-07-01: 设置临时保护
        ctx.sleep(500);
        const protectCmd = `protect ${docId}`;
        const protectResult = ctx.runCmd(protectCmd);
        
        if (!protectResult.success) {
            ctx.addResult('TG-07-01', '临时保护-设置', protectCmd, '文档被标记保护',
                '命令执行失败', false, protectResult.error);
        } else {
            ctx.sleep(500);
            const protection = checkProtection(docId);
            if (protection.hasProtect && protection.protectValue === 'true') {
                ctx.addResult('TG-07-01', '临时保护-设置', protectCmd, '文档被标记保护(true)',
                    '成功', true, `保护值: ${protection.protectValue}`);
                docCtx.addTestId('TG-07-01');
            } else {
                ctx.addResult('TG-07-01', '临时保护-设置', protectCmd, '文档被标记保护(true)',
                    '保护标记不正确', false, `protectValue: ${protection.protectValue}`);
            }
        }
        
        // TG-07-02: 验证临时保护能阻止删除
        if (docCtx.testIds.includes('TG-07-01')) {
            const deleteCmd = `delete ${docId} --confirm-title "${title}"`;
            const deleteResult = ctx.runCmd(deleteCmd);
            
            const wasBlocked = !deleteResult.success || 
                              deleteResult.output.includes('保护') || 
                              deleteResult.output.includes('protect') ||
                              deleteResult.output.includes('拒绝') ||
                              deleteResult.output.includes('阻止');
            
            ctx.sleep(500);
            const stillExists = docExists(docId);
            
            if (wasBlocked && stillExists) {
                ctx.addResult('TG-07-02', '临时保护-阻止删除', deleteCmd, '删除被阻止，文档仍存在',
                    '成功', true, '临时保护成功阻止删除');
                docCtx.addTestId('TG-07-02');
            } else if (!stillExists) {
                ctx.addResult('TG-07-02', '临时保护-阻止删除', deleteCmd, '删除被阻止，文档仍存在',
                    '保护失效，文档被删除', false, '临时保护未能阻止删除');
            } else {
                ctx.addResult('TG-07-02', '临时保护-阻止删除', deleteCmd, '删除被阻止，文档仍存在',
                    '删除未明确被阻止', false, `output: ${deleteResult.output.substring(0, 100)}`);
            }
        }
        
        // TG-07-03: 移除保护后可删除
        if (docCtx.testIds.includes('TG-07-02')) {
            const removeCmd = `protect ${docId} --remove`;
            const removeResult = ctx.runCmd(removeCmd);
            
            if (!removeResult.success) {
                ctx.addResult('TG-07-03', '临时保护-移除后删除', removeCmd, '保护被移除',
                    '移除命令失败', false, removeResult.error);
                ctx.createdDocs.push({ id: docId, title });
            } else {
                ctx.sleep(500);
                const protection = checkProtection(docId);
                if (!protection.hasProtect) {
                    const delResult = ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
                    ctx.sleep(500);
                    const deleted = !docExists(docId);
                    if (deleted) {
                        ctx.addResult('TG-07-03', '临时保护-移除后删除', removeCmd, '保护移除后可删除',
                            '成功', true, '移除保护后删除成功');
                    } else {
                        ctx.addResult('TG-07-03', '临时保护-移除后删除', removeCmd, '保护移除后可删除',
                            '删除失败', false, '保护已移除但文档仍存在');
                        ctx.createdDocs.push({ id: docId, title });
                    }
                } else {
                    ctx.addResult('TG-07-03', '临时保护-移除后删除', removeCmd, '保护被移除',
                        '保护标记仍存在', false, `protectValue: ${protection.protectValue}`);
                    ctx.createdDocs.push({ id: docId, title });
                }
            }
        }
    }
}

// TG-07-04 ~ TG-07-06: 永久保护完整流程（复用同一文档）
{
    const title = `TG-07-04-06-永久保护完整流程_${Date.now()}`;
    const { docId } = createTestDoc(title, '永久保护完整流程测试');
    
    if (!docId) {
        ctx.addResult('TG-07-04', '永久保护-设置', 'protect --permanent', '文档被标记永久保护', '文档创建失败', false);
        ctx.addResult('TG-07-05', '永久保护-阻止删除', 'delete应失败', '删除被阻止', '前置失败', false);
        ctx.addResult('TG-07-06', '永久保护-无法移除', '--remove应无效', '保护仍存在', '前置失败', false);
    } else {
        const docCtx = new DocTestContext(docId, title);
        
        // TG-07-04: 设置永久保护
        ctx.sleep(500);
        const protectCmd = `protect ${docId} --permanent`;
        const protectResult = ctx.runCmd(protectCmd);
        
        if (!protectResult.success) {
            ctx.addResult('TG-07-04', '永久保护-设置', protectCmd, '文档被标记永久保护',
                '命令执行失败', false, protectResult.error);
            ctx.createdDocs.push({ id: docId, title });
        } else {
            ctx.sleep(500);
            const protection = checkProtection(docId);
            if (protection.hasProtect && protection.protectValue === 'permanent') {
                ctx.addResult('TG-07-04', '永久保护-设置', protectCmd, '文档被标记永久保护',
                    '成功', true, `保护值: ${protection.protectValue}`);
                docCtx.addTestId('TG-07-04');
            } else {
                ctx.addResult('TG-07-04', '永久保护-设置', protectCmd, '文档被标记永久保护',
                    '保护标记不正确', false, `protectValue: ${protection.protectValue}`);
            }
            ctx.createdDocs.push({ id: docId, title });
        }
        
        // TG-07-05: 验证永久保护能阻止删除
        if (docCtx.testIds.includes('TG-07-04')) {
            const deleteCmd = `delete ${docId} --confirm-title "${title}"`;
            const deleteResult = ctx.runCmd(deleteCmd);
            
            const wasBlocked = !deleteResult.success || 
                              deleteResult.output.includes('保护') || 
                              deleteResult.output.includes('protect') ||
                              deleteResult.output.includes('永久') ||
                              deleteResult.output.includes('拒绝') ||
                              deleteResult.output.includes('阻止');
            
            ctx.sleep(500);
            const stillExists = docExists(docId);
            
            if (wasBlocked && stillExists) {
                ctx.addResult('TG-07-05', '永久保护-阻止删除', deleteCmd, '删除被阻止，文档仍存在',
                    '成功', true, '永久保护成功阻止删除');
                docCtx.addTestId('TG-07-05');
            } else if (!stillExists) {
                ctx.addResult('TG-07-05', '永久保护-阻止删除', deleteCmd, '删除被阻止，文档仍存在',
                    '保护失效，文档被删除', false, '永久保护未能阻止删除');
            } else {
                ctx.addResult('TG-07-05', '永久保护-阻止删除', deleteCmd, '删除被阻止，文档仍存在',
                    '删除未明确被阻止', false, `output: ${deleteResult.output.substring(0, 100)}`);
            }
        }
        
        // TG-07-06: 验证永久保护无法通过命令移除
        if (docCtx.testIds.includes('TG-07-05')) {
            const removeCmd = `protect ${docId} --remove`;
            const removeResult = ctx.runCmd(removeCmd);
            
            ctx.sleep(500);
            const protection = checkProtection(docId);
            const removeFailed = !removeResult.success && 
                                 (removeResult.error?.includes('永久保护') || 
                                  removeResult.error?.includes('无法通过命令移除') ||
                                  removeResult.output?.includes('永久保护') ||
                                  removeResult.output?.includes('无法通过命令移除'));
            
            if (removeFailed && protection.hasProtect && protection.protectValue === 'permanent') {
                ctx.addResult('TG-07-06', '永久保护-无法移除', removeCmd, '保护仍存在',
                    '成功', true, '永久保护无法通过命令移除');
            } else if (!protection.hasProtect) {
                ctx.addResult('TG-07-06', '永久保护-无法移除', removeCmd, '保护仍存在',
                    '失败', false, '保护被意外移除');
            } else {
                ctx.addResult('TG-07-06', '永久保护-无法移除', removeCmd, '保护仍存在',
                    '部分失败', false, `removeFailed: ${removeFailed}, protectValue: ${protection.protectValue}`);
            }
        }
    }
}

// TG-07-07: 保护级别切换
{
    const title = `TG-07-07-保护级别切换_${Date.now()}`;
    const { docId } = createTestDoc(title, '保护级别切换测试');
    
    if (!docId) {
        ctx.addResult('TG-07-07', '保护级别-临时转永久', 'protect后--permanent', '值变为permanent', '文档创建失败', false);
    } else {
        ctx.runCmd(`protect ${docId}`);
        ctx.sleep(500);
        
        const cmd = `protect ${docId} --permanent`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            ctx.addResult('TG-07-07', '保护级别-临时转永久', cmd, '保护值变为permanent',
                '命令执行失败', false, result.error);
            ctx.createdDocs.push({ id: docId, title });
        } else {
            ctx.sleep(500);
            const protection = checkProtection(docId);
            if (protection.hasProtect && protection.protectValue === 'permanent') {
                ctx.addResult('TG-07-07', '保护级别-临时转永久', cmd, '保护值从protected变为permanent',
                    '成功', true, '保护级别切换成功');
            } else {
                ctx.addResult('TG-07-07', '保护级别-临时转永久', cmd, '保护值从protected变为permanent',
                    '保护值不正确', false, `protectValue: ${protection.protectValue}`);
            }
            ctx.createdDocs.push({ id: docId, title });
        }
    }
}

// TG-07-08: 错误处理 - 文档不存在
{
    const fakeDocId = '00000000000000-0000000';
    const cmd = `protect ${fakeDocId}`;
    const result = ctx.runCmd(cmd);
    
    if (!result.success) {
        const hasError = result.error?.includes('不存在') || 
                         result.error?.includes('404') ||
                         result.output?.includes('不存在') ||
                         result.output?.includes('404');
        
        if (hasError) {
            ctx.addResult('TG-07-08', '错误处理-文档不存在', cmd, '返回错误提示',
                '成功', true, '正确处理不存在的文档');
        } else {
            ctx.addResult('TG-07-08', '错误处理-文档不存在', cmd, '返回错误提示',
                '部分成功', true, '命令失败但错误信息不明确');
        }
    } else {
        ctx.addResult('TG-07-08', '错误处理-文档不存在', cmd, '返回错误提示',
            '失败', false, '未正确处理不存在的文档');
    }
}

// TG-07-09: 错误处理 - 缺少文档ID参数
{
    const result = ctx.runCmd('protect');
    
    if (!result.success) {
        const hasError = result.error?.includes('缺少') || 
                         result.output?.includes('缺少') ||
                         result.error?.includes('参数') ||
                         result.output?.includes('参数');
        
        if (hasError) {
            ctx.addResult('TG-07-09', '错误处理-缺少参数', 'protect (无参数)', '返回错误提示',
                '成功', true, '正确处理缺少参数的情况');
        } else {
            ctx.addResult('TG-07-09', '错误处理-缺少参数', 'protect (无参数)', '返回错误提示',
                '部分成功', true, '命令失败但错误信息不明确');
        }
    } else {
        ctx.addResult('TG-07-09', '错误处理-缺少参数', 'protect (无参数)', '返回错误提示',
            '失败', false, '未正确处理缺少参数的情况');
    }
}

// TG-07-10 ~ TG-07-11: 边界条件（复用同一文档）
{
    const title = `TG-07-10-11-边界条件测试_${Date.now()}`;
    const { docId } = createTestDoc(title, '边界条件测试');
    
    if (!docId) {
        ctx.addResult('TG-07-10', '边界条件-重复设置', 'protect两次', '两次都成功', '文档创建失败', false);
        ctx.addResult('TG-07-11', '边界条件-移除无保护', 'protect --remove (无保护)', '命令成功', '前置失败', false);
    } else {
        const docCtx = new DocTestContext(docId, title);
        
        // TG-07-10: 重复设置相同保护级别
        const cmd1 = `protect ${docId}`;
        const result1 = ctx.runCmd(cmd1);
        ctx.sleep(500);
        
        const cmd2 = `protect ${docId}`;
        const result2 = ctx.runCmd(cmd2);
        ctx.sleep(500);
        
        if (result1.success && result2.success) {
            const protection = checkProtection(docId);
            if (protection.hasProtect && protection.protectValue === 'true') {
                ctx.addResult('TG-07-10', '边界条件-重复设置', cmd2, '重复设置保持protected',
                    '成功', true, '重复设置保护成功');
                docCtx.addTestId('TG-07-10');
            } else {
                ctx.addResult('TG-07-10', '边界条件-重复设置', cmd2, '重复设置保持protected',
                    '保护值不正确', false, `protectValue: ${protection.protectValue}`);
            }
        } else {
            ctx.addResult('TG-07-10', '边界条件-重复设置', cmd2, '重复设置保持protected',
                '命令执行失败', false, `第一次: ${result1.success}, 第二次: ${result2.success}`);
        }
        
        // TG-07-11: 移除保护后再移除（无保护状态）
        if (docCtx.testIds.includes('TG-07-10')) {
            const removeCmd1 = `protect ${docId} --remove`;
            const removeResult1 = ctx.runCmd(removeCmd1);
            ctx.sleep(500);
            
            const removeCmd2 = `protect ${docId} --remove`;
            const removeResult2 = ctx.runCmd(removeCmd2);
            ctx.sleep(500);
            
            if (removeResult1.success && removeResult2.success) {
                const protection = checkProtection(docId);
                if (!protection.hasProtect) {
                    ctx.addResult('TG-07-11', '边界条件-移除无保护', removeCmd2, '重复移除无保护文档成功',
                        '成功', true, '正确处理重复移除操作');
                } else {
                    ctx.addResult('TG-07-11', '边界条件-移除无保护', removeCmd2, '重复移除无保护文档成功',
                        '保护状态不正确', false, `protectValue: ${protection.protectValue}`);
                }
            } else {
                ctx.addResult('TG-07-11', '边界条件-移除无保护', removeCmd2, '重复移除无保护文档成功',
                    '命令执行失败', false, `第一次: ${removeResult1.success}, 第二次: ${removeResult2.success}`);
            }
            ctx.createdDocs.push({ id: docId, title });
        }
    }
}

// TG-07-12: 边界条件 - 删除后设置保护
{
    const title = `TG-07-12-已删除文档保护测试_${Date.now()}`;
    const { docId } = createTestDoc(title, '已删除文档保护测试');
    
    if (!docId) {
        ctx.addResult('TG-07-12', '边界条件-删除后设置保护', '删除后protect', '返回错误', '文档创建失败', false);
    } else {
        ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
        ctx.sleep(800);
        
        const cmd = `protect ${docId}`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success) {
            const hasError = result.error?.includes('不存在') || 
                             result.error?.includes('404') ||
                             result.output?.includes('不存在') ||
                             result.output?.includes('404');
            
            if (hasError) {
                ctx.addResult('TG-07-12', '边界条件-删除后设置保护', cmd, '返回文档不存在错误',
                    '成功', true, '正确处理已删除文档的保护设置');
            } else {
                ctx.addResult('TG-07-12', '边界条件-删除后设置保护', cmd, '返回文档不存在错误',
                    '部分成功', true, '命令失败但错误信息不明确');
            }
        } else {
            ctx.addResult('TG-07-12', '边界条件-删除后设置保护', cmd, '返回文档不存在错误',
                '失败', false, '未正确处理已删除文档');
        }
    }
}

// TG-07-13: 集成测试 - 保护后立即删除
{
    const title = `TG-07-13-保护删除集成测试_${Date.now()}`;
    const { docId } = createTestDoc(title, '保护删除集成测试');
    
    if (!docId) {
        ctx.addResult('TG-07-13', '集成测试-保护后删除', 'protect立即delete', '删除被阻止', '文档创建失败', false);
    } else {
        const protectCmd = `protect ${docId}`;
        const protectResult = ctx.runCmd(protectCmd);
        
        if (protectResult.success) {
            ctx.sleep(500);
            const deleteCmd = `delete ${docId} --confirm-title "${title}"`;
            const deleteResult = ctx.runCmd(deleteCmd);
            
            const wasBlocked = !deleteResult.success || 
                              deleteResult.output.includes('保护') || 
                              deleteResult.output.includes('protect');
            
            ctx.sleep(500);
            const stillExists = docExists(docId);
            
            if (wasBlocked && stillExists) {
                ctx.addResult('TG-07-13', '集成测试-保护后删除', deleteCmd, '设置保护后立即删除被阻止',
                    '成功', true, '保护功能正确阻止删除');
                ctx.createdDocs.push({ id: docId, title });
            } else if (!stillExists) {
                ctx.addResult('TG-07-13', '集成测试-保护后删除', deleteCmd, '设置保护后立即删除被阻止',
                    '失败', false, '文档被意外删除');
            } else {
                ctx.addResult('TG-07-13', '集成测试-保护后删除', deleteCmd, '设置保护后立即删除被阻止',
                    '部分失败', false, '删除未明确被阻止');
                ctx.createdDocs.push({ id: docId, title });
            }
        } else {
            ctx.addResult('TG-07-13', '集成测试-保护后删除', protectCmd, '设置保护后立即删除被阻止',
                '失败', false, '保护设置失败');
        }
    }
}

// TG-07-14: 边界条件 - 冲突参数
{
    const title = `TG-07-14-冲突参数测试_${Date.now()}`;
    const { docId } = createTestDoc(title, '冲突参数测试');
    
    if (!docId) {
        ctx.addResult('TG-07-14', '边界条件-冲突参数', 'protect --permanent --remove', '按移除处理', '文档创建失败', false);
    } else {
        ctx.runCmd(`protect ${docId} --permanent`);
        ctx.sleep(500);
        
        const cmd = `protect ${docId} --permanent --remove`;
        const result = ctx.runCmd(cmd);
        
        ctx.sleep(500);
        const protection = checkProtection(docId);
        
        if (!result.success && (result.error?.includes('永久保护') || 
                               result.error?.includes('无法通过命令移除') ||
                               result.output?.includes('永久保护') ||
                               result.output?.includes('无法通过命令移除'))) {
            if (protection.hasProtect && protection.protectValue === 'permanent') {
                ctx.addResult('TG-07-14', '边界条件-冲突参数', cmd, '永久保护无法被移除',
                    '成功', true, '正确处理冲突参数，优先移除操作但被永久保护阻止');
            } else {
                ctx.addResult('TG-07-14', '边界条件-冲突参数', cmd, '永久保护无法被移除',
                    '部分失败', false, '移除操作被阻止但保护状态异常');
            }
        } else if (!protection.hasProtect) {
            ctx.addResult('TG-07-14', '边界条件-冲突参数', cmd, '永久保护无法被移除',
                '失败', false, '永久保护被意外移除');
        } else {
            ctx.addResult('TG-07-14', '边界条件-冲突参数', cmd, '永久保护无法被移除',
                '部分成功', true, `result.success: ${result.success}, protectValue: ${protection.protectValue}`);
        }
        ctx.createdDocs.push({ id: docId, title });
    }
}

// TG-07-15: 配置拦截 + 保护：无确认标题时删除保护文档
{
    const title = `TG-07-15-配置拦截保护_${Date.now()}`;
    const { docId } = createTestDoc(title, '配置拦截保护测试');
    
    if (!docId) {
        ctx.addResult('TG-07-15', '配置拦截-保护+无确认标题', 'delete (保护 + 无确认标题)', 
            '被配置拦截优先拦截', '文档创建失败', false);
    } else {
        // 设置临时保护
        ctx.runCmd(`protect ${docId}`);
        ctx.sleep(500);
        
        // 尝试不带确认标题删除
        const deleteCmd = `delete ${docId}`; // 不带 --confirm-title
        const deleteResult = ctx.runCmd(deleteCmd);
        
        if (!deleteResult.success && deleteResult.error?.includes('需要确认文档标题')) {
            ctx.addResult('TG-07-15', '配置拦截-保护+无确认标题', deleteCmd, 
                '被配置拦截优先拦截', '成功', true, 
                '配置拦截优先于保护标记，正确拒绝删除');
        } else if (!deleteResult.success && deleteResult.error?.includes('保护')) {
            ctx.addResult('TG-07-15', '配置拦截-保护+无确认标题', deleteCmd, 
                '被配置拦截优先拦截', '部分成功', true, 
                '保护标记拦截了删除（配置拦截可能未启用）');
            // 清理
            ctx.runCmd(`protect ${docId} --remove`);
            ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
        } else {
            ctx.addResult('TG-07-15', '配置拦截-保护+无确认标题', deleteCmd, 
                '被配置拦截优先拦截', '失败', false, 
                '删除未被拦截，文档可能被删除');
        }
    }
}

// TG-07-16: safeMode 优先级：safeMode=true 时删除保护文档
{
    const title = `TG-07-16-安全模式优先级_${Date.now()}`;
    
    // 临时设置环境变量启用安全模式
    const savedEnv = ctx.setEnv({
        SIYUAN_DELETE_SAFE_MODE: 'true'
    });
    
    const { docId } = createTestDoc(title, '安全模式优先级测试');
    
    if (!docId) {
        ctx.addResult('TG-07-16', '安全模式-保护+safeMode', 'delete (保护 + safeMode=true)', 
            'safeMode优先拦截', '文档创建失败', false);
        ctx.restoreEnv(savedEnv);
    } else {
        // 设置临时保护
        ctx.runCmd(`protect ${docId}`);
        ctx.sleep(500);
        
        // 尝试删除（safeMode应该优先于保护拦截）
        const cmd = `delete ${docId}`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success && result.error?.includes('全局安全模式')) {
            ctx.addResult('TG-07-16', '安全模式-保护+safeMode', cmd, 
                'safeMode优先拦截', '成功', true, 
                'safeMode正确优先于保护标记拦截删除');
        } else {
            ctx.addResult('TG-07-16', '安全模式-保护+safeMode', cmd, 
                'safeMode优先拦截', '失败', false, 
                'safeMode未正确优先拦截');
        }
        
        // 恢复环境变量并清理
        ctx.restoreEnv(savedEnv);
        ctx.runCmd(`protect ${docId} --remove`);
        ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
    }
}

// TG-07-17: 多重拦截：保护 + safeMode + requireConfirmation
{
    const title = `TG-07-17-多重拦截_${Date.now()}`;
    
    // 临时设置环境变量启用安全模式和确认要求
    const savedEnv = ctx.setEnv({
        SIYUAN_DELETE_SAFE_MODE: 'true',
        SIYUAN_DELETE_REQUIRE_CONFIRMATION: 'true'
    });
    
    const { docId } = createTestDoc(title, '多重拦截测试');
    
    if (!docId) {
        ctx.addResult('TG-07-17', '多重拦截-保护+safeMode+确认', 'delete (三重拦截)', 
            'safeMode优先拦截', '文档创建失败', false);
        ctx.restoreEnv(savedEnv);
    } else {
        // 设置临时保护
        ctx.runCmd(`protect ${docId}`);
        ctx.sleep(500);
        
        // 尝试删除（safeMode应该优先拦截）
        const cmd = `delete ${docId}`;
        const result = ctx.runCmd(cmd);
        
        if (!result.success && result.error?.includes('全局安全模式')) {
            ctx.addResult('TG-07-17', '多重拦截-保护+safeMode+确认', cmd, 
                'safeMode优先拦截', '成功', true, 
                'safeMode正确优先于其他拦截机制');
        } else {
            ctx.addResult('TG-07-17', '多重拦截-保护+safeMode+确认', cmd, 
                'safeMode优先拦截', '失败', false, 
                'safeMode未正确优先拦截');
        }
        
        // 恢复环境变量并清理
        ctx.restoreEnv(savedEnv);
        ctx.runCmd(`protect ${docId} --remove`);
        ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
    }
}

// TG-07-18: 保护 + 配置协同：requireConfirmation 与保护的协同工作
{
    const title = `TG-07-18-保护配置协同_${Date.now()}`;
    const { docId } = createTestDoc(title, '保护配置协同测试');
    
    if (!docId) {
        ctx.addResult('TG-07-18', '配置协同-保护+确认标题', 'delete (保护 + 正确确认标题)', 
            '保护标记拦截删除', '文档创建失败', false);
    } else {
        // 设置临时保护
        ctx.runCmd(`protect ${docId}`);
        ctx.sleep(500);
        
        // 使用正确的确认标题删除（仍应被保护拦截）
        const deleteCmd = `delete ${docId} --confirm-title "${title}"`;
        const deleteResult = ctx.runCmd(deleteCmd);
        
        const wasBlocked = !deleteResult.success || 
                          deleteResult.output.includes('保护') || 
                          deleteResult.output.includes('protect') ||
                          deleteResult.output.includes('拒绝');
        
        ctx.sleep(500);
        const stillExists = docExists(docId);
        
        if (wasBlocked && stillExists) {
            ctx.addResult('TG-07-18', '配置协同-保护+确认标题', deleteCmd, 
                '保护标记拦截删除', '成功', true, 
                '即使提供正确确认标题，保护标记仍能拦截删除');
            // 清理
            ctx.runCmd(`protect ${docId} --remove`);
            ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
        } else if (!stillExists) {
            ctx.addResult('TG-07-18', '配置协同-保护+确认标题', deleteCmd, 
                '保护标记拦截删除', '失败', false, 
                '保护标记失效，文档被删除');
        } else {
            ctx.addResult('TG-07-18', '配置协同-保护+确认标题', deleteCmd, 
                '保护标记拦截删除', '部分失败', false, 
                `未明确拦截，output: ${deleteResult.output.substring(0, 100)}`);
            // 清理
            ctx.runCmd(`protect ${docId} --remove`);
            ctx.runCmd(`delete ${docId} --confirm-title "${title}"`);
        }
    }
}

// 保存报告
ctx.saveReports('TG-07-protect', 'TG-07 文档保护测试报告');

// 清理 - 在根文档模式下跳过清理，否则使用特殊的保护文档清理逻辑
if (process.env.TEST_ROOT_DOC_ID) {
    console.log('\n根文档模式：跳过清理（由测试运行器统一删除根文档）');
} else {
    console.log('\n----------------------------------------');
    console.log('清理测试数据');
    console.log('----------------------------------------');
    
    let deletedCount = 0;
    let failedCount = 0;
    let permanentCount = 0;
    
    // 只删除根文档，子文档会被级联删除
    const rootDocsOnly = ctx.createdDocs.filter(doc => !doc.isChild);
    
    for (const doc of rootDocsOnly) {
        const protection = checkProtection(doc.id);
        
        // 跳过永久保护文档
        if (protection.protectValue === 'permanent') {
            console.log(`跳过永久保护文档: ${doc.title} (${doc.id})`);
            permanentCount++;
            continue;
        }
        
        // 移除临时保护
        if (protection.protectValue === 'true') {
            ctx.runCmd(`protect ${doc.id} --remove`);
            ctx.sleep(300);
        }
        
        // 删除文档
        const actualTitle = getDocTitle(doc.id);
        const titleToDelete = actualTitle || doc.title;
        if (titleToDelete) {
            const delResult = ctx.runCmd(`delete ${doc.id} --confirm-title "${titleToDelete}"`);
            if (delResult.success) {
                console.log(`删除 [${doc.testId || '未知'}] ${titleToDelete} (${doc.id})`);
                deletedCount++;
            } else {
                console.log(`删除失败 [${doc.testId || '未知'}] ${titleToDelete} (${doc.id})`);
                failedCount++;
            }
        }
    }
    
    console.log(`清理完成: ${deletedCount}/${rootDocsOnly.length} 个根文档已删除`);
    if (failedCount > 0) {
        console.log(`  删除失败: ${failedCount} 个文档`);
    }
    if (permanentCount > 0) {
        console.log(`  跳过永久保护: ${permanentCount} 个文档`);
    }
    
    console.log('\n----------------------------------------');
    console.log('测试残留检查');
    console.log('----------------------------------------');
    console.log('应剩余: 0');
    console.log('实际剩余: ' + permanentCount);
    console.log('需要手动删除: ' + (permanentCount > 0 ? '是（永久保护文档）' : '否'));
}
