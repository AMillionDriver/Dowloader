import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import ytdlp from 'yt-dlp-exec';

import {
  createEncryptedPayload,
  decryptPayload,
  createSignedToken,
  validateSignedToken,
  hashValue,
} from '../utils/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const downloadDir = process.env.DOWNLOAD_DIR || path.join(__dirname, '../../downloads');

async function ensureDownloadDir() {
  await fsPromises.mkdir(downloadDir, { recursive: true });
}

const downloadStore = new Map();

async function cleanupExpiredDownloads() {
  const now = Date.now();
  for (const [key, value] of downloadStore.entries()) {
    if (value.expiresAt <= now) {
      try {
        const metadata = decryptPayload(value.metadata);
        await fsPromises.unlink(metadata.filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.error('Failed to remove expired download', error);
        }
      }
      downloadStore.delete(key);
    }
  }
}

setInterval(cleanupExpiredDownloads, 10 * 60 * 1000).unref();

const SUPPORTED_HOSTS = ['tiktok.com', 'instagram.com', 'facebook.com', 'fb.watch'];

function isSupportedUrl(url) {
  try {
    const { hostname } = new URL(url);
    return SUPPORTED_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch (error) {
    return false;
  }
}

export async function requestDownload(url) {
  if (!isSupportedUrl(url)) {
    const error = new Error('Unsupported URL. Only TikTok, Instagram, and Facebook are allowed.');
    error.statusCode = 400;
    throw error;
  }

  await ensureDownloadDir();

  const downloadId = randomUUID().replace(/-/g, '');
  const baseFilePath = path.join(downloadDir, downloadId);
  const outputTemplate = `${baseFilePath}.%(ext)s`;

  await ytdlp(url, {
    output: outputTemplate,
    mergeOutputFormat: 'mp4',
    format: 'bestvideo*+bestaudio/best',
    noWarnings: true,
    restrictFilenames: true,
    noCallHome: true,
    noCheckCertificates: true,
    addHeader: [
      'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language: en-US,en;q=0.9',
    ],
  });

  const files = await fsPromises.readdir(downloadDir);
  const fileName = files.find((name) => name.startsWith(downloadId));

  if (!fileName) {
    const error = new Error('Failed to process download. Try again later.');
    error.statusCode = 500;
    throw error;
  }

  const filePath = path.join(downloadDir, fileName);
  const fileStats = await fsPromises.stat(filePath);
  const expiresAt = Date.now() + 30 * 60 * 1000; // 30 minutes

  const encryptedMetadata = createEncryptedPayload({
    filePath,
    fileName,
    size: fileStats.size,
    mimeType: 'video/mp4',
  });

  const hashedId = hashValue(downloadId);
  downloadStore.set(hashedId, {
    metadata: encryptedMetadata,
    expiresAt,
  });

  const { signature } = createSignedToken(downloadId, expiresAt);

  return {
    downloadId,
    fileName,
    size: fileStats.size,
    expiresAt,
    signature,
  };
}

export function resolveDownload(downloadId, expiresAt, signature) {
  if (!validateSignedToken(downloadId, expiresAt, signature)) {
    return null;
  }

  const hashedId = hashValue(downloadId);
  const entry = downloadStore.get(hashedId);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt.toString() !== expiresAt.toString()) {
    return null;
  }

  if (Date.now() > Number(expiresAt)) {
    downloadStore.delete(hashedId);
    return null;
  }

  const metadata = decryptPayload(entry.metadata);
  return metadata;
}

export async function markDownloadComplete(downloadId) {
  const hashedId = hashValue(downloadId);
  const entry = downloadStore.get(hashedId);
  if (!entry) {
    return;
  }

  try {
    const metadata = decryptPayload(entry.metadata);
    await fsPromises.unlink(metadata.filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to delete downloaded file', error);
    }
  }
  downloadStore.delete(hashedId);
}
