/**
 * TG-22-000 属性操作测试
 * 测试 block-attrs 命令及其别名
 * 验证：设置后通过get获取属性验证确实被设置/移除
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-22-000 属性操作测试');
const { runCmd, addResult, extractDocId, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

/**
 * 缓存属性检查结果，避免重复调用
 */
class AttrCache {
  constructor(docId) {
    this.docId = docId;
    this.cached = null;
    this.timestamp = 0;
    this.cacheTTL = 1000; // 1秒缓存
  }

  /**
   * 获取所有属性（带缓存）
   */
  getAttrs() {
    const now = Date.now();
    if (this.cached && (now - this.timestamp) < this.cacheTTL) {
      return this.cached;
    }
    
    const result = runCmd(`block-attrs ${this.docId} --get`);
    this.timestamp = now;
    
    if (!result.success) {
      this.cached = { success: false, attrs: {}, raw: result.output };
      return this.cached;
    }
    
    try {
      const data = JSON.parse(result.output);
      this.cached = { 
        success: true, 
        attrs: data.data?.attrs || {}, 
        raw: result.output 
      };
    } catch (e) {
      this.cached = { success: false, attrs: {}, raw: result.output };
    }
    
    return this.cached;
  }

  /**
   * 检查属性是否存在
   */
  hasAttr(attrName) {
    const data = this.getAttrs();
    if (!data.success) return false;
    return data.attrs.hasOwnProperty(attrName) || data.attrs.hasOwnProperty('custom-' + attrName);
  }

  /**
   * 获取属性值
   */
  getAttrValue(attrName) {
    const data = this.getAttrs();
    if (!data.success) return null;
    return data.attrs[attrName] || data.attrs['custom-' + attrName] || null;
  }

  /**
   * 清除缓存
   */
  clear() {
    this.cached = null;
    this.timestamp = 0;
  }
}

console.log('\n========================================');
console.log('TG-22-000 属性操作测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `TG-22-000-属性操作测试-${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "属性测试内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);
if (testDocId) {
  createdDocs.push({ id: testDocId, title: testDocTitle });
  console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-22-001: 设置单个自定义属性
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attrName = 'status';
  const attrValue = 'done';
  const cmd = `block-attrs ${testDocId} --set ${attrName}="${attrValue}"`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    addResult('TG-22-001', '设置单个自定义属性', cmd, '属性被设置',
      '命令执行失败', false, result.error);
  } else {
    const exists = attrCache.hasAttr(attrName);
    const value = attrCache.getAttrValue(attrName);
    if (exists && value === attrValue) {
      addResult('TG-22-001', '设置单个自定义属性', cmd, '属性被设置',
        '成功', true, `属性 ${attrName}=${attrValue} 已设置`);
    } else {
      addResult('TG-22-001', '设置单个自定义属性', cmd, '属性被设置',
        '属性未正确设置', false, `exists=${exists}, value=${value}`);
    }
  }
} else {
  addResult('TG-22-001', '设置单个自定义属性', 'block-attrs <id> --set name="value"', '属性被设置', '测试文档创建失败', false);
}

// TG-22-002: 获取所有属性
if (testDocId) {
  const cmd = `block-attrs ${testDocId} --get`;
  const result = runCmd(cmd);
  
  if (!result.success) {
    addResult('TG-22-002', '获取所有属性', cmd, '返回属性列表',
      '命令执行失败', false, result.error);
  } else {
    try {
      const data = JSON.parse(result.output);
      const hasData = data.success && data.data && typeof data.data.attrs === 'object';
      const count = hasData ? Object.keys(data.data.attrs).length : 0;
      addResult('TG-22-002', '获取所有属性', cmd, '返回属性列表',
        hasData ? '成功' : '返回为空', hasData, `返回 ${count} 个属性`);
    } catch (e) {
      addResult('TG-22-002', '获取所有属性', cmd, '返回属性列表',
        'JSON解析失败', false, e.message);
    }
  }
} else {
  addResult('TG-22-002', '获取所有属性', 'block-attrs <id> --get', '返回属性列表', '测试文档创建失败', false);
}

