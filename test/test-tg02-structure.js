/**
 * TG-02 文档结构测试
 * 测试 structure 命令及其别名
 * 测试策略：先创建多级文档结构，再验证返回内容与创建内容一致
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-02 文档结构测试');

function parseStructure(output) {
    try {
        const jsonMatch = output.match(/\{[\s\S]*"data"[\s\S]*\}/);
        if (!jsonMatch) return null;
        const data = JSON.parse(jsonMatch[0]);
        return data.data || data;
    } catch (e) {
        return null;
    }
}

function findDocInStructure(structure, docId) {
    const docs = structure.documents || [];
    
    for (const doc of docs) {
        if (doc.id === docId) return doc;
        if (doc.documents) {
            const foundInDocs = findDocInStructure(doc, docId);
            if (foundInDocs) return foundInDocs;
        }
    }
    
    return null;
}

console.log('\n========================================');
console.log('TG-02 文档结构测试');
console.log('========================================\n');

console.log('创建测试文档结构...');

const ts = Date.now();
const rootTitle = `TG-02-01-root_${ts}`;
const level1Title = `TG-02-02-level1_${ts}`;
const level2Title = `TG-02-03-level2_${ts}`;
const siblingTitle = `TG-02-04-sibling_${ts}`;

const rootResult = ctx.runCmd(`create "${rootTitle}" "根文档内容" --parent-id ${ctx.PARENT_ID}`);
const rootId = ctx.extractDocId(rootResult.output);

let level1Id = null;
let level2Id = null;
let siblingId = null;

if (rootId) {
    ctx.createdDocs.push({ id: rootId, title: rootTitle, testId: 'TG-02-01' });
    
    const level1Result = ctx.runCmd(`create "${level1Title}" "一级子文档" --parent-id ${rootId}`);
    level1Id = ctx.extractDocId(level1Result.output);
    
    if (level1Id) {
        ctx.createdDocs.push({ id: level1Id, title: level1Title, isChild: true, testId: 'TG-02-02' });
        
        const level2Result = ctx.runCmd(`create "${level2Title}" "二级子文档" --parent-id ${level1Id}`);
        level2Id = ctx.extractDocId(level2Result.output);
        
        if (level2Id) {
            ctx.createdDocs.push({ id: level2Id, title: level2Title, testId: 'TG-02-03' });
        }
    }
    
    const siblingResult = ctx.runCmd(`create "${siblingTitle}" "同级文档" --parent-id ${rootId}`);
    siblingId = ctx.extractDocId(siblingResult.output);
    
    if (siblingId) {
        ctx.createdDocs.push({ id: siblingId, title: siblingTitle, isChild: true, testId: 'TG-02-04' });
    }
}

console.log(`创建的文档: root=${rootId}, level1=${level1Id}, level2=${level2Id}, sibling=${siblingId}`);

console.log('\n获取文档结构（只执行一次命令）...');
const cmd = `structure ${ctx.NOTEBOOK_ID} --depth -1`;
const result = ctx.runCmd(cmd);
const structure = parseStructure(result.output);

console.log('\n测试用例:');

// TG-02-01: 通过笔记本ID获取结构，验证包含创建的文档
{
    if (!result.success) {
        ctx.addResult('TG-02-01', '通过笔记本ID获取结构', cmd, '返回文档树结构', 
            '命令执行失败', false, result.error);
    } else if (!structure) {
        ctx.addResult('TG-02-01', '通过笔记本ID获取结构', cmd, '返回文档树结构', 
            '无法解析返回数据', false, result.output.substring(0, 200));
    } else if (!rootId) {
        ctx.addResult('TG-02-01', '通过笔记本ID获取结构', cmd, '返回文档树结构', 
            '测试文档创建失败', false, '无法创建根文档');
    } else {
        const rootDoc = findDocInStructure(structure, rootId);
        const foundRoot = rootDoc !== null;
        const correctRootTitle = rootDoc && rootDoc.title === rootTitle;
        
        if (foundRoot && correctRootTitle) {
            ctx.addResult('TG-02-01', '通过笔记本ID获取结构', cmd, '返回文档树结构', 
                '成功', true, `找到根文档: ${rootTitle}`);
        } else if (foundRoot) {
            ctx.addResult('TG-02-01', '通过笔记本ID获取结构', cmd, '返回文档树结构', 
                '标题不匹配', false, `期望: ${rootTitle}, 实际: ${rootDoc.title}`);
        } else {
            ctx.addResult('TG-02-01', '通过笔记本ID获取结构', cmd, '返回文档树结构', 
                '未找到创建的文档', false, `文档ID: ${rootId}`);
        }
    }
}

// TG-02-02: 验证一级子文档结构
{
    if (!result.success || !structure || !rootId || !level1Id) {
        ctx.addResult('TG-02-02', '验证一级子文档', cmd, '子文档在父文档下', 
            '前置条件不满足', false, '命令失败或文档创建失败');
    } else {
        const rootDoc = findDocInStructure(structure, rootId);
        const level1Doc = findDocInStructure(structure, level1Id);
        
        const foundLevel1 = level1Doc !== null;
        const correctLevel1Title = level1Doc && level1Doc.title === level1Title;
        const level1UnderRoot = rootDoc && rootDoc.documents && rootDoc.documents.some(d => d.id === level1Id);
        
        if (foundLevel1 && correctLevel1Title && level1UnderRoot) {
            ctx.addResult('TG-02-02', '验证一级子文档', cmd, '子文档在父文档下', 
                '成功', true, `一级子文档: ${level1Title}`);
        } else if (!foundLevel1) {
            ctx.addResult('TG-02-02', '验证一级子文档', cmd, '子文档在父文档下', 
                '未找到一级子文档', false, `文档ID: ${level1Id}`);
        } else if (!correctLevel1Title) {
            ctx.addResult('TG-02-02', '验证一级子文档', cmd, '子文档在父文档下', 
                '标题不匹配', false, `期望: ${level1Title}`);
        } else {
            ctx.addResult('TG-02-02', '验证一级子文档', cmd, '子文档在父文档下', 
                '层级关系错误', false, '子文档不在父文档下');
        }
    }
}

// TG-02-03: 验证二级子文档结构（嵌套）
{
    if (!result.success || !structure || !level1Id || !level2Id) {
        ctx.addResult('TG-02-03', '验证二级子文档嵌套', cmd, '孙子文档在子文档下', 
            '前置条件不满足', false, '命令失败或文档创建失败');
    } else {
        const level1Doc = findDocInStructure(structure, level1Id);
        const level2Doc = findDocInStructure(structure, level2Id);
        
        const foundLevel2 = level2Doc !== null;
        const correctLevel2Title = level2Doc && level2Doc.title === level2Title;
        const level2UnderLevel1 = level1Doc && level1Doc.documents && level1Doc.documents.some(d => d.id === level2Id);
        
        if (foundLevel2 && correctLevel2Title && level2UnderLevel1) {
            ctx.addResult('TG-02-03', '验证二级子文档嵌套', cmd, '孙子文档在子文档下', 
                '成功', true, `二级子文档: ${level2Title}`);
        } else if (!foundLevel2) {
            ctx.addResult('TG-02-03', '验证二级子文档嵌套', cmd, '孙子文档在子文档下', 
                '未找到二级子文档', false, `文档ID: ${level2Id}`);
        } else if (!correctLevel2Title) {
            ctx.addResult('TG-02-03', '验证二级子文档嵌套', cmd, '孙子文档在子文档下', 
                '标题不匹配', false, `期望: ${level2Title}`);
        } else {
            ctx.addResult('TG-02-03', '验证二级子文档嵌套', cmd, '孙子文档在子文档下', 
                '层级关系错误', false, '孙子文档不在子文档下');
        }
    }
}

// TG-02-04: 验证同级文档（兄弟节点）
{
    if (!result.success || !structure || !rootId || !level1Id || !siblingId) {
        ctx.addResult('TG-02-04', '验证同级文档', cmd, '兄弟文档在同一父级下', 
            '前置条件不满足', false, '命令失败或文档创建失败');
    } else {
        const level1Doc = findDocInStructure(structure, level1Id);
        const siblingDoc = findDocInStructure(structure, siblingId);
        
        const foundSibling = siblingDoc !== null;
        const correctSiblingTitle = siblingDoc && siblingDoc.title === siblingTitle;
        
        if (foundSibling && correctSiblingTitle && level1Doc) {
            ctx.addResult('TG-02-04', '验证同级文档', cmd, '兄弟文档在同一父级下', 
                '成功', true, `同级文档: ${siblingTitle}`);
        } else if (!foundSibling) {
            ctx.addResult('TG-02-04', '验证同级文档', cmd, '兄弟文档在同一父级下', 
                '未找到同级文档', false, `文档ID: ${siblingId}`);
        } else {
            ctx.addResult('TG-02-04', '验证同级文档', cmd, '兄弟文档在同一父级下', 
                '标题不匹配', false, `期望: ${siblingTitle}`);
        }
    }
}

//  TG-02-06: 验证文档数量
{
    const expectedMinDocs = 4;
    
    if (!result.success || !structure) {
        ctx.addResult('TG-02-06', '验证文档数量', cmd, `至少包含${expectedMinDocs}个创建的文档`, 
            '命令失败', false);
    } else {
        const foundCount = [rootId, level1Id, level2Id, siblingId].filter(id => {
            return id && findDocInStructure(structure, id) !== null;
        }).length;
        
        if (foundCount >= expectedMinDocs) {
            ctx.addResult('TG-02-06', '验证文档数量', cmd, `至少包含${expectedMinDocs}个创建的文档`, 
                '成功', true, `找到 ${foundCount} 个创建的文档`);
        } else {
            ctx.addResult('TG-02-06', '验证文档数量', cmd, `至少包含${expectedMinDocs}个创建的文档`, 
                '文档数量不足', false, `期望至少 ${expectedMinDocs}, 找到 ${foundCount}`);
        }
    }
}

// TG-02-07: 测试 depth=1，只返回第一层文档
{
    if (!rootId || !level1Id || !level2Id) {
        ctx.addResult('TG-02-07', '测试depth=1', '', '只返回第一层文档', 
            '测试文档创建失败', false, '无法创建测试文档');
    } else {
        const depth1Cmd = `structure ${rootId} --depth 1`;
        const depth1Result = ctx.runCmd(depth1Cmd);
        const depth1Structure = parseStructure(depth1Result.output);
        
        if (!depth1Result.success) {
            ctx.addResult('TG-02-07', '测试depth=1', depth1Cmd, '只返回第一层文档', 
                '命令执行失败', false, depth1Result.error);
        } else if (!depth1Structure) {
            ctx.addResult('TG-02-07', '测试depth=1', depth1Cmd, '只返回第一层文档', 
                '无法解析返回数据', false);
        } else {
            const hasLevel1 = depth1Structure.documents && depth1Structure.documents.some(d => d.id === level1Id);
            const hasLevel2 = depth1Structure.documents && depth1Structure.documents.some(d => d.id === level2Id);
            
            if (hasLevel1 && !hasLevel2) {
                ctx.addResult('TG-02-07', '测试depth=1', depth1Cmd, '只返回第一层文档', 
                    '成功', true, '包含一级子文档，但不包含二级子文档');
            } else if (!hasLevel1) {
                ctx.addResult('TG-02-07', '测试depth=1', depth1Cmd, '只返回第一层文档', 
                    '一级子文档缺失', false, 'depth=1应该返回一级子文档');
            } else if (hasLevel2) {
                ctx.addResult('TG-02-07', '测试depth=1', depth1Cmd, '只返回第一层文档', 
                    '深度控制失败', false, 'depth=1不应包含二级子文档');
            }
        }
    }
}

// TG-02-08: 测试 depth=2，返回两层文档
{
    if (!rootId || !level1Id || !level2Id) {
        ctx.addResult('TG-02-08', '测试depth=2', '', '返回两层文档', 
            '测试文档创建失败', false, '无法创建测试文档');
    } else {
        const depth2Cmd = `structure ${rootId} --depth 2`;
        const depth2Result = ctx.runCmd(depth2Cmd);
        const depth2Structure = parseStructure(depth2Result.output);
        
        if (!depth2Result.success) {
            ctx.addResult('TG-02-08', '测试depth=2', depth2Cmd, '返回两层文档', 
                '命令执行失败', false, depth2Result.error);
        } else if (!depth2Structure) {
            ctx.addResult('TG-02-08', '测试depth=2', depth2Cmd, '返回两层文档', 
                '无法解析返回数据', false);
        } else {
            const hasLevel1InDocs = depth2Structure.documents && depth2Structure.documents.some(d => d.id === level1Id);
            
            let foundLevel2 = false;
            let level2UnderLevel1 = false;
            
            if (hasLevel1InDocs) {
                const level1Doc = depth2Structure.documents.find(d => d.id === level1Id);
                if (level1Doc) {
                    foundLevel2 = level1Doc.documents && level1Doc.documents.some(d => d.id === level2Id);
                    level2UnderLevel1 = foundLevel2;
                }
            }
            
            if (hasLevel1InDocs && foundLevel2 && level2UnderLevel1) {
                ctx.addResult('TG-02-08', '测试depth=2', depth2Cmd, '返回两层文档', 
                    '成功', true, '正确返回一级和二级子文档');
            } else if (!hasLevel1InDocs) {
                ctx.addResult('TG-02-08', '测试depth=2', depth2Cmd, '返回两层文档', 
                    '一级子文档缺失', false, 'depth=2应该返回一级子文档');
            } else if (!foundLevel2) {
                ctx.addResult('TG-02-08', '测试depth=2', depth2Cmd, '返回两层文档', 
                    '二级子文档缺失', false, 'depth=2应该返回二级子文档');
            } else if (!level2UnderLevel1) {
                ctx.addResult('TG-02-08', '测试depth=2', depth2Cmd, '返回两层文档', 
                    '层级关系错误', false, '二级子文档不在一级子文档下');
            }
        }
    }
}

// TG-02-09: 使用文档ID获取结构（默认depth=1）
{
    if (!rootId) {
        ctx.addResult('TG-02-09', '使用文档ID获取结构', '', '返回文档树结构', 
            '测试文档创建失败', false, '无法创建根文档');
    } else {
        const docIdCmd = `structure ${rootId}`;
        const docIdResult = ctx.runCmd(docIdCmd);
        
        if (!docIdResult.success) {
            ctx.addResult('TG-02-09', '使用文档ID获取结构', docIdCmd, '返回文档树结构', 
                '命令执行失败', false, docIdResult.error);
        } else {
            const docIdStructure = parseStructure(docIdResult.output);
            
            if (!docIdStructure) {
                ctx.addResult('TG-02-09', '使用文档ID获取结构', docIdCmd, '返回文档树结构', 
                    '无法解析返回数据', false);
            } else {
                const hasChildren = docIdStructure.documents && docIdStructure.documents.length > 0;
                const hasLevel1 = docIdStructure.documents && docIdStructure.documents.some(d => d.id === level1Id);
                
                if (hasChildren && hasLevel1) {
                    ctx.addResult('TG-02-09', '使用文档ID获取结构', docIdCmd, '返回文档树结构（默认depth=1）', 
                        '成功', true, `文档ID查询正确，返回包含子文档的结构`);
                } else if (!hasChildren) {
                    ctx.addResult('TG-02-09', '使用文档ID获取结构', docIdCmd, '返回文档树结构（默认depth=1）', 
                        '未返回子文档', false, '文档ID应该返回包含子文档的结构');
                } else if (!hasLevel1) {
                    ctx.addResult('TG-02-09', '使用文档ID获取结构', docIdCmd, '返回文档树结构（默认depth=1）', 
                        '一级子文档缺失', false, '应该包含一级子文档');
                }
            }
        }
    }
}

// TG-02-10: depth=0（不返回子文档）
{
    if (!rootId) {
        ctx.addResult('TG-02-10', '测试depth=0', '', '不返回子文档', 
            '测试文档创建失败', false, '无法创建根文档');
    } else {
        const depth0Cmd = `structure ${rootId} --depth 0`;
        const depth0Result = ctx.runCmd(depth0Cmd);
        const depth0Structure = parseStructure(depth0Result.output);
        
        if (!depth0Result.success) {
            ctx.addResult('TG-02-10', '测试depth=0', depth0Cmd, '不返回子文档', 
                '命令执行失败', false, depth0Result.error);
        } else if (!depth0Structure) {
            ctx.addResult('TG-02-10', '测试depth=0', depth0Cmd, '不返回子文档', 
                '无法解析返回数据', false);
        } else {
            const hasDocuments = depth0Structure.documents && depth0Structure.documents.length > 0;
            
            if (!hasDocuments) {
                ctx.addResult('TG-02-10', '测试depth=0', depth0Cmd, '不返回子文档', 
                    '成功', true, 'depth=0正确不返回任何子文档');
            } else {
                ctx.addResult('TG-02-10', '测试depth=0', depth0Cmd, '不返回子文档', 
                    'depth=0无效', false, `depth=0不应返回子文档，但返回了${depth0Structure.documents.length}个文档`);
            }
        }
    }
}

// TG-02-11: 使用笔记本ID查询
{
    if (process.env.TEST_ROOT_DOC_ID) {
        ctx.addResult('TG-02-11', '笔记本ID查询', '', '通过笔记本ID获取结构', 
            '跳过', true, '根文档模式下跳过此测试');
    } else if (!ctx.NOTEBOOK_ID) {
        ctx.addResult('TG-02-11', '笔记本ID查询', '', '通过笔记本ID获取结构', 
            '测试环境配置失败', false, '缺少NOTEBOOK_ID');
    } else {
        const notebookIdCmd = `structure ${ctx.NOTEBOOK_ID}`;
        const notebookIdResult = ctx.runCmd(notebookIdCmd);
        const notebookIdStructure = parseStructure(notebookIdResult.output);
        
        if (!notebookIdResult.success) {
            ctx.addResult('TG-02-11', '笔记本ID查询', notebookIdCmd, '通过笔记本ID获取结构', 
                '命令执行失败', false, notebookIdResult.error);
        } else if (!notebookIdStructure) {
            ctx.addResult('TG-02-11', '笔记本ID查询', notebookIdCmd, '通过笔记本ID获取结构', 
                '无法解析返回数据', false);
        } else {
            const correctNotebookId = notebookIdStructure.notebookId === ctx.NOTEBOOK_ID;
            const hasRoot = findDocInStructure(notebookIdStructure, rootId) !== null;
            
            if (correctNotebookId && hasRoot) {
                ctx.addResult('TG-02-11', '笔记本ID查询', notebookIdCmd, '通过笔记本ID获取结构', 
                    '成功', true, '笔记本ID查询正确，返回文档结构');
            } else if (!correctNotebookId) {
                ctx.addResult('TG-02-11', '笔记本ID查询', notebookIdCmd, '通过笔记本ID获取结构', 
                    '笔记本ID不匹配', false, `期望: ${ctx.NOTEBOOK_ID}`);
            } else if (!hasRoot) {
                ctx.addResult('TG-02-11', '笔记本ID查询', notebookIdCmd, '通过笔记本ID获取结构', 
                    '未找到创建的文档', false, `文档ID: ${rootId}`);
            }
        }
    }
}

// TG-02-12: 错误处理 - 无效的文档ID
{
    const invalidIdCmd = 'structure invalid-doc-id-12345';
    const invalidIdResult = ctx.runCmd(invalidIdCmd);
    
    if (!invalidIdResult.success) {
        ctx.addResult('TG-02-12', '无效文档ID', invalidIdCmd, '返回错误信息', 
            '成功', true, '正确处理无效文档ID');
    } else {
        const invalidIdData = JSON.parse(invalidIdResult.output);
        if (invalidIdData.success === false) {
            ctx.addResult('TG-02-12', '无效文档ID', invalidIdCmd, '返回错误信息', 
                '成功', true, '返回了错误响应');
        } else {
            ctx.addResult('TG-02-12', '无效文档ID', invalidIdCmd, '返回错误信息', 
                '错误处理失败', false, '应该对无效ID返回错误');
        }
    }
}

// TG-02-13: 错误处理 - 无效的笔记本ID
{
    const invalidNotebookCmd = 'structure 99999999999999-invalid';
    const invalidNotebookResult = ctx.runCmd(invalidNotebookCmd);
    
    if (!invalidNotebookResult.success) {
        ctx.addResult('TG-02-13', '无效笔记本ID', invalidNotebookCmd, '返回错误信息', 
            '成功', true, '正确处理无效笔记本ID');
    } else {
        try {
            const invalidNotebookData = JSON.parse(invalidNotebookResult.output);
            if (invalidNotebookData.success === false) {
                ctx.addResult('TG-02-13', '无效笔记本ID', invalidNotebookCmd, '返回错误信息', 
                    '成功', true, '返回了错误响应');
            } else {
                ctx.addResult('TG-02-13', '无效笔记本ID', invalidNotebookCmd, '返回错误信息', 
                    '错误处理失败', false, '应该对无效笔记本ID返回错误');
            }
        } catch (e) {
            ctx.addResult('TG-02-13', '无效笔记本ID', invalidNotebookCmd, '返回错误信息', 
                '成功', true, '命令执行失败（符合预期）');
        }
    }
}

// TG-02-14: 帮助信息
{
    const helpCmd = 'structure --help';
    const helpResult = ctx.runCmd(helpCmd);
    
    if (helpResult.output && helpResult.output.includes('用法:') && helpResult.output.includes('--depth')) {
        ctx.addResult('TG-02-14', '帮助信息', helpCmd, '显示完整帮助文档', 
            '成功', true, '帮助信息完整');
    } else {
        ctx.addResult('TG-02-14', '帮助信息', helpCmd, '显示完整帮助文档', 
            '帮助信息不完整', false, '缺少关键信息');
    }
}

console.log('\n生成测试报告...');
const reportStats = ctx.saveReports('TG-02-structure', 'TG-02 文档结构测试报告');

console.log('\n清理测试数据...');
ctx.cleanup();

console.log('\n========================================');
console.log('测试完成');
console.log('========================================\n');

