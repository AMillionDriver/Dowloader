const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream/promises');
const { PassThrough } = require('node:stream');
const ytdlp = require('yt-dlp-exec');
const { TEMP_DIR } = require('../config/app-config');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function fetchVideoMetadata(url) {
  const stdout = await ytdlp(url, {
    dumpSingleJson: true,
    noWarnings: true,
    noCheckCertificates: true,
    preferFreeFormats: true,
    addHeader: ['referer: https://www.google.com'],
    quiet: true,
  });
  const data = typeof stdout === 'string' ? JSON.parse(stdout) : stdout;
  return {
    id: data.id,
    title: data.title,
    duration: data.duration,
    thumbnail: data.thumbnail,
    extractor: data.extractor,
    uploader: data.uploader || data.channel || null,
    webpageUrl: data.webpage_url,
    ext: data.ext,
  };
}

function sanitizeFileName(name) {
  return name.replace(/[^a-z0-9\-_.]+/gi, '_').slice(0, 180) || 'video';
}

async function createDownloadStream(url, preferredExt = 'mp4') {
  const stream = new PassThrough();
  const child = ytdlp.exec(url, {
    output: '-',
    format: 'bestvideo+bestaudio/best',
    remuxVideo: preferredExt,
    noCheckCertificates: true,
    addHeader: ['referer: https://www.google.com'],
    progress: true,
    nThreads: 4,
    quiet: true,
  }, { stdio: ['ignore', 'pipe', 'pipe'] });

  child.stdout.pipe(stream);

  const stderrBuffer = [];
  child.stderr.on('data', (chunk) => {
    stderrBuffer.push(chunk.toString());
  });

  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderrBuffer.join('') || 'Download failed'));
      }
    });
  });

  return { stream, completion };
}

async function downloadToFile(url, filename) {
  const sanitized = sanitizeFileName(filename);
  const outputPath = path.join(TEMP_DIR, `${sanitized}-${Date.now()}.mp4`);
  const { stream, completion } = await createDownloadStream(url);
  await pipeline(stream, fs.createWriteStream(outputPath));
  await completion;
  return outputPath;
}

module.exports = {
  fetchVideoMetadata,
  createDownloadStream,
  downloadToFile,
  sanitizeFileName,
};