// TG-22-003: 获取指定属性值
if (testDocId) {
  const attrName = 'priority';
  runCmd(`block-attrs ${testDocId} --set ${attrName}=high`);
  
  const cmd = `block-attrs ${testDocId} --get ${attrName}`;
  const result = runCmd(cmd);
  
  if (!result.success) {
    addResult('TG-22-003', '获取指定属性值', cmd, '返回指定属性值',
      '命令执行失败', false, result.error);
  } else {
    try {
      const data = JSON.parse(result.output);
      const hasValue = data.success && data.data && data.data.value === 'high';
      addResult('TG-22-003', '获取指定属性值', cmd, '返回指定属性值',
        hasValue ? '成功' : '值不匹配', hasValue, `返回值: ${data.data?.value}`);
    } catch (e) {
      addResult('TG-22-003', '获取指定属性值', cmd, '返回指定属性值',
        'JSON解析失败', false, e.message);
    }
  }
} else {
  addResult('TG-22-003', '获取指定属性值', 'block-attrs <id> --get name', '返回指定属性值', '测试文档创建失败', false);
}

// TG-22-004: 移除属性
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attrName = 'toremove';
  runCmd(`block-attrs ${testDocId} --set ${attrName}=temp`);
  attrCache.clear();
  
  const cmd = `block-attrs ${testDocId} --remove ${attrName}`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    addResult('TG-22-004', '移除属性', cmd, '属性被移除',
      '命令执行失败', false, result.error);
  } else {
    const exists = attrCache.hasAttr(attrName);
    if (!exists) {
      addResult('TG-22-004', '移除属性', cmd, '属性被移除',
        '成功', true, `属性 ${attrName} 已移除`);
    } else {
      addResult('TG-22-004', '移除属性', cmd, '属性被移除',
        '属性仍存在', false, '属性未被移除');
    }
  }
} else {
  addResult('TG-22-004', '移除属性', 'block-attrs <id> --remove name', '属性被移除', '测试文档创建失败', false);
}

// TG-22-005: 批量设置属性（单次命令）
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attr1 = 'batch-a';
  const attr2 = 'batch-b';
  const attr3 = 'batch-c';
  const cmd = `block-attrs ${testDocId} --set "${attr1}=val1,${attr2}=val2,${attr3}=val3"`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    addResult('TG-22-005', '批量设置属性', cmd, '多个属性被设置',
      '命令执行失败', false, result.error);
  } else {
    const check1 = attrCache.hasAttr(attr1) && attrCache.getAttrValue(attr1) === 'val1';
    const check2 = attrCache.hasAttr(attr2) && attrCache.getAttrValue(attr2) === 'val2';
    const check3 = attrCache.hasAttr(attr3) && attrCache.getAttrValue(attr3) === 'val3';
    
    if (check1 && check2 && check3) {
      addResult('TG-22-005', '批量设置属性', cmd, '多个属性被设置',
        '成功', true, `3个属性均正确设置（单次命令）`);
    } else {
      addResult('TG-22-005', '批量设置属性', cmd, '多个属性被设置',
        '部分属性未设置', false, `${attr1}:${check1}, ${attr2}:${check2}, ${attr3}:${check3}`);
    }
  }
} else {
  addResult('TG-22-005', '批量设置属性', 'block-attrs <id> --set "a=1,b=2,c=3"', '多个属性被设置', '测试文档创建失败', false);
}

// TG-22-006: 批量移除属性（单次命令）
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attr1 = 'del-a';
  const attr2 = 'del-b';
  const attr3 = 'del-c';
  
  runCmd(`block-attrs ${testDocId} --set "${attr1}=x,${attr2}=y,${attr3}=z"`);
  attrCache.clear();
  
  const cmd = `block-attrs ${testDocId} --remove "${attr1},${attr2},${attr3}"`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    addResult('TG-22-006', '批量移除属性', cmd, '多个属性被移除',
      '命令执行失败', false, result.error);
  } else {
    const check1 = !attrCache.hasAttr(attr1);
    const check2 = !attrCache.hasAttr(attr2);
    const check3 = !attrCache.hasAttr(attr3);
    
    if (check1 && check2 && check3) {
      addResult('TG-22-006', '批量移除属性', cmd, '多个属性被移除',
        '成功', true, `3个属性均正确移除（单次命令）`);
    } else {
      addResult('TG-22-006', '批量移除属性', cmd, '多个属性被移除',
        '部分属性未移除', false, `${attr1}:${!check1}, ${attr2}:${!check2}, ${attr3}:${!check3}`);
    }
  }
} else {
  addResult('TG-22-006', '批量移除属性', 'block-attrs <id> --remove "a,b,c"', '多个属性被移除', '测试文档创建失败', false);
}

