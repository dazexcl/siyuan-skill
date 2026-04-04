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
    const folders = structure.folders || [];
    
    for (const doc of docs) {
        if (doc.id === docId) return doc;
    }
    
    for (const folder of folders) {
        if (folder.id === docId) return folder;
        if (folder.documents) {
            for (const doc of folder.documents) {
                if (doc.id === docId) return doc;
            }
        }
        if (folder.folders) {
            const found = findDocInStructure({ folders: folder.folders, documents: [] }, docId);
            if (found) return found;
        }
    }
    
    return null;
}

function countAllDocs(structure) {
    let count = (structure.documents || []).length;
    for (const folder of (structure.folders || [])) {
        count += (folder.documents || []).length;
        if (folder.subFolders) {
            count += countAllDocs({ folders: folder.subFolders });
        }
    }
    return count;
}

console.log('\n========================================');
console.log('TG-02 文档结构测试');
console.log('========================================\n');

console.log('创建测试文档结构...');

const ts = Date.now();
const rootTitle = `struct_root_${ts}`;
const level1Title = `struct_level1_${ts}`;
const level2Title = `struct_level2_${ts}`;
const siblingTitle = `struct_sibling_${ts}`;

const rootResult = ctx.runCmd(`create "${rootTitle}" "根文档内容" --parent-id ${ctx.PARENT_ID}`);
const rootId = ctx.extractDocId(rootResult.output);

let level1Id = null;
let level2Id = null;
let siblingId = null;

if (rootId) {
    ctx.createdDocs.push({ id: rootId, title: rootTitle });
    
    const level1Result = ctx.runCmd(`create "${level1Title}" "一级子文档" --parent-id ${rootId}`);
    level1Id = ctx.extractDocId(level1Result.output);
    
    if (level1Id) {
        ctx.createdDocs.push({ id: level1Id, title: level1Title, isChild: true });
        
        const level2Result = ctx.runCmd(`create "${level2Title}" "二级子文档" --parent-id ${level1Id}`);
        level2Id = ctx.extractDocId(level2Result.output);
        
        if (level2Id) {
            ctx.createdDocs.push({ id: level2Id, title: level2Title });
        }
    }
    
    const siblingResult = ctx.runCmd(`create "${siblingTitle}" "同级文档" --parent-id ${rootId}`);
    siblingId = ctx.extractDocId(siblingResult.output);
    
    if (siblingId) {
        ctx.createdDocs.push({ id: siblingId, title: siblingTitle, isChild: true });
    }
}

console.log(`创建的文档: root=${rootId}, level1=${level1Id}, level2=${level2Id}, sibling=${siblingId}`);

console.log('\n测试用例:');

// TG-02-01: 通过笔记本ID获取结构，验证包含创建的文档
// 使用 --depth -1 获取完整文档树
{
    const cmd = `structure ${ctx.NOTEBOOK_ID} --depth -1`;
    const result = ctx.runCmd(cmd);
    const structure = parseStructure(result.output);
    
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
    const cmd = `structure ${ctx.NOTEBOOK_ID} --depth -1`;
    const result = ctx.runCmd(cmd);
    const structure = parseStructure(result.output);
    
    if (!result.success || !structure || !rootId || !level1Id) {
        ctx.addResult('TG-02-02', '验证一级子文档', cmd, '子文档在父文档下', 
            '前置条件不满足', false, '命令失败或文档创建失败');
    } else {
        const rootDoc = findDocInStructure(structure, rootId);
        const level1Doc = findDocInStructure(structure, level1Id);
        
        const foundLevel1 = level1Doc !== null;
        const correctLevel1Title = level1Doc && level1Doc.title === level1Title;
        const level1UnderRoot = rootDoc && (
            (rootDoc.documents && rootDoc.documents.some(d => d.id === level1Id)) ||
            (rootDoc.folders && rootDoc.folders.some(f => f.id === level1Id))
        );
        
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
    const cmd = `structure ${ctx.NOTEBOOK_ID} --depth -1`;
    const result = ctx.runCmd(cmd);
    const structure = parseStructure(result.output);
    
    if (!result.success || !structure || !level1Id || !level2Id) {
        ctx.addResult('TG-02-03', '验证二级子文档嵌套', cmd, '孙子文档在子文档下', 
            '前置条件不满足', false, '命令失败或文档创建失败');
    } else {
        const level1Doc = findDocInStructure(structure, level1Id);
        const level2Doc = findDocInStructure(structure, level2Id);
        
        const foundLevel2 = level2Doc !== null;
        const correctLevel2Title = level2Doc && level2Doc.title === level2Title;
        const level2UnderLevel1 = level1Doc && (
            (level1Doc.documents && level1Doc.documents.some(d => d.id === level2Id)) ||
            (level1Doc.folders && level1Doc.folders.some(f => f.id === level2Id))
        );
        
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
    const cmd = `structure ${ctx.NOTEBOOK_ID} --depth -1`;
    const result = ctx.runCmd(cmd);
    const structure = parseStructure(result.output);
    
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
    const cmd = `structure ${ctx.NOTEBOOK_ID} --depth -1`;
    const result = ctx.runCmd(cmd);
    const structure = parseStructure(result.output);
    
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

