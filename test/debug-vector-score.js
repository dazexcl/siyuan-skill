#!/usr/bin/env node
/**
 * 调试向量搜索分数 - 直接调用 Qdrant API 查看原始分数
 */

const ConfigManager = require('../scripts/lib/config');
const VectorManager = require('../scripts/lib/vector-manager');
const EmbeddingManager = require('../scripts/lib/embedding-manager');

const TEST_QUERY = '开源桌面 AI 自动化工具';

async function main() {
  console.log('========================================');
  console.log('向量搜索分数调试');
  console.log('========================================\n');

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    if (!config.qdrant || !config.qdrant.url || !config.embedding || !config.embedding.baseUrl) {
      console.error('配置不完整');
      process.exit(1);
    }

    const embeddingManager = new EmbeddingManager(config.embedding);
    const vectorManager = new VectorManager(config, embeddingManager);
    await vectorManager.initialize();

    console.log(`查询: "${TEST_QUERY}"`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤1: 生成查询向量');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const queryEmbedding = await embeddingManager.generateEmbedding(TEST_QUERY);
    console.log(`查询向量维度: ${queryEmbedding.length}`);
    console.log(`查询向量前10个值: ${queryEmbedding.slice(0, 10).join(', ')}`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤2: 直接调用 Qdrant Search API (limit=20)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const searchResult = await vectorManager.searchAPI(
      `/collections/${vectorManager.collectionName}/points/search`,
      'POST',
      {
        vector: queryEmbedding,
        limit: 20,
        with_payload: true,
        with_vector: false
      }
    );

    console.log(`Qdrant 返回结果数: ${searchResult.result?.length || 0}`);

    if (searchResult.result && searchResult.result.length > 0) {
      console.log('\nQdrant 原始分数:');
      searchResult.result.forEach((r, i) => {
        const isTarget = r.payload?.id === '20260306044633-u0n0uj4' || 
                          r.payload?.block_id === '20260306044633-u0n0uj4';
        const marker = isTarget ? ' 👉' : '';
        console.log(`  #${i + 1}${marker}:`);
        console.log(`    分数: ${r.score}`);
        console.log(`    ID: ${r.id}`);
        console.log(`    payload.id: ${r.payload?.id}`);
        console.log(`    payload.block_id: ${r.payload?.block_id}`);
        console.log(`    payload.title: ${r.payload?.title?.substring(0, 30) || '无标题'}`);
      });

      const scores = searchResult.result.map(r => r.score);
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('分数统计');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`最低分: ${minScore}`);
      console.log(`最高分: ${maxScore}`);
      console.log(`平均分: ${avgScore}`);
      console.log(`分数范围: ${maxScore - minScore}`);

      const targetResult = searchResult.result.find(r => 
        r.payload?.id === '20260306044633-u0n0uj4' || 
        r.payload?.block_id === '20260306044633-u0n0uj4'
      );

      if (targetResult) {
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('目标文档分析');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`排名: #${searchResult.result.indexOf(targetResult) + 1}`);
        console.log(`分数: ${targetResult.score}`);
        console.log(`标题: ${targetResult.payload?.title}`);
        
        const percentile = (1 - searchResult.result.indexOf(targetResult) / searchResult.result.length) * 100;
        console.log(`排名百分位: ${percentile.toFixed(1)}% (前 ${(100 - percentile).toFixed(1)}%)`);
      } else {
        console.log('\n⚠️ 目标文档未在 Qdrant 搜索结果中找到!');
        console.log('可能原因:');
        console.log('  1. 文档没有被索引');
        console.log('  2. 文档索引了但向量不匹配');
        console.log('  3. 分数太低，排在 limit 之外');
      }
    }

    console.log('\n========================================');
    console.log('调试完成');
    console.log('========================================');

  } catch (error) {
    console.error('调试失败:', error);
    console.error('堆栈:', error.stack);
    process.exit(1);
  }
}

main();
