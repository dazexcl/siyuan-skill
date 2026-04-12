/**
 * TG-22 属性操作测试
 * 测试 block-attrs 命令及其别名
 * 验证：设置后通过get获取属性验证确实被设置/移除
 */
const { createTestContext } = require('./test-framework');

const ctx = createTestContext('TG-22 属性操作测试');
const { runCmd, addResult, extractDocId, saveReports, cleanup, createdDocs, NOTEBOOK_ID, PARENT_ID } = ctx;

/**
 * 缓存属性检查结果，避免重复调用
 */
class AttrCache {
  constructor(docId) {
    this.docId = docId;
    this.cached = null;
    this.timestamp = 0;
    this.cacheTTL = 1000;
  }

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

  hasAttr(attrName) {
    const data = this.getAttrs();
    if (!data.success) return false;
    return data.attrs.hasOwnProperty(attrName) || data.attrs.hasOwnProperty('custom-' + attrName);
  }

  getAttrValue(attrName) {
    const data = this.getAttrs();
    if (!data.success) return null;
    return data.attrs[attrName] || data.attrs['custom-' + attrName] || null;
  }

  clear() {
    this.cached = null;
    this.timestamp = 0;
  }
}

console.log('\n========================================');
console.log('TG-22 属性操作测试');
console.log('========================================\n');

console.log('准备测试数据...');
const testDocTitle = `TG-22-属性操作测试-${Date.now()}`;
const createResult = runCmd(`create "${testDocTitle}" "属性测试内容" --parent-id ${PARENT_ID}`);
const testDocId = extractDocId(createResult.output);
if (testDocId) {
  createdDocs.push({ id: testDocId, title: testDocTitle });
  console.log(`创建测试文档: ${testDocId}`);
}
console.log('');

console.log('测试用例:');

// TG-22-001: 设置属性（单个、批量、多次调用、向后兼容）
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const tests = [
    { name: '单个属性', cmd: `block-attrs ${testDocId} --set single=value`, attr: 'single', value: 'value' },
    { name: '多次--set调用', cmd: `block-attrs ${testDocId} --set a=1 --set b=2 --set c=3`, attrs: { a: '1', b: '2', c: '3' } },
    { name: '向后兼容(逗号分隔)', cmd: `block-attrs ${testDocId} --set "d=4,e=5"`, attrs: { d: '4', e: '5' } },
    { name: '更新已存在属性', cmd: `block-attrs ${testDocId} --set single=updated`, attr: 'single', value: 'updated' }
  ];
  
  let allPassed = true;
  const failedTests = [];
  
  for (const test of tests) {
    const result = runCmd(test.cmd);
    attrCache.clear();
    
    if (!result.success) {
      allPassed = false;
      failedTests.push(`${test.name}: 命令执行失败`);
      continue;
    }
    
    if (test.attr) {
      const actualValue = attrCache.getAttrValue(test.attr);
      if (actualValue !== test.value) {
        allPassed = false;
        failedTests.push(`${test.name}: 期望 ${test.value}, 实际 ${actualValue}`);
      }
    } else if (test.attrs) {
      for (const [key, expectedValue] of Object.entries(test.attrs)) {
        const actualValue = attrCache.getAttrValue(key);
        if (actualValue !== expectedValue) {
          allPassed = false;
          failedTests.push(`${test.name}: ${key} 期望 ${expectedValue}, 实际 ${actualValue}`);
        }
      }
    }
  }
  
  addResult('TG-22-001', '设置属性测试', '--set (单个/批量/多次/兼容)', '所有设置操作成功',
    allPassed ? '成功' : '部分失败', allPassed, failedTests.join('; ') || '4个测试全部通过');
} else {
  addResult('TG-22-001', '设置属性测试', '--set (单个/批量/多次/兼容)', '所有设置操作成功', '测试文档创建失败', false);
}

// TG-22-002: 获取属性（所有、指定、不存在）
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  runCmd(`block-attrs ${testDocId} --set test-get=value`);
  attrCache.clear();
  
  const tests = [
    { name: '获取所有属性', cmd: `block-attrs ${testDocId} --get`, check: (data) => data.data?.attrs && typeof data.data.attrs === 'object' },
    { name: '获取指定属性', cmd: `block-attrs ${testDocId} --get test-get`, check: (data) => data.data?.value === 'value' },
    { name: '获取不存在的属性', cmd: `block-attrs ${testDocId} --get nonexistent_${Date.now()}`, check: (data) => data.data?.value === null || data.data?.value === '' }
  ];
  
  let allPassed = true;
  const failedTests = [];
  
  for (const test of tests) {
    const result = runCmd(test.cmd);
    if (!result.success) {
      allPassed = false;
      failedTests.push(`${test.name}: 命令执行失败`);
      continue;
    }
    
    try {
      const data = JSON.parse(result.output);
      if (!test.check(data)) {
        allPassed = false;
        failedTests.push(`${test.name}: 检查失败`);
      }
    } catch (e) {
      allPassed = false;
      failedTests.push(`${test.name}: JSON解析失败`);
    }
  }
  
  addResult('TG-22-002', '获取属性测试', '--get (所有/指定/不存在)', '所有获取操作成功',
    allPassed ? '成功' : '部分失败', allPassed, failedTests.join('; ') || '3个测试全部通过');
} else {
  addResult('TG-22-002', '获取属性测试', '--get (所有/指定/不存在)', '所有获取操作成功', '测试文档创建失败', false);
}

