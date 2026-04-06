#!/usr/bin/env node
/**
 * 重排效果分析脚本
 * 对比重排前后的排名变化，分析重排的实际效果
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TEST_QUERIES = [
  '机器学习',
  '深度学习',
  '人工智能',
  '自然语言处理',
  '算法'
];

const RESULTS_DIR = path.join(__dirname, 'reports');

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

/**
 * 执行搜索命令
 * @param {string} query - 搜索查询
 * @param {boolean} enableRerank - 是否启用重排
 * @returns {Object} 搜索结果
 */
function runSearch(query, enableRerank) {
  const cmd = enableRerank
    ? `node scripts/search.js "${query}" --mode hybrid --enable-rerank --limit 10`
    : `node scripts/search.js "${query}" --mode hybrid --limit 10`;
  
  console.log(`\n执行: ${cmd}`);
  
  try {
    const output = execSync(cmd, { 
      encoding: 'utf-8',
      cwd: path.join(__dirname, '..')
    });
    
    const lines = output.split('\n');
    let jsonStart = -1;
    let braceCount = 0;
    let inJson = false;
    const jsonLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      
      if (!inJson && openBraces > 0) {
        inJson = true;
        jsonStart = i;
      }
      
      if (inJson) {
        jsonLines.push(line);
        braceCount += openBraces - closeBraces;
        
        if (braceCount === 0 && jsonStart >= 0) {
          break;
        }
      }
    }
    
    const jsonStr = jsonLines.join('\n');
    if (!jsonStr) {
      console.error('未找到JSON输出');
      return null;
    }
    
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('命令执行失败:', error.message);
    return null;
  }
}

/**
 * 分析排名变化
 * @param {Array} before - 重排前结果
 * @param {Array} after - 重排后结果
 * @returns {Object} 分析结果
 */
function analyzeRankChanges(before, after) {
  const beforeMap = new Map();
  before.forEach((item, index) => {
    beforeMap.set(item.id, { index, score: item.score });
  });
  
  const changes = [];
  let movedUp = 0;
  let movedDown = 0;
  let noChange = 0;
  let newEntries = 0;
  let totalPositionChange = 0;
  
  after.forEach((item, newIndex) => {
    const beforeInfo = beforeMap.get(item.id);
    
    if (beforeInfo) {
      const oldIndex = beforeInfo.index;
      const positionChange = oldIndex - newIndex;
      
      changes.push({
        id: item.id,
        title: item.title || '无标题',
        oldRank: oldIndex + 1,
        newRank: newIndex + 1,
        positionChange,
        oldScore: beforeInfo.score,
        newScore: item.score,
        rerankScore: item.rerankScore,
        scoreChange: item.score - beforeInfo.score
      });
      
      totalPositionChange += Math.abs(positionChange);
      
      if (positionChange > 0) movedUp++;
      else if (positionChange < 0) movedDown++;
      else noChange++;
    } else {
      newEntries++;
      changes.push({
        id: item.id,
        title: item.title || '无标题',
        oldRank: null,
        newRank: newIndex + 1,
        positionChange: null,
        oldScore: null,
        newScore: item.score,
        rerankScore: item.rerankScore,
        scoreChange: null,
        isNew: true
      });
    }
  });
  
  return {
    changes,
    movedUp,
    movedDown,
    noChange,
    newEntries,
    totalPositionChange,
    avgPositionChange: changes.length > 0 ? totalPositionChange / changes.length : 0
  };
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('重排效果分析');
  console.log('========================================\n');
  
  const allResults = [];
  
  for (const query of TEST_QUERIES) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`查询: "${query}"`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    const resultWithout = runSearch(query, false);
    await new Promise(r => setTimeout(r, 500));
    const resultWith = runSearch(query, true);
    
    if (!resultWithout || !resultWith) {
      console.log('跳过此查询（搜索失败）');
      continue;
    }
    
    const blocksWithout = resultWithout.data?.blocks || [];
    const blocksWith = resultWith.data?.blocks || [];
    
    console.log(`\n重排前结果数: ${blocksWithout.length}`);
    console.log(`重排后结果数: ${blocksWith.length}`);
    
    if (blocksWithout.length > 0 && blocksWith.length > 0) {
      const analysis = analyzeRankChanges(blocksWithout, blocksWith);
      
      console.log(`\n排名变化统计:`);
      console.log(`  排名上升: ${analysis.movedUp}`);
      console.log(`  排名下降: ${analysis.movedDown}`);
      console.log(`  排名不变: ${analysis.noChange}`);
      console.log(`  新条目: ${analysis.newEntries}`);
      console.log(`  平均位置变化: ${analysis.avgPositionChange.toFixed(2)} 位`);
      
      console.log(`\n详细变化:`);
      analysis.changes.slice(0, 10).forEach(change => {
        const rankStr = change.isNew 
          ? `→ #${change.newRank} [新]`
          : `#${change.oldRank} → #${change.newRank}`;
        
        const arrow = change.positionChange > 0 ? '↑' : (change.positionChange < 0 ? '↓' : '→');
        const posChangeStr = change.positionChange !== null 
          ? `(${Math.abs(change.positionChange)}位${arrow})` 
          : '';
        
        const scoreStr = change.oldScore !== null && change.newScore !== null
          ? `分数: ${change.oldScore.toFixed(3)} → ${change.newScore.toFixed(3)}`
          : `分数: ${change.newScore.toFixed(3)}`;
        
        const rerankStr = change.rerankScore !== undefined && change.rerankScore !== null
          ? ` | 重排分: ${change.rerankScore.toFixed(3)}`
          : '';
        
        console.log(`  ${rankStr} ${posChangeStr} | ${change.title.substring(0, 30)}...`);
        console.log(`    ${scoreStr}${rerankStr}`);
      });
      
      allResults.push({
        query,
        analysis,
        blocksWithout,
        blocksWith
      });
    }
  }
  
  const reportPath = path.join(RESULTS_DIR, `rerank-effect-analysis-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(allResults, null, 2), 'utf-8');
  
  console.log(`\n========================================`);
  console.log(`分析报告已保存: ${reportPath}`);
  console.log(`========================================`);
}

main().catch(console.error);
