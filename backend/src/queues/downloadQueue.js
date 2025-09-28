import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';

import logger from '../services/logger.js';

dotenv.config();

function buildRedisOptions() {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }

  return {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: null,
  };
}

const connection = new IORedis(buildRedisOptions());

connection.on('error', (error) => {
  logger.error(error, 'Redis connection error');
});

const downloadQueue = new Queue('downloads', {
  connection,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 100,
  },
});

export { downloadQueue, connection };