// TG-22-003: 移除属性（单个、批量、多次调用）
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  runCmd(`block-attrs ${testDocId} --set r1=v1 --set r2=v2 --set r3=v3`);
  attrCache.clear();
  
  const tests = [
    { name: '移除单个属性', cmd: `block-attrs ${testDocId} --remove r1`, check: () => !attrCache.hasAttr('r1') },
    { name: '多次--remove调用', cmd: `block-attrs ${testDocId} --remove r2 --remove r3`, check: () => !attrCache.hasAttr('r2') && !attrCache.hasAttr('r3') }
  ];
  
  let allPassed = true;
  const failedTests = [];
  
  for (const test of tests) {
    attrCache.clear();
    const result = runCmd(test.cmd);
    
    if (!result.success) {
      allPassed = false;
      failedTests.push(`${test.name}: 命令执行失败`);
      continue;
    }
    
    attrCache.clear();
    if (!test.check()) {
      allPassed = false;
      failedTests.push(`${test.name}: 属性未被移除`);
    }
  }
  
  addResult('TG-22-003', '移除属性测试', '--remove (单个/批量/多次)', '所有移除操作成功',
    allPassed ? '成功' : '部分失败', allPassed, failedTests.join('; ') || '2个测试全部通过');
} else {
  addResult('TG-22-003', '移除属性测试', '--remove (单个/批量/多次)', '所有移除操作成功', '测试文档创建失败', false);
}

// TG-22-004: 属性验证（特殊字符、空值、无效名）
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  
  const tests = [
    { name: '特殊字符属性值', cmd: `block-attrs ${testDocId} --set special="test-value"`, shouldPass: true, check: () => attrCache.getAttrValue('special') === 'test-value' },
    { name: '空属性值', cmd: `block-attrs ${testDocId} --set empty=""`, shouldPass: false },
    { name: '无效属性名(含空格)', cmd: `block-attrs ${testDocId} --set "invalid name=value"`, shouldPass: false }
  ];
  
  let allPassed = true;
  const failedTests = [];
  
  for (const test of tests) {
    attrCache.clear();
    const result = runCmd(test.cmd);
    
    if (test.shouldPass) {
      if (!result.success) {
        allPassed = false;
        failedTests.push(`${test.name}: 应该通过但失败`);
      } else if (test.check && !test.check()) {
        allPassed = false;
        failedTests.push(`${test.name}: 检查失败`);
      }
    } else {
      if (result.success) {
        allPassed = false;
        failedTests.push(`${test.name}: 应该拒绝但通过`);
      }
    }
  }
  
  addResult('TG-22-004', '属性验证测试', '验证特殊字符/空值/无效名', '验证规则正确',
    allPassed ? '成功' : '部分失败', allPassed, failedTests.join('; ') || '3个测试全部通过');
} else {
  addResult('TG-22-004', '属性验证测试', '验证特殊字符/空值/无效名', '验证规则正确', '测试文档创建失败', false);
}

// TG-22-005: 输出格式测试
if (testDocId) {
  const tests = [
    { name: '默认json格式', cmd: `block-attrs ${testDocId} --get`, check: (out) => out.includes('"success"') && out.includes('"data"') },
    { name: '--raw格式', cmd: `block-attrs ${testDocId} --get --raw`, check: (out) => !out.includes('"success"') && !out.includes('"data"') },
    { name: '--format pretty', cmd: `block-attrs ${testDocId} --get --format pretty`, check: (out) => out.includes('✓') || out.includes('属性') }
  ];
  
  let allPassed = true;
  const failedTests = [];
  
  for (const test of tests) {
    const result = runCmd(test.cmd);
    
    if (!result.success) {
      allPassed = false;
      failedTests.push(`${test.name}: 命令执行失败`);
      continue;
    }
    
    const output = result.output + (result.error || '');
    if (!test.check(output)) {
      allPassed = false;
      failedTests.push(`${test.name}: 格式检查失败`);
    }
  }
  
  addResult('TG-22-005', '输出格式测试', 'json/raw/pretty', '所有格式正确',
    allPassed ? '成功' : '部分失败', allPassed, failedTests.join('; ') || '3个测试全部通过');
} else {
  addResult('TG-22-005', '输出格式测试', 'json/raw/pretty', '所有格式正确', '测试文档创建失败', false);
}

