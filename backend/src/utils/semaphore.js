class Semaphore {
  constructor(maxConcurrent = 1) {
    this.maxConcurrent = maxConcurrent;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.maxConcurrent) {
      this.current += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release() {
    this.current = Math.max(0, this.current - 1);
    if (this.queue.length > 0) {
      const next = this.queue.shift();
      this.current += 1;
      next();
    }
  }
}

module.exports = Semaphore;
