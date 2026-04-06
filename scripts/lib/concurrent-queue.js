/**
 * 并发队列
 * 实现带并发控制的任务队列，不依赖第三方库
 */

class ConcurrentQueue {
  constructor(concurrency = 1) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
    this.results = [];
    this.errors = [];
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.run();
    });
  }

  async run() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      this.results.push(result);
      resolve(result);
    } catch (error) {
      this.errors.push(error);
      reject(error);
    } finally {
      this.running--;
      this.run();
    }
  }

  async waitForAll() {
    while (this.running > 0 || this.queue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    return {
      results: this.results,
      errors: this.errors
    };
  }

  getQueueLength() {
    return this.queue.length;
  }

  getRunningCount() {
    return this.running;
  }
}

module.exports = ConcurrentQueue;
