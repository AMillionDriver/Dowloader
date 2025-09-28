import YTDlpWrap from 'yt-dlp-wrap';
import logger from './logger.js';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import NodeCache from 'node-cache';

// Define a path for the yt-dlp binary within the backend directory
const binaryPath = path.join(process.cwd(), 'yt-dlp.exe');
const tempDirectory = path.join(process.cwd(), 'temp');
let ytDlpWrap;
const videoInfoCache = new NodeCache({ stdTTL: 3600 });
const activeDownloads = new Map();

function ensureYtDlp() {
  if (!ytDlpWrap) {
    throw new Error('yt-dlp is not initialized.');
  }
}

async function ensureTempDirectory() {
  try {
    await fsPromises.mkdir(tempDirectory, { recursive: true });
  } catch (error) {
    logger.error(error, 'Unable to create temporary download directory.');
    throw error;
  }
}

function sanitizePercent(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const numeric = parseFloat(value.replace('%', ''));
    return Number.isFinite(numeric) ? numeric : 0;
  }

  return 0;
}

function updateDownloadRecord(id, updates) {
  const record = activeDownloads.get(id);
  if (!record) {
    return;
  }

  Object.assign(record, updates, { updatedAt: new Date().toISOString() });
}

function updateDownloadProgress(id, progressUpdates) {
  const record = activeDownloads.get(id);
  if (!record) {
    return;
  }

  record.progress = {
    ...record.progress,
    ...progressUpdates,
    percent: sanitizePercent(progressUpdates.percent ?? record.progress.percent),
  };
  record.updatedAt = new Date().toISOString();
}

async function findDownloadedFile(downloadId) {
  try {
    const entries = await fsPromises.readdir(tempDirectory);
    for (const file of entries) {
      if (!file.startsWith(`${downloadId}.`) || file.endsWith('.part')) {
        continue;
      }

      const fullPath = path.join(tempDirectory, file);
      try {
        const stats = await fsPromises.stat(fullPath);
        if (stats.isFile()) {
          return fullPath;
        }
      } catch (statError) {
        if (statError.code !== 'ENOENT') {
          logger.warn(statError, `Unable to stat downloaded file candidate ${fullPath}`);
        }
      }
    }

    return null;
  } catch (error) {
    logger.error(error, `Unable to locate downloaded file for ${downloadId}`);
    return null;
  }
}

async function finalizeSuccessfulDownload(downloadId) {
  const filePath = await findDownloadedFile(downloadId);
  if (!filePath) {
    updateDownloadRecord(downloadId, {
      status: 'error',
      error: 'The downloaded file could not be located on the server.',
    });
    return;
  }

  const fileName = path.basename(filePath);
  updateDownloadRecord(downloadId, {
    status: 'completed',
    filePath,
    fileName,
  });
  updateDownloadProgress(downloadId, {
    percent: 100,
    eta: '00:00',
  });
}

function formatDuration(seconds) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) {
    return null;
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts = [minutes.toString().padStart(2, '0'), secs.toString().padStart(2, '0')];

  if (hours > 0) {
    parts.unshift(hours.toString());
  }

  return parts.join(':');
}

function normalizeFormats(formats = []) {
  return formats
    .filter((format) => format?.format_id && format?.ext)
    .map((format) => {
      const isAudioOnly = format.vcodec === 'none';
      const resolution = isAudioOnly
        ? format.abr
          ? `${format.abr} kbps`
          : 'Audio only'
        : format.height
        ? `${format.height}p`
        : format.format_note || 'Unknown';

      return {
        formatId: format.format_id,
        resolution,
        ext: format.ext,
        type: isAudioOnly ? 'audio' : 'video',
        note: format.format_note || format.format || '',
      };
    });
}

function normalizeSubtitles(subtitles = {}) {
  return Object.keys(subtitles).sort((a, b) => a.localeCompare(b));
}

/**
 * Checks for yt-dlp binary and downloads it if not found.
 * Initializes the ytDlpWrap instance.
 */
export async function initialize() {
  if (!fs.existsSync(binaryPath)) {
    logger.info(`Downloading yt-dlp binary to: ${binaryPath}`);
    try {
      await YTDlpWrap.default.downloadFromGithub(binaryPath);
      logger.info('yt-dlp binary downloaded successfully.');
    } catch (error) {
      logger.error(error, 'Failed to download yt-dlp binary.');
      throw error; // Throw error to prevent server from starting without it
    }
  } else {
    logger.info('yt-dlp binary already exists.');
  }
  // Initialize YTDlpWrap with the binary path
  ytDlpWrap = new YTDlpWrap.default(binaryPath);
  await ensureTempDirectory();
}

/**
 * Retrieve metadata for a given video URL using yt-dlp.
 *
 * @param {string} url
 * @returns {Promise<object>}
 */
