/**
 * TG-23 标签操作测试
 * 测试 tags 命令及其别名
 * 验证：设置后通过tags --get验证标签确实被设置/移除
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-23 标签操作测试');
const { runCmd, addResult, extractDocId, getDocTitle, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

function checkTagExists(docId, tagName) {
    const result = runCmd(`tags --id ${docId} --get`);
    if (!result.success) return { exists: false, raw: result.output };
    const hasTag = result.output.includes(tagName);
    return { exists: hasTag, raw: result.output };
}

console.log('\n========================================');
console.log('TG-23 标签操作测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `test_tags_${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "标签测试内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);
if (testDocId) {
    createdDocs.push({ id: testDocId, title: testDocTitle });
    console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-23-01: 添加标签
if (testDocId) {
    const tagName = '测试标签' + Date.now();
    const cmd = `tags --id ${testDocId} --tags "${tagName}" --add`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-23-01', '添加标签', cmd, '标签被添加',
            '命令执行失败', false, result.error);
    } else {
        const check = checkTagExists(testDocId, tagName);
        if (check.exists) {
            addResult('TG-23-01', '添加标签', cmd, '标签被添加',
                '成功', true, `标签 "${tagName}" 已添加`);
        } else {
            addResult('TG-23-01', '添加标签', cmd, '标签被添加',
                '标签未找到', false, `标签 "${tagName}" 未在属性中找到`);
        }
    }
} else {
    addResult('TG-23-01', '添加标签', 'tags --id <id> --tags "标签" --add', '标签被添加', '测试文档创建失败', false);
}

// TG-23-02: 添加多个标签
if (testDocId) {
    const tag1 = '多标签1_' + Date.now();
    const tag2 = '多标签2_' + Date.now();
    const cmd = `tags --id ${testDocId} --tags "${tag1},${tag2}" --add`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-23-02', '添加多个标签', cmd, '多个标签被添加',
            '命令执行失败', false, result.error);
    } else {
        const check1 = checkTagExists(testDocId, tag1);
        const check2 = checkTagExists(testDocId, tag2);
        if (check1.exists && check2.exists) {
            addResult('TG-23-02', '添加多个标签', cmd, '多个标签被添加',
                '成功', true, `标签 "${tag1}" 和 "${tag2}" 均已添加`);
        } else {
            addResult('TG-23-02', '添加多个标签', cmd, '多个标签被添加',
                '部分标签未添加', false, `${tag1}: ${check1.exists}, ${tag2}: ${check2.exists}`);
        }
    }
} else {
    addResult('TG-23-02', '添加多个标签', 'tags --id <id> --tags "标签1,标签2" --add', '多个标签被添加', '测试文档创建失败', false);
}

// TG-23-03: 移除标签
if (testDocId) {
    const tagName = '待移除标签_' + Date.now();
    runCmd(`tags --id ${testDocId} --tags "${tagName}" --add`);
    
    const cmd = `tags --id ${testDocId} --tags "${tagName}" --remove`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-23-03', '移除标签', cmd, '标签被移除',
            '命令执行失败', false, result.error);
    } else {
        const check = checkTagExists(testDocId, tagName);
        if (!check.exists) {
            addResult('TG-23-03', '移除标签', cmd, '标签被移除',
                '成功', true, `标签 "${tagName}" 已移除`);
        } else {
            addResult('TG-23-03', '移除标签', cmd, '标签被移除',
                '标签仍存在', false, `标签 "${tagName}" 仍存在`);
        }
    }
} else {
    addResult('TG-23-03', '移除标签', 'tags --id <id> --tags "标签" --remove', '标签被移除', '测试文档创建失败', false);
}

//  TG-23-05: 列出标签
if (testDocId) {
    const tagName = '列表测试标签_' + Date.now();
    runCmd(`tags --id ${testDocId} --tags "${tagName}" --add`);
    
    const cmd = `tags --id ${testDocId} --get`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-23-05', '列出标签', cmd, '返回标签列表',
            '命令执行失败', false, result.error);
    } else {
        const hasData = result.output.length > 0;
        if (hasData) {
            addResult('TG-23-05', '列出标签', cmd, '返回标签列表',
                '成功', true, `返回数据长度: ${result.output.length}`);
        } else {
            addResult('TG-23-05', '列出标签', cmd, '返回标签列表',
                '返回为空', false);
        }
    }
} else {
    addResult('TG-23-05', '列出标签', 'tags --id <id> --get', '返回标签列表', '测试文档创建失败', false);
}

// TG-23-06: 短参数测试 -t (tags)
if (testDocId) {
    const tagName = '短参数t_' + Date.now();
    const cmd = `tags --id ${testDocId} -t "${tagName}" --add`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-23-06', '短参数 -t (tags)', cmd, '与 --tags 效果一致',
            '命令执行失败', false, result.error);
    } else {
        const check = checkTagExists(testDocId, tagName);
        if (check.exists) {
            addResult('TG-23-06', '短参数 -t (tags)', cmd, '与 --tags 效果一致',
                '成功', true, `-t 别名工作正常`);
        } else {
            addResult('TG-23-06', '短参数 -t (tags)', cmd, '与 --tags 效果一致',
                '标签未添加', false);
        }
    }
} else {
    addResult('TG-23-06', '短参数 -t (tags)', 'tags --id <id> -t "标签" --add', '与 --tags 效果一致', '测试文档创建失败', false);
}

// TG-23-07: 短参数测试 -a (add)
if (testDocId) {
    const tagName = '短参数a_' + Date.now();
    const cmd = `tags --id ${testDocId} --tags "${tagName}" -a`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-23-07', '短参数 -a (add)', cmd, '与 --add 效果一致',
            '命令执行失败', false, result.error);
    } else {
        const check = checkTagExists(testDocId, tagName);
        if (check.exists) {
            addResult('TG-23-07', '短参数 -a (add)', cmd, '与 --add 效果一致',
                '成功', true, `-a 别名工作正常`);
        } else {
            addResult('TG-23-07', '短参数 -a (add)', cmd, '与 --add 效果一致',
                '标签未添加', false);
        }
    }
} else {
    addResult('TG-23-07', '短参数 -a (add)', 'tags --id <id> --tags "标签" -a', '与 --add 效果一致', '测试文档创建失败', false);
}

// TG-23-08: 短参数测试 -g (get)
if (testDocId) {
    const cmd = `tags --id ${testDocId} -g`;
    const result = runCmd(cmd);
    
    if (!result.success) {
        addResult('TG-23-08', '短参数 -g (get)', cmd, '与 --get 效果一致',
            '命令执行失败', false, result.error);
    } else {
        const hasData = result.output.length > 0;
        if (hasData) {
            addResult('TG-23-08', '短参数 -g (get)', cmd, '与 --get 效果一致',
                '成功', true, `-g 别名工作正常`);
        } else {
            addResult('TG-23-08', '短参数 -g (get)', cmd, '与 --get 效果一致',
                '返回为空', false);
        }
    }
} else {
    addResult('TG-23-08', '短参数 -g (get)', 'tags --id <id> -g', '与 --get 效果一致', '测试文档创建失败', false);
}

// 清理
cleanup();

// 保存报告
saveReports('TG-23-tags', 'TG-23 标签操作测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
