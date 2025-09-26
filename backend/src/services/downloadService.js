import YTDlpWrap from 'yt-dlp-wrap';
import logger from './logger.js';
import path from 'path';
import fs from 'fs';

// Define a path for the yt-dlp binary within the backend directory
const binaryPath = path.join(process.cwd(), 'yt-dlp.exe');
let ytDlpWrap;

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
 * Resolve a download URL for a given social media link using yt-dlp.
 *
 * @param {string} url
 * @returns {Promise<string|null>}
 */
async function resolveDownload(url) {
  if (!url) return null;

  try {
    logger.info(`[yt-dlp] Attempting to get video URL for: ${url}`);

    const videoUrl = await ytDlpWrap.execPromise([
      url,
      '-f',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--get-url',
    ]);

    // yt-dlp can return multiple URLs (video + audio), separated by newlines.
    // We'll take the first one, which is typically the main video content.
    const firstUrl = videoUrl.split('\n')[0].trim();

    logger.info(`[yt-dlp] Successfully retrieved URL: ${firstUrl}`);
    return firstUrl;
  } catch (error) {
    logger.error(error, `[yt-dlp] Error resolving download for ${url}`);
    return null;
  }
}

export const downloadService = {
  resolveDownload,
};