async function fetchVideoInfo(url) {
  ensureYtDlp();

  try {
    const cacheKey = url;
    const cachedInfo = videoInfoCache.get(cacheKey);

    if (cachedInfo) {
      console.log(`[cache] hit for ${cacheKey}`);
      return cachedInfo;
    }

    console.log(`[cache] miss for ${cacheKey}`);
    logger.info(`[yt-dlp] Fetching metadata for: ${url}`);
    const rawJson = await ytDlpWrap.execPromise([url, '--dump-json']);
    const parsedJson = rawJson
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line))[0];

    if (!parsedJson) {
      throw new Error('Unable to parse video metadata.');
    }

    const durationSeconds = typeof parsedJson.duration === 'number' ? parsedJson.duration : null;

    const normalizedInfo = {
      title: parsedJson.title || 'Untitled video',
      thumbnail: parsedJson.thumbnail || null,
      duration: durationSeconds,
      durationFormatted: formatDuration(durationSeconds),
      formats: normalizeFormats(parsedJson.formats),
      subtitles: normalizeSubtitles(parsedJson.subtitles),
    };

    videoInfoCache.set(cacheKey, normalizedInfo);

    return normalizedInfo;
  } catch (error) {
    logger.error(error, `[yt-dlp] Error fetching metadata for ${url}`);
    throw error;
  }
}

function createDownloadRecord(downloadId, url, formatId) {
  const now = new Date().toISOString();
  const record = {
    id: downloadId,
    url,
    formatId,
    status: 'pending',
    error: null,
    filePath: null,
    fileName: null,
    createdAt: now,
    updatedAt: now,
    progress: {
      percent: 0,
      totalSize: null,
      currentSpeed: null,
      eta: null,
      downloaded: null,
      statusText: 'pending',
    },
  };

  activeDownloads.set(downloadId, record);
  return record;
}

function attachDownloadListeners(downloadId, process) {
  process.on('progress', (progress) => {
    updateDownloadRecord(downloadId, { status: 'downloading' });
    updateDownloadProgress(downloadId, {
      percent: sanitizePercent(progress?.percent),
      totalSize: progress?.totalSize ?? null,
      currentSpeed: progress?.currentSpeed ?? null,
      eta: progress?.eta ?? null,
      downloaded: progress?.downloaded ?? null,
      statusText: progress?.status ?? progress?.state ?? 'downloading',
    });

    if (progress?.filename) {
      updateDownloadRecord(downloadId, { fileName: path.basename(progress.filename) });
    }
  });

  process.once('error', (error) => {
    logger.error(error, `yt-dlp process emitted an error for ${downloadId}`);
    updateDownloadRecord(downloadId, {
      status: 'error',
      error: error?.message || 'Download process failed unexpectedly.',
    });
  });

  process.once('close', (code) => {
    if (code === 0) {
      finalizeSuccessfulDownload(downloadId);
    } else {
      const message = `Download process exited with code ${code}.`;
      logger.error(message, { downloadId });
      updateDownloadRecord(downloadId, {
        status: 'error',
        error: message,
      });
    }
  });
}

async function queueDownload(downloadId, url, formatId) {
  ensureYtDlp();
  await ensureTempDirectory();

  const record = createDownloadRecord(downloadId, url, formatId);

  try {
    const outputTemplate = path.join(tempDirectory, `${downloadId}.%(ext)s`);
    logger.info(
      `[yt-dlp] Starting download for ${url} (format: ${formatId}) -> ${outputTemplate}`
    );

    const args = [
      '-f',
      formatId,
      '-o',
      outputTemplate,
      '--no-part',
      '--newline',
      url,
    ];

    const ytProcess = ytDlpWrap.exec(args);
    attachDownloadListeners(downloadId, ytProcess);
  } catch (error) {
    logger.error(error, `Failed to spawn yt-dlp for ${url} (${formatId})`);
    updateDownloadRecord(downloadId, {
      status: 'error',
      error: error?.message || 'Failed to start download process.',
    });
    throw error;
  }

  return record;
}

function getDownloadSnapshot(downloadId) {
  const record = activeDownloads.get(downloadId);
  if (!record) {
    return null;
  }

  const { progress, ...rest } = record;
  return {
    ...rest,
    progress: { ...progress },
  };
}

function getDownloadFileInfo(downloadId) {
  const record = activeDownloads.get(downloadId);
  if (!record || !record.filePath) {
    return null;
  }

  return {
    filePath: record.filePath,
    fileName: record.fileName ?? path.basename(record.filePath),
  };
}

async function cleanupDownload(downloadId) {
  const record = activeDownloads.get(downloadId);
  if (!record) {
    return;
  }

  if (record.filePath) {
    try {
      await fsPromises.unlink(record.filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.error(error, `Failed to delete temporary file for ${downloadId}`);
      }
    }
  }

  activeDownloads.delete(downloadId);
}

export const downloadService = {
  fetchVideoInfo,
  queueDownload,
  getDownloadSnapshot,
  getDownloadFileInfo,
  cleanupDownload,
};