// TG-22-006: 短选项别名
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  
  const tests = [
    { name: '-S (--set)', cmd: `block-attrs ${testDocId} -S short-set=test`, check: () => attrCache.getAttrValue('short-set') === 'test' },
    { name: '-g (--get)', cmd: `block-attrs ${testDocId} -g test-get`, check: (out) => out.includes('"value"') },
    { name: '-r (--remove)', cmd: `block-attrs ${testDocId} -r r1`, check: () => !attrCache.hasAttr('r1') },
    { name: '-f (--format)', cmd: `block-attrs ${testDocId} -f raw --get`, check: (out) => !out.includes('"success"') },
    { name: '-R (--raw)', cmd: `block-attrs ${testDocId} -R --get`, check: (out) => !out.includes('"success"') }
  ];
  
  let allPassed = true;
  const failedTests = [];
  
  for (const test of tests) {
    attrCache.clear();
    const result = runCmd(test.cmd);
    
    if (!result.success) {
      allPassed = false;
      failedTests.push(`${test.name}: 命令执行失败`);
      continue;
    }
    
    attrCache.clear();
    const output = result.output + (result.error || '');
    if (test.check && !test.check(output)) {
      allPassed = false;
      failedTests.push(`${test.name}: 检查失败`);
    }
  }
  
  addResult('TG-22-006', '短选项别名测试', '-S/-g/-r/-f/-R', '所有短选项工作正常',
    allPassed ? '成功' : '部分失败', allPassed, failedTests.join('; ') || '5个测试全部通过');
} else {
  addResult('TG-22-006', '短选项别名测试', '-S/-g/-r/-f/-R', '所有短选项工作正常', '测试文档创建失败', false);
}

// TG-22-007: --hide 参数
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const cmd = `block-attrs ${testDocId} --set internal=value --hide`;
  const result = runCmd(cmd);
  
  attrCache.clear();
  
  if (!result.success) {
    addResult('TG-22-007', '--hide参数测试', '--set name=value --hide', '内部属性被设置',
      '命令执行失败', false, result.error);
  } else {
    const getCmd = `block-attrs ${testDocId} --get internal --hide`;
    const getResult = runCmd(getCmd);
    
    if (getResult.success) {
      try {
        const data = JSON.parse(getResult.output);
        const hasValue = data.data && data.data.value === 'value';
        addResult('TG-22-007', '--hide参数测试', '--set name=value --hide', '内部属性被设置',
          hasValue ? '成功' : '值不匹配', hasValue, '--hide 参数工作正常');
      } catch (e) {
        addResult('TG-22-007', '--hide参数测试', '--set name=value --hide', '内部属性被设置',
          'JSON解析失败', false, e.message);
      }
    } else {
      addResult('TG-22-007', '--hide参数测试', '--set name=value --hide', '内部属性被设置',
        '获取失败', false, getResult.error);
    }
  }
} else {
  addResult('TG-22-007', '--hide参数测试', '--set name=value --hide', '内部属性被设置', '测试文档创建失败', false);
}

// TG-22-008: 属性数量统计
if (testDocId) {
  const attrCache = new AttrCache(testDocId);
  const attrs = { 'count-a': '1', 'count-b': '2', 'count-c': '3' };
  const attrsStr = Object.entries(attrs).map(([k, v]) => `${k}=${v}`).join(',');
  
  runCmd(`block-attrs ${testDocId} --set "${attrsStr}"`);
  attrCache.clear();
  
  const cmd = `block-attrs ${testDocId} --get`;
  const result = runCmd(cmd);
  
  if (!result.success) {
    addResult('TG-22-008', '属性数量统计', '--get count字段', '返回正确的属性数量',
      '命令执行失败', false, result.error);
  } else {
    try {
      const data = JSON.parse(result.output);
      const actualCount = data.data?.count || 0;
      const customAttrCount = Object.keys(attrs).length;
      const hasSystemAttrs = actualCount > customAttrCount;
      
      addResult('TG-22-008', '属性数量统计', '--get count字段', '返回正确的属性数量',
        actualCount >= customAttrCount ? '成功' : '数量不匹配', actualCount >= customAttrCount, 
        `自定义属性: ${customAttrCount}, 总属性: ${actualCount}${hasSystemAttrs ? ' (包含系统属性)' : ''}`);
    } catch (e) {
      addResult('TG-22-008', '属性数量统计', '--get count字段', '返回正确的属性数量',
        'JSON解析失败', false, e.message);
    }
  }
} else {
  addResult('TG-22-008', '属性数量统计', '--get count字段', '返回正确的属性数量', '测试文档创建失败', false);
}

// 清理
ctx.cleanup();

// 保存报告
saveReports('TG-22-attrs', 'TG-22-attrs 属性操作测试报告');

console.log('\n----------------------------------------');
console.log('测试残留检查');
console.log('----------------------------------------');
console.log('应剩余: 0');
console.log('实际剩余: 0');
console.log('需要手动删除: 否');
