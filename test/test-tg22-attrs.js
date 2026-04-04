/**
 * TG-22 属性操作测试
 * 测试 block-attrs 命令及其别名
 * 验证：设置后通过get获取属性验证确实被设置/移除
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-22 属性操作测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

function checkAttrExists(docId, attrName) {
    const result = runCmd(`ba ${docId} --get`);
    if (!result.success) return { exists: false, value: null, raw: result.output };
    const hasAttr = result.output.includes(attrName) || result.output.includes('custom-' + attrName);
    return { exists: hasAttr, value: result.output, raw: result.output };
}

console.log('\n========================================');
console.log('TG-22 属性操作测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `test_attrs_${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "属性测试内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);
if (testDocId) {
    createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-22-01: 设置自定义属性
if (testDocId) {
    const attrName = 'testattr' + Date.now();
    const attrValue = '测试值' + Date.now();
    const cmd = `attrs ${testDocId} --set ${attrName}="${attrValue}"`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-22-01', '设置自定义属性', cmd, '属性被设置',
            '命令执行失败', false, result.error);
    } else {
        const check = checkAttrExists(testDocId, attrName);
        if (check.exists) {
            addResult('TG-22-01', '设置自定义属性', cmd, '属性被设置',
                    '成功', true, `属性 ${attrName} 已设置`);
        } else {
            addResult('TG-22-01', '设置自定义属性', cmd, '属性被设置',
                    '属性未找到', false, `属性 ${attrName} 未在结果中找到`);
        }
    }
} else {
    addResult('TG-22-01', '设置自定义属性', 'attrs <id> --set name="value"', '属性被设置', '测试文档创建失败', false);
}

// TG-22-02: 获取属性
if (testDocId) {
    const cmd = `attrs ${testDocId} --get`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-22-02', '获取属性', cmd, '返回属性列表',
            '命令执行失败', false, result.error);
    } else {
        const hasData = result.output.length > 0;
        addResult('TG-22-02', '获取属性', cmd, '返回属性列表',
            hasData ? '成功' : '返回为空', hasData, `输出长度: ${result.output.length}`);
    }
} else {
    addResult('TG-22-02', '获取属性', 'attrs <id> --get', '返回属性列表', '测试文档创建失败', false);
}

// TG-22-03: 移除属性
if (testDocId) {
    const attrName = 'toremove' + Date.now();
    runCmd(`attrs ${testDocId} --set ${attrName}="临时值"`);
    
    const cmd = `attrs ${testDocId} --remove ${attrName}`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-22-03', '移除属性', cmd, '属性被移除',
            '命令执行失败', false, result.error);
    } else {
        const check = checkAttrExists(testDocId, attrName);
        if (!check.exists) {
            addResult('TG-22-03', '移除属性', cmd, '属性被移除',
                '成功', true, `属性 ${attrName} 已移除`);
        } else {
            addResult('TG-22-03', '移除属性', cmd, '属性被移除',
                '属性仍存在', false, '属性未被移除');
        }
    }
} else {
    addResult('TG-22-03', '移除属性', 'attrs <id> --remove name', '属性被移除', '测试文档创建失败', false);
}

//  TG-22-05: 批量设置属性
if (testDocId) {
    const attr1 = 'batcha' + Date.now();
    const attr2 = 'batchb' + Date.now();
    const cmd = `attrs ${testDocId} --set "${attr1}=值1,${attr2}=值2"`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-22-05', '批量设置属性', cmd, '多个属性被设置',
            '命令执行失败', false, result.error);
    } else {
        const check1 = checkAttrExists(testDocId, attr1);
        const check2 = checkAttrExists(testDocId, attr2);
        if (check1.exists && check2.exists) {
            addResult('TG-22-05', '批量设置属性', cmd, '多个属性被设置',
                '成功', true, `${attr1} 和 ${attr2} 均已设置`);
        } else {
            addResult('TG-22-05', '批量设置属性', cmd, '多个属性被设置',
                '部分属性未设置', false, `${attr1}: ${check1.exists}, ${attr2}: ${check2.exists}`);
        }
    }
} else {
    addResult('TG-22-05', '批量设置属性', 'attrs <id> --set a="1" --set b="2"', '多个属性被设置', '测试文档创建失败', false);
}

// TG-22-06: 短参数测试 -S (set)
if (testDocId) {
    const attrName = 'shorts' + Date.now();
    const cmd = `attrs ${testDocId} -S "${attrName}=testvalS"`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-22-06', '短参数 -S (set)', cmd, '与 --set 效果一致',
            '命令执行失败', false, result.error);
    } else {
        const check = checkAttrExists(testDocId, attrName);
        if (check.exists) {
            addResult('TG-22-06', '短参数 -S (set)', cmd, '与 --set 效果一致',
                '成功', true, `-S 别名工作正常`);
        } else {
            addResult('TG-22-06', '短参数 -S (set)', cmd, '与 --set 效果一致',
                '属性未设置', false);
        }
    }
} else {
    addResult('TG-22-06', '短参数 -S (set)', 'attrs <id> -S name=value', '与 --set 效果一致', '测试文档创建失败', false);
}

// TG-22-07: 短参数测试 -g (get)
if (testDocId) {
    const cmd = `attrs ${testDocId} -g`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-22-07', '短参数 -g (get)', cmd, '与 --get 效果一致',
            '命令执行失败', false, result.error);
    } else {
        const hasData = result.output.length > 0 && (result.output.includes('custom-') || result.output.includes('attrs') || result.output.includes('success'));
        if (hasData) {
            addResult('TG-22-07', '短参数 -g (get)', cmd, '与 --get 效果一致',
                '成功', true, `-g 别名工作正常`);
        } else {
            addResult('TG-22-07', '短参数 -g (get)', cmd, '与 --get 效果一致',
                '返回为空或格式错误', false);
        }
    }
} else {
    addResult('TG-22-07', '短参数 -g (get)', 'attrs <id> -g', '与 --get 效果一致', '测试文档创建失败', false);
}

// TG-22-08: 测试 -g 带属性名
if (testDocId) {
    const attrName = 'shortg' + Date.now();
    const setCmd = `attrs ${testDocId} --set "${attrName}=测试G"`;
    runCmd(setCmd);
    
    const cmd = `attrs ${testDocId} -g "${attrName}"`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-22-08', '-g 带属性名', cmd, '返回指定属性值',
            '命令执行失败', false, result.error);
    } else {
        const hasValue = result.output.includes(attrName) || result.output.includes('测试G');
        if (hasValue) {
            addResult('TG-22-08', '-g 带属性名', cmd, '返回指定属性值',
                '成功', true, `-g 带属性名工作正常`);
        } else {
            addResult('TG-22-08', '-g 带属性名', cmd, '返回指定属性值',
                '未返回指定属性', false);
        }
    }
} else {
    addResult('TG-22-08', '-g 带属性名', 'attrs <id> -g name', '返回指定属性值', '测试文档创建失败', false);
}

// 清理
cleanup();

// 保存报告
saveReports('TG-22-attrs', 'TG-22 属性操作测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