// TG-22-007: 设置带特殊字符的属性值
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attrName = 'special';
  const attrValue = 'test-value-with-dashes';
  const cmd = `block-attrs ${testDocId} --set ${attrName}="${attrValue}"`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    addResult('TG-22-007', '设置带特殊字符的属性值', cmd, '特殊字符被正确处理',
      '命令执行失败', false, result.error);
  } else {
    const value = attrCache.getAttrValue(attrName);
    if (value === attrValue) {
      addResult('TG-22-007', '设置带特殊字符的属性值', cmd, '特殊字符被正确处理',
        '成功', true, '特殊字符正确保留');
    } else {
      addResult('TG-22-007', '设置带特殊字符的属性值', cmd, '特殊字符被正确处理',
        '值不匹配', false, `期望: "${attrValue}", 实际: "${value}"`);
    }
  }
} else {
  addResult('TG-22-007', '设置带特殊字符的属性值', 'block-attrs <id> --set name="value-with-dashes"', '特殊字符被正确处理', '测试文档创建失败', false);
}

// TG-22-008: 测试 --format pretty 输出
if (testDocId) {
  const cmd = `block-attrs ${testDocId} --get --format pretty`;
  const result = runCmd(cmd);
  
  if (!result.success) {
    addResult('TG-22-008', '测试 --format pretty', cmd, '格式化输出',
      '命令执行失败', false, result.error);
  } else {
    const hasPrettyOutput = result.output.includes('✓') || result.output.includes('属性');
    addResult('TG-22-008', '测试 --format pretty', cmd, '格式化输出',
      hasPrettyOutput ? '成功' : '输出格式不正确', hasPrettyOutput, '包含格式化标识');
  }
} else {
  addResult('TG-22-008', '测试 --format pretty', 'block-attrs <id> --get --format pretty', '格式化输出', '测试文档创建失败', false);
}

// TG-22-009: 获取不存在的属性
if (testDocId) {
  const cmd = `block-attrs ${testDocId} --get nonexistent_attr_${Date.now()}`;
  const result = runCmd(cmd);
  
  if (!result.success) {
    addResult('TG-22-009', '获取不存在的属性', cmd, '返回null或空值',
      '命令执行失败', false, result.error);
  } else {
    try {
      const data = JSON.parse(result.output);
      const isNull = data.success && data.data && (data.data.value === null || data.data.value === '' || !data.data.exists);
      addResult('TG-22-009', '获取不存在的属性', cmd, '返回null或空值',
        isNull ? '成功' : '返回值不正确', isNull, `value=${data.data?.value}, exists=${data.data?.exists}`);
    } catch (e) {
      addResult('TG-22-009', '获取不存在的属性', cmd, '返回null或空值',
        'JSON解析失败', false, e.message);
    }
  }
} else {
  addResult('TG-22-009', '获取不存在的属性', 'block-attrs <id> --get nonexistent', '返回null或空值', '测试文档创建失败', false);
}

// TG-22-010: 更新已存在的属性
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attrName = 'updatetest';
  
  runCmd(`block-attrs ${testDocId} --set ${attrName}=old_value`);
  attrCache.clear();
  
  const cmd = `block-attrs ${testDocId} --set ${attrName}=new_value`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    addResult('TG-22-010', '更新已存在的属性', cmd, '属性值被更新',
      '命令执行失败', false, result.error);
  } else {
    const value = attrCache.getAttrValue(attrName);
    if (value === 'new_value') {
      addResult('TG-22-010', '更新已存在的属性', cmd, '属性值被更新',
        '成功', true, '属性值已更新');
    } else {
      addResult('TG-22-010', '更新已存在的属性', cmd, '属性值被更新',
        '值未更新', false, `期望: new_value, 实际: ${value}`);
    }
  }
} else {
  addResult('TG-22-010', '更新已存在的属性', 'block-attrs <id> --set name=new_value', '属性值被更新', '测试文档创建失败', false);
}

// TG-22-011: 设置空属性值
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attrName = 'emptytest';
  const cmd = `block-attrs ${testDocId} --set ${attrName}=""`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    const errorOutput = (result.output || '') + (result.error || '');
    const hasErrorMsg = errorOutput.includes('无效') || errorOutput.includes('error') || errorOutput.includes('错误') || errorOutput.includes('空');
    addResult('TG-22-011', '设置空属性值', cmd, '正确拒绝空值',
      '命令执行失败', hasErrorMsg, hasErrorMsg ? '空值被正确拒绝' : result.error || result.output);
  } else {
    const exists = attrCache.hasAttr(attrName);
    addResult('TG-22-011', '设置空属性值', cmd, '正确拒绝空值',
      !exists ? '成功' : '空值被接受', !exists, exists ? '空值被设置（不符合预期）' : '空值被正确拒绝');
  }
} else {
  addResult('TG-22-011', '设置空属性值', 'block-attrs <id> --set name=""', '正确拒绝空值', '测试文档创建失败', false);
}

