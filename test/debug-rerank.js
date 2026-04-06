#!/usr/bin/env node
/**
 * 重排搜索调试脚本
 * 单独运行一次重排搜索，详细监控中间执行过程
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_QUERY = '机器学习';
const RESULTS_DIR = path.join(__dirname, 'reports');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

console.log('========================================');
console.log('重排搜索调试');
console.log('========================================\n');

console.log(`查询: "${TEST_QUERY}"`);
console.log('模式: hybrid + enable-rerank');
console.log('');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('步骤1: 不启用重排的搜索');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const cmdWithout = `node scripts/search.js "${TEST_QUERY}" --mode hybrid --limit 10`;
console.log(`执行: ${cmdWithout}`);

try {
  const outputWithout = execSync(cmdWithout, {
    encoding: 'utf-8',
    cwd: path.join(__dirname, '..')
  });

  const linesWithout = outputWithout.split('\n');
  let jsonStartWithout = -1;
  let braceCountWithout = 0;
  let inJsonWithout = false;
  const jsonLinesWithout = [];

  for (let i = 0; i < linesWithout.length; i++) {
    const line = linesWithout[i];
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    if (!inJsonWithout && openBraces > 0) {
      inJsonWithout = true;
      jsonStartWithout = i;
    }

    if (inJsonWithout) {
      jsonLinesWithout.push(line);
      braceCountWithout += openBraces - closeBraces;

      if (braceCountWithout === 0 && jsonStartWithout >= 0) {
        break;
      }
    }
  }

  const jsonStrWithout = jsonLinesWithout.join('\n');
  const resultWithout = JSON.parse(jsonStrWithout);

  console.log('\n结果:');
  console.log(`  成功: ${resultWithout.success}`);
  console.log(`  结果数: ${resultWithout.data?.blocks?.length || 0}`);
  console.log(`  模式: ${resultWithout.query?.mode}`);

  if (resultWithout.data?.blocks) {
    console.log('\n  结果列表:');
    resultWithout.data.blocks.forEach((block, index) => {
      console.log(`    #${index + 1}: ${block.title?.substring(0, 30) || '无标题'}`);
      console.log(`      ID: ${block.id}`);
      console.log(`      分数: ${block.score}`);
      if (block.originalDocId) {
        console.log(`      原始文档ID: ${block.originalDocId}`);
      }
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤2: 启用重排的搜索');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const cmdWith = `node scripts/search.js "${TEST_QUERY}" --mode hybrid --enable-rerank --limit 10`;
  console.log(`执行: ${cmdWith}`);

  const outputWith = execSync(cmdWith, {
    encoding: 'utf-8',
    cwd: path.join(__dirname, '..')
  });

  const linesWith = outputWith.split('\n');
  let jsonStartWith = -1;
  let braceCountWith = 0;
  let inJsonWith = false;
  const jsonLinesWith = [];

  for (let i = 0; i < linesWith.length; i++) {
    const line = linesWith[i];
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    if (!inJsonWith && openBraces > 0) {
      inJsonWith = true;
      jsonStartWith = i;
    }

    if (inJsonWith) {
      jsonLinesWith.push(line);
      braceCountWith += openBraces - closeBraces;

      if (braceCountWith === 0 && jsonStartWith >= 0) {
        break;
      }
    }
  }

  const jsonStrWith = jsonLinesWith.join('\n');
  const resultWith = JSON.parse(jsonStrWith);

  console.log('\n结果:');
  console.log(`  成功: ${resultWith.success}`);
  console.log(`  结果数: ${resultWith.data?.blocks?.length || 0}`);
  console.log(`  模式: ${resultWith.query?.mode}`);
  console.log(`  重排启用: ${resultWith.rerank?.enabled}`);

  if (resultWith.rerank) {
    console.log(`  重排数: ${resultWith.rerank.rerankCount}`);
    if (resultWith.rerank.cacheStats) {
      console.log(`  缓存命中: ${resultWith.rerank.cacheStats.hits}`);
      console.log(`  缓存未命中: ${resultWith.rerank.cacheStats.misses}`);
      console.log(`  缓存命中率: ${resultWith.rerank.cacheStats.hitRate}`);
    }
  }

  if (resultWith.data?.blocks) {
    console.log('\n  结果列表:');
    resultWith.data.blocks.forEach((block, index) => {
      console.log(`    #${index + 1}: ${block.title?.substring(0, 30) || '无标题'}`);
      console.log(`      ID: ${block.id}`);
      console.log(`      分数: ${block.score}`);
      console.log(`      原始分数: ${block.originalScore}`);
      console.log(`      重排分数: ${block.rerankScore}`);
      console.log(`      最终分数: ${block.finalScore}`);
      if (block.originalDocId) {
        console.log(`      原始文档ID: ${block.originalDocId}`);
      }
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('对比分析');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const blocksWithout = resultWithout.data?.blocks || [];
  const blocksWith = resultWith.data?.blocks || [];

  console.log(`\n不重排结果数: ${blocksWithout.length}`);
  console.log(`启用重排结果数: ${blocksWith.length}`);

  const docIdsWithout = new Set(blocksWithout.map(b => b.originalDocId || b.id));
  const docIdsWith = new Set(blocksWith.map(b => b.originalDocId || b.id));

  console.log(`\n不重排文档数: ${docIdsWithout.size}`);
  console.log(`启用重排文档数: ${docIdsWith.size}`);

  console.log('\n========================================');
  console.log('调试完成');
  console.log('========================================');

  const report = {
    query: TEST_QUERY,
    withoutRerank: resultWithout,
    withRerank: resultWith,
    timestamp: new Date().toISOString()
  };

  const reportPath = path.join(RESULTS_DIR, `debug-rerank-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\n详细报告已保存: ${reportPath}`);

} catch (error) {
  console.error('\n错误:', error.message);
  console.error('堆栈:', error.stack);
  process.exit(1);
}
