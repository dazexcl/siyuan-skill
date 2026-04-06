#!/usr/bin/env node
/**
 * 调试向量搜索 - 直接检索特定点
 */

const ConfigManager = require('../scripts/lib/config');
const VectorManager = require('../scripts/lib/vector-manager');
const EmbeddingManager = require('../scripts/lib/embedding-manager');

const TEST_QUERY = '开源桌面 AI 自动化工具';
const TEST_POINT_ID = '20260306044633-u0n0uj4';

async function main() {
  console.log('========================================');
  console.log('向量搜索调试');
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
    console.log(`目标点: ${TEST_POINT_ID}`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤1: 生成查询向量');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const queryEmbedding = await embeddingManager.generateEmbedding(TEST_QUERY);
    console.log(`查询向量维度: ${queryEmbedding.length}`);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤2: 直接检索目标点');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const point = await vectorManager.fetchAPI(
        `/collections/${vectorManager.collectionName}/points/${TEST_POINT_ID}`,
        'GET'
      );
      
      if (point && point.result) {
        console.log('找到目标点!');
        console.log(`ID: ${point.result.id}`);
        console.log(`Payload:`, point.result.payload);
        console.log(`向量存在: ${!!point.result.vector}`);
      } else {
        console.log('未找到目标点');
      }
    } catch (error) {
      console.error('检索目标点失败:', error.message);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤3: 执行向量搜索');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const searchResult = await vectorManager.semanticSearch(TEST_QUERY, { limit: 20 });
    console.log(`搜索结果数: ${searchResult.results?.length || 0}`);

    if (searchResult.results && searchResult.results.length > 0) {
      console.log('\n搜索结果列表:');
      searchResult.results.forEach((result, index) => {
        const isTarget = result.id === TEST_POINT_ID;
        const marker = isTarget ? ' 👉' : '';
        console.log(`  #${index + 1}${marker}: ${result.title?.substring(0, 30) || '无标题'}`);
        console.log(`    ID: ${result.id}`);
        console.log(`    分数: ${result.score}`);
        console.log(`    blockId: ${result.blockId}`);
        console.log(`    isChunk: ${result.isChunk}`);
      });

      const foundTarget = searchResult.results.some(r => r.id === TEST_POINT_ID);
      console.log(`\n目标点在搜索结果中: ${foundTarget ? '✅ 是' : '❌ 否'}`);

      if (!foundTarget) {
        console.log('\n⚠️ 目标点未在搜索结果中!');
        console.log('可能原因:');
        console.log('  1. 分数太低，排在 limit 之外');
        console.log('  2. 被去重了');
        console.log('  3. 向量分数为 0 或负数');
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
