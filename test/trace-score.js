#!/usr/bin/env node
/**
 * 追踪分数从向量搜索到最终输出的完整流程
 */

const ConfigManager = require('../scripts/lib/config');
const SearchManager = require('../scripts/lib/search-manager');
const VectorManager = require('../scripts/lib/vector-manager');
const EmbeddingManager = require('../scripts/lib/embedding-manager');
const Reranker = require('../scripts/lib/reranker');

const TEST_QUERY = '开源桌面 AI 自动化工具';

async function main() {
  console.log('========================================');
  console.log('分数流程追踪');
  console.log('========================================\n');

  try {
    const configManager = new ConfigManager();
    const config = configManager.getConfig();

    const embeddingManager = new EmbeddingManager(config.embedding);
    const vectorManager = new VectorManager(config, embeddingManager);
    await vectorManager.initialize();

    const searchManager = new SearchManager(
      null,
      vectorManager,
      null,
      config
    );

    console.log(`查询: "${TEST_QUERY}"`);
    console.log('');

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤1: 直接调用 vectorManager.hybridSearch');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const vectorResult = await vectorManager.hybridSearch(TEST_QUERY, { limit: 5 });
    console.log(`向量搜索结果数: ${vectorResult.results?.length || 0}`);
    
    if (vectorResult.results && vectorResult.results.length > 0) {
      console.log('\n向量搜索原始结果:');
      vectorResult.results.forEach((r, i) => {
        console.log(`  #${i + 1}:`);
        console.log(`    id: ${r.id}`);
        console.log(`    score: ${r.score}`);
        console.log(`    title: ${r.title?.substring(0, 30) || '无标题'}`);
        console.log(`    blockId: ${r.blockId}`);
        console.log(`    isChunk: ${r.isChunk}`);
      });
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('步骤2: 调用 searchManager.search (mode=hybrid)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const searchResult = await searchManager.search(TEST_QUERY, {
      mode: 'hybrid',
      limit: 5,
      enableRerank: false
    });

    console.log(`SearchManager 结果数: ${searchResult.results?.length || 0}`);
    
    if (searchResult.results && searchResult.results.length > 0) {
      console.log('\nSearchManager 结果:');
      searchResult.results.forEach((r, i) => {
        console.log(`  #${i + 1}:`);
        console.log(`    id: ${r.id}`);
        console.log(`    relevanceScore: ${r.relevanceScore}`);
        console.log(`    title: ${r.title?.substring(0, 30) || '无标题'}`);
        console.log(`    blockId: ${r.blockId}`);
        console.log(`    source: ${r.source}`);
      });
    }

    console.log('\n========================================');
    console.log('追踪完成');
    console.log('========================================');

  } catch (error) {
    console.error('追踪失败:', error);
    console.error('堆栈:', error.stack);
    process.exit(1);
  }
}

main();
