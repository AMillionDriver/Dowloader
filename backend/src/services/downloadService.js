import YTDlpWrap from 'yt-dlp-wrap';
import logger from './logger.js';
import path from 'path';
import fs from 'fs';
import NodeCache from 'node-cache';

// Define a path for the yt-dlp binary within the backend directory
const binaryPath = path.join(process.cwd(), 'yt-dlp.exe');
let ytDlpWrap;
const videoInfoCache = new NodeCache({ stdTTL: 3600 });

function ensureYtDlp() {
  if (!ytDlpWrap) {
    throw new Error('yt-dlp is not initialized.');
  }
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

/**
 * Resolve a download URL for a given social media link using yt-dlp.
 *
 * @param {string} url
 * @param {string} formatId
 * @returns {Promise<string>}
 */
async function resolveDownload(url, formatId) {
  ensureYtDlp();

  try {
    logger.info(`[yt-dlp] Attempting to get video URL for: ${url} (format: ${formatId})`);

    const videoUrl = await ytDlpWrap.execPromise([
      url,
      '-f',
      formatId,
      '--get-url',
    ]);

    const firstUrl = videoUrl.split('\n').map((line) => line.trim()).find(Boolean);

    if (!firstUrl) {
      throw new Error('Download URL could not be resolved.');
    }

    logger.info(`[yt-dlp] Successfully retrieved URL: ${firstUrl}`);
    return firstUrl;
  } catch (error) {
    logger.error(error, `[yt-dlp] Error resolving download for ${url} (format: ${formatId})`);
    throw error;
  }
}

export const downloadService = {
  fetchVideoInfo,
  resolveDownload,
};
