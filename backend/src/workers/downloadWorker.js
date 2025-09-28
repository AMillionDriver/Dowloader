import { Worker } from 'bullmq';

import logger from '../services/logger.js';
import { connection } from '../queues/downloadQueue.js';
import { processDownloadJob } from '../services/downloadService.js';

const requestedConcurrency = Number.parseInt(process.env.DOWNLOAD_WORKER_CONCURRENCY ?? '3', 10);
const concurrency = Number.isFinite(requestedConcurrency) && requestedConcurrency > 0
  ? requestedConcurrency
  : 3;

const downloadWorker = new Worker(
  'downloads',
  async (job) => {
    const { downloadId, url, formatId } = job.data || {};

    if (!downloadId || !url || !formatId) {
      throw new Error('Invalid job payload.');
    }

    await processDownloadJob(downloadId, url, formatId);
  },
  {
    connection,
    concurrency,
  }
);

downloadWorker.on('completed', (job) => {
  const downloadId = job.data?.downloadId;
  logger.info({ downloadId, jobId: job.id }, 'Download job completed');
});

downloadWorker.on('failed', (job, error) => {
  const downloadId = job?.data?.downloadId;
  logger.error(error, `Download job failed${downloadId ? ` (${downloadId})` : ''}`);
});

export default downloadWorker;