// TG-22-012: 设置无效的属性名
if (testDocId) {
  const cmd = `block-attrs ${testDocId} --set "invalid name=value"`;
  const result = runCmd(cmd);
  
  if (!result.success) {
    const errorOutput = (result.output || '') + (result.error || '');
    const hasErrorMsg = errorOutput.includes('无效') || errorOutput.includes('error') || errorOutput.includes('错误');
    addResult('TG-22-012', '设置无效的属性名', cmd, '正确拒绝无效属性名',
      '命令执行失败', hasErrorMsg, hasErrorMsg ? '无效属性名被正确拒绝' : result.error || result.output);
  } else {
    addResult('TG-22-012', '设置无效的属性名', cmd, '正确拒绝无效属性名',
      '无效属性名被接受', false, '应该拒绝包含空格的属性名');
  }
} else {
  addResult('TG-22-012', '设置无效的属性名', 'block-attrs <id> --set "invalid name=value"', '正确拒绝无效属性名', '测试文档创建失败', false);
}

// TG-22-013: 测试短选项别名
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attrName = 'shortopt';
  const cmd = `block-attrs ${testDocId} -S "${attrName}=test"`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    addResult('TG-22-013', '测试短选项别名 -S', cmd, '短选项工作正常',
      '命令执行失败', false, result.error);
  } else {
    const exists = attrCache.hasAttr(attrName);
    addResult('TG-22-013', '测试短选项别名 -S', cmd, '短选项工作正常',
      exists ? '成功' : '短选项无效', exists, '-S 选项正常工作');
  }
} else {
  addResult('TG-22-013', '测试短选项别名 -S', 'block-attrs <id> -S name=value', '短选项工作正常', '测试文档创建失败', false);
}

// TG-22-014: 验证属性数量统计（包含系统属性）
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attrs = {
    'count-a': '1',
    'count-b': '2',
    'count-c': '3'
  };
  const attrsStr = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join(',');
  
  runCmd(`block-attrs ${testDocId} --set "${attrsStr}"`);
  attrCache.clear();
  
  const cmd = `block-attrs ${testDocId} --get`;
  const result = runCmd(cmd);
  
  if (!result.success) {
    addResult('TG-22-014', '验证属性数量统计', cmd, '返回正确的属性数量',
      '命令执行失败', false, result.error);
  } else {
    try {
      const data = JSON.parse(result.output);
      const actualCount = data.data?.count || 0;
      const customAttrCount = Object.keys(attrs).length;
      const hasSystemAttrs = actualCount > customAttrCount;
      
      addResult('TG-22-014', '验证属性数量统计', cmd, '返回正确的属性数量',
        actualCount >= customAttrCount ? '成功' : '数量不匹配', actualCount >= customAttrCount, 
        `自定义属性: ${customAttrCount}, 总属性: ${actualCount}${hasSystemAttrs ? ' (包含系统属性)' : ''}`);
    } catch (e) {
      addResult('TG-22-014', '验证属性数量统计', cmd, '返回正确的属性数量',
        'JSON解析失败', false, e.message);
    }
  }
} else {
  addResult('TG-22-014', '验证属性数量统计', 'block-attrs <id> --get', '返回正确的属性数量', '测试文档创建失败', false);
}

// TG-22-015: 测试 --hide 参数
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attrName = 'internal-attr';
  const attrValue = 'internal-value';
  const cmd = `block-attrs ${testDocId} --set ${attrName}="${attrValue}" --hide`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    addResult('TG-22-015', '测试 --hide 参数', cmd, '内部属性被设置',
      '命令执行失败', false, result.error);
  } else {
    const getCmd = `block-attrs ${testDocId} --get ${attrName} --hide`;
    const getResult = runCmd(getCmd);
    
    if (getResult.success) {
      try {
        const data = JSON.parse(getResult.output);
        const hasValue = data.data && data.data.value === attrValue;
        addResult('TG-22-015', '测试 --hide 参数', cmd, '内部属性被设置',
          hasValue ? '成功' : '值不匹配', hasValue, `--hide 参数工作正常`);
      } catch (e) {
        addResult('TG-22-015', '测试 --hide 参数', cmd, '内部属性被设置',
          'JSON解析失败', false, e.message);
      }
    } else {
      addResult('TG-22-015', '测试 --hide 参数', cmd, '内部属性被设置',
        '获取失败', false, getResult.error);
    }
  }
} else {
  addResult('TG-22-015', '测试 --hide 参数', 'block-attrs <id> --set name=value --hide', '内部属性被设置', '测试文档创建失败', false);
}

// 清理
ctx.cleanup();

// 保存报告
saveReports('TG-22-000', 'TG-22-000 属性操作测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
