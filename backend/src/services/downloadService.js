import crypto from 'crypto';
import YTDlpWrapModule from 'yt-dlp-wrap';
import logger from './logger.js';
import path from 'path';
import fs from 'fs';

const YTDlpWrap = YTDlpWrapModule.default ?? YTDlpWrapModule;
const binaryPath = path.join(process.cwd(), 'yt-dlp.exe');
const DEFAULT_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
const DOWNLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;
const RUNTIME_VERSION = 'client-downloader-v2';
const CHUNK_ENDPOINT = '/api/download-chunk';
const TOKEN_VERSION = 1;
const FORMAT_TOKEN_TYPE = 'format';
const DOWNLOAD_TOKEN_TYPE = 'download';
const DEFAULT_TOKEN_SECRET = 'development-download-token-secret';
const DEFAULT_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

let ytDlpWrap;
let ytDlpStreamFactory = null;

function ensureYtDlp() {
  if (!ytDlpWrap) {
    throw new Error('yt-dlp is not initialized.');
  }
}

function getTokenSecret(secret = process.env.DOWNLOAD_TOKEN_SECRET) {
  return secret || DEFAULT_TOKEN_SECRET;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function createHttpError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function signPayload(encodedPayload, secret = getTokenSecret()) {
  return crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');
}

function hasValidSignature(encodedPayload, signature, secret = getTokenSecret()) {
  const expectedSignature = signPayload(encodedPayload, secret);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(String(signature || ''));

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function signDownloadToken(payload, options = {}) {
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const expiresAt = typeof options.expiresAt === 'number'
    ? options.expiresAt
    : now + DOWNLOAD_TOKEN_TTL_MS;
  const tokenPayload = {
    ...payload,
    tokenType: DOWNLOAD_TOKEN_TYPE,
    version: TOKEN_VERSION,
    expiresAt,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = signPayload(encodedPayload, options.secret);

  return `${encodedPayload}.${signature}`;
}

function verifyDownloadToken(token, options = {}) {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw createHttpError('Invalid download token.', 401, 'INVALID_TOKEN');
  }

  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature || !hasValidSignature(encodedPayload, signature, options.secret)) {
    throw createHttpError('Invalid download token.', 401, 'INVALID_TOKEN');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (error) {
    throw createHttpError('Invalid download token.', 401, 'INVALID_TOKEN');
  }

  if (payload.version !== TOKEN_VERSION) {
    throw createHttpError('Invalid download token version.', 401, 'INVALID_TOKEN');
  }

  if (payload.tokenType !== DOWNLOAD_TOKEN_TYPE) {
    throw createHttpError('Invalid download token type.', 401, 'INVALID_TOKEN');
  }

  const now = typeof options.now === 'number' ? options.now : Date.now();
  if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= now) {
    throw createHttpError('Download token expired.', 409, 'TOKEN_EXPIRED');
  }

  return payload;
}

function signFormatToken(payload, options = {}) {
  const now = typeof options.now === 'number' ? options.now : Date.now();
  const expiresAt = typeof options.expiresAt === 'number'
    ? options.expiresAt
    : now + DOWNLOAD_TOKEN_TTL_MS;
  const tokenPayload = {
    ...payload,
    tokenType: FORMAT_TOKEN_TYPE,
    version: TOKEN_VERSION,
    expiresAt,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(tokenPayload));
  const signature = signPayload(encodedPayload, options.secret);

  return `${encodedPayload}.${signature}`;
}

function verifyFormatToken(token, options = {}) {
  if (typeof token !== 'string' || !token.includes('.')) {
    throw createHttpError('Invalid format token.', 401, 'INVALID_FORMAT_TOKEN');
  }

  const [encodedPayload, signature] = token.split('.');

  if (!encodedPayload || !signature || !hasValidSignature(encodedPayload, signature, options.secret)) {
    throw createHttpError('Invalid format token.', 401, 'INVALID_FORMAT_TOKEN');
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload));
  } catch (error) {
    throw createHttpError('Invalid format token.', 401, 'INVALID_FORMAT_TOKEN');
  }

  if (payload.version !== TOKEN_VERSION || payload.tokenType !== FORMAT_TOKEN_TYPE) {
    throw createHttpError('Invalid format token.', 401, 'INVALID_FORMAT_TOKEN');
  }

  const now = typeof options.now === 'number' ? options.now : Date.now();
  if (typeof payload.expiresAt !== 'number' || payload.expiresAt <= now) {
    throw createHttpError('Format token expired.', 409, 'FORMAT_TOKEN_EXPIRED');
  }

  return payload;
}

function parseYtDlpJson(rawJson) {
  const parsedJson = rawJson
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))[0];

  if (!parsedJson) {
    throw new Error('Unable to parse video metadata.');
  }

  return parsedJson;
}

function isHttpUrl(value) {
  if (typeof value !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(value);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function isDirectHttpFormat(format) {
  if (!format?.format_id || !format?.ext || !isHttpUrl(format.url)) {
    return false;
  }

  if (format.ext === 'm3u8' || format.ext === 'm3u') {
    return false;
  }

  if (format.protocol && !/^https?$/i.test(format.protocol)) {
    return false;
  }

  const hasVideo = format.vcodec && format.vcodec !== 'none';
  const hasAudio = format.acodec && format.acodec !== 'none';

  return (hasVideo && hasAudio) || (!hasVideo && hasAudio);
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

function toPositiveInteger(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.round(value);
}

function getFileSize(format) {
  return toPositiveInteger(format?.filesize) ?? toPositiveInteger(format?.filesize_approx);
}

function createFormatPayload(format, parsedJson = {}, sourcePageUrl = '') {
  const sourceHeaders = {
    ...(parsedJson.http_headers || {}),
    ...(format.http_headers || {}),
  };
  const mimeType = inferMimeType(format.ext, format);
  const fileName = buildFileName(parsedJson.title, format.ext);

  return {
    sourceUrl: format.url,
    sourcePageUrl,
    headers: buildProxyHeaders(format.url, sourcePageUrl, sourceHeaders),
    formatId: String(format.format_id),
    ext: format.ext,
    title: parsedJson.title || 'Untitled video',
    fileName,
    mimeType,
    sizeBytes: getFileSize(format),
    chunkSizeBytes: DEFAULT_CHUNK_SIZE_BYTES,
  };
}

function normalizeFormats(formats = [], context = {}) {
  return formats
    .filter(isDirectHttpFormat)
    .map((format) => {
      const hasVideo = format.vcodec && format.vcodec !== 'none';
      const hasAudio = format.acodec && format.acodec !== 'none';
      const isAudioOnly = !hasVideo && hasAudio;
      const resolution = isAudioOnly
        ? format.abr
          ? `${format.abr} kbps`
          : 'Audio only'
        : format.height
        ? `${format.height}p`
        : format.format_note || 'Unknown';

      const formatPayload = context.parsedJson && context.sourcePageUrl
        ? createFormatPayload(format, context.parsedJson, context.sourcePageUrl)
        : null;

      return {
        formatId: String(format.format_id),
        resolution,
        ext: format.ext,
        type: isAudioOnly ? 'audio' : 'video',
        note: format.format_note || format.format || '',
        fileSize: getFileSize(format),
        mimeType: inferMimeType(format.ext, format),
        hasAudio: Boolean(hasAudio),
        hasVideo: Boolean(hasVideo),
        formatToken: formatPayload ? signFormatToken(formatPayload) : undefined,
      };
    });
}

function normalizeSubtitles(subtitles = {}, title = 'subtitle') {
  return Object.keys(subtitles)
    .sort((a, b) => a.localeCompare(b))
    .map((lang) => {
      const entries = Array.isArray(subtitles[lang]) ? subtitles[lang] : [];
      const directEntry = entries.find((entry) => isHttpUrl(entry?.url));

      if (!directEntry) {
        return null;
      }

      const ext = directEntry.ext || 'vtt';
      return {
        lang,
        ext,
        url: directEntry.url,
        fileName: sanitizeFileName(`${title}-${lang}.${ext}`),
      };
    })
    .filter(Boolean);
}

function sanitizeFileName(value, fallback = 'download') {
  const baseName = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 180);

  return baseName || fallback;
}

function buildFileName(title, ext) {
  const safeTitle = sanitizeFileName(title || 'download');
  const safeExt = String(ext || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';

  if (safeTitle.toLowerCase().endsWith(`.${safeExt}`)) {
    return safeTitle;
  }

  return `${safeTitle}.${safeExt}`;
}

function inferMimeType(ext, format = {}) {
  if (typeof format.mime_type === 'string' && format.mime_type) {
    return format.mime_type.split(';')[0].trim();
  }

  const normalizedExt = String(ext || '').toLowerCase();
  const mimeByExt = {
    mp4: 'video/mp4',
    m4v: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    mov: 'video/quicktime',
    mp3: 'audio/mpeg',
    m4a: 'audio/mp4',
    opus: 'audio/ogg',
    ogg: 'audio/ogg',
    wav: 'audio/wav',
  };

  return mimeByExt[normalizedExt] || 'application/octet-stream';
}

function filterProxyHeaders(headers = {}) {
  return Object.entries(headers).reduce((accumulator, [name, value]) => {
    const normalizedName = name.toLowerCase();

    if (HOP_BY_HOP_HEADERS.has(normalizedName)) {
      return accumulator;
    }

    if (typeof value === 'string' && value) {
      accumulator[name] = value;
    }

    return accumulator;
  }, {});
}

function getUrlOrigin(value) {
  try {
    return new URL(value).origin;
  } catch (error) {
    return null;
  }
}

function getPlatformOrigin(sourcePageUrl, sourceUrl) {
  const sourcePageOrigin = getUrlOrigin(sourcePageUrl);

  if (sourcePageOrigin) {
    return sourcePageOrigin;
  }

  try {
    const hostname = new URL(sourceUrl).hostname.toLowerCase();

    if (hostname.includes('tiktok')) {
      return 'https://www.tiktok.com';
    }

    if (hostname.includes('instagram')) {
      return 'https://www.instagram.com';
    }

    if (hostname.includes('facebook') || hostname.includes('fbcdn')) {
      return 'https://www.facebook.com';
    }
  } catch (error) {
    return null;
  }

  return null;
}

function buildProxyHeaders(sourceUrl, sourcePageUrl, headers = {}) {
  const platformOrigin = getPlatformOrigin(sourcePageUrl, sourceUrl);
  const normalizedHeaders = filterProxyHeaders(headers);
  const proxyHeaders = {
    'User-Agent': DEFAULT_BROWSER_USER_AGENT,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    ...normalizedHeaders,
  };

  if (platformOrigin) {
    proxyHeaders.Origin = proxyHeaders.Origin || platformOrigin;
    proxyHeaders.Referer = proxyHeaders.Referer || `${platformOrigin}/`;
  }

  delete proxyHeaders.Range;
  delete proxyHeaders.range;

  return proxyHeaders;
}

function createChunks(sizeBytes, chunkSizeBytes = DEFAULT_CHUNK_SIZE_BYTES) {
  const size = toPositiveInteger(sizeBytes);
  const chunkSize = toPositiveInteger(chunkSizeBytes) || DEFAULT_CHUNK_SIZE_BYTES;

  if (!size) {
    return [];
  }

  const chunks = [];
  for (let start = 0, index = 0; start < size; start += chunkSize, index += 1) {
    chunks.push({
      index,
      start,
      end: Math.min(start + chunkSize - 1, size - 1),
    });
  }

  return chunks;
}

function validateChunkRange(payload, start, end) {
  const normalizedStart = Number(start);
  const normalizedEnd = Number(end);
  const sizeBytes = toPositiveInteger(payload?.sizeBytes);
  const maxChunkSize = toPositiveInteger(payload?.chunkSizeBytes) || DEFAULT_CHUNK_SIZE_BYTES;

  if (
    !Number.isInteger(normalizedStart) ||
    !Number.isInteger(normalizedEnd) ||
    !sizeBytes ||
    normalizedStart < 0 ||
    normalizedEnd < normalizedStart ||
    normalizedEnd >= sizeBytes ||
    normalizedEnd - normalizedStart + 1 > maxChunkSize
  ) {
    throw createHttpError('Invalid chunk range.', 400, 'INVALID_RANGE');
  }

  return {
    start: normalizedStart,
    end: normalizedEnd,
  };
}

async function probeSource(sourceUrl, headers) {
  try {
    const response = await fetch(sourceUrl, {
      method: 'HEAD',
      headers,
      redirect: 'follow',
    });

    if (!response.ok) {
      return { sizeBytes: null, supportsRange: false };
    }

    const contentLength = Number.parseInt(response.headers.get('content-length') || '', 10);
    const acceptRanges = response.headers.get('accept-ranges') || '';

    return {
      sizeBytes: Number.isFinite(contentLength) && contentLength > 0 ? contentLength : null,
      supportsRange: /\bbytes\b/i.test(acceptRanges),
    };
  } catch (error) {
    logger.warn(error, 'Unable to probe direct media URL with HEAD.');
    return { sizeBytes: null, supportsRange: false };
  }
}

function mapUpstreamStatus(status) {
  if ([401, 403, 404, 410, 416].includes(status)) {
    throw createHttpError('Upstream media URL expired or was blocked.', 409, 'SOURCE_EXPIRED_OR_BLOCKED');
  }

  throw createHttpError('Failed to fetch media chunk from upstream CDN.', 502, 'UPSTREAM_FAILURE');
}

function buildChunkResponseHeaders(upstreamResponse, payload, start, end) {
  const contentLength = upstreamResponse.headers.get('content-length')
    || String(end - start + 1);
  const contentType = upstreamResponse.headers.get('content-type')
    || payload.mimeType
    || 'application/octet-stream';
  const contentRange = upstreamResponse.headers.get('content-range')
    || `bytes ${start}-${end}/${payload.sizeBytes}`;

  return {
    'Content-Type': contentType,
    'Content-Length': contentLength,
    'Content-Range': contentRange,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-store',
  };
}

async function fetchRawVideoInfo(url) {
  ensureYtDlp();

  logger.info(`[yt-dlp] Fetching metadata for: ${url}`);
  try {
    const rawJson = await ytDlpWrap.execPromise(['--dump-json', '--no-playlist', url]);
    return parseYtDlpJson(rawJson);
  } catch (error) {
    const message = String(error?.message || '');
    const code = /403|Forbidden/i.test(message)
      ? 'EXTRACTOR_FORBIDDEN'
      : 'EXTRACTOR_FAILED';
    const wrappedError = createHttpError(
      code === 'EXTRACTOR_FORBIDDEN'
        ? 'TikTok rejected metadata extraction for this URL.'
        : 'Unable to extract video metadata.',
      502,
      code
    );
    wrappedError.cause = error;
    throw wrappedError;
  }
}

async function fetchVideoInfo(url) {
  const parsedJson = await fetchRawVideoInfo(url);
  const durationSeconds = typeof parsedJson.duration === 'number' ? parsedJson.duration : null;

  return {
    title: parsedJson.title || 'Untitled video',
    thumbnail: parsedJson.thumbnail || null,
    duration: durationSeconds,
    durationFormatted: formatDuration(durationSeconds),
    formats: normalizeFormats(parsedJson.formats, { parsedJson, sourcePageUrl: url }),
    subtitles: normalizeSubtitles(parsedJson.subtitles, parsedJson.title),
  };
}

async function createFormatPayloadFromExtractor(url, formatId) {
  const parsedJson = await fetchRawVideoInfo(url);
  const selectedFormat = (parsedJson.formats || []).find(
    (format) => String(format?.format_id) === String(formatId)
  );

  if (!selectedFormat || !isDirectHttpFormat(selectedFormat)) {
    throw createHttpError(
      'Selected format is not available as a direct single-file download.',
      400,
      'FORMAT_NOT_AVAILABLE'
    );
  }

  return createFormatPayload(selectedFormat, parsedJson, url);
}

async function createDownloadManifest(url, formatId, formatToken) {
  const formatPayload = formatToken
    ? verifyFormatToken(formatToken)
    : await createFormatPayloadFromExtractor(url, formatId);

  if (String(formatPayload.formatId) !== String(formatId)) {
    throw createHttpError('Format token does not match selected format.', 400, 'FORMAT_NOT_AVAILABLE');
  }

  const probed = formatPayload.sizeBytes
    ? { sizeBytes: null, supportsRange: true }
    : await probeSource(formatPayload.sourceUrl, formatPayload.headers);
  const sizeBytes = toPositiveInteger(formatPayload.sizeBytes) ?? probed.sizeBytes;

  if (!sizeBytes) {
    throw createHttpError(
      'Selected format does not expose a file size for chunking.',
      502,
      'SIZE_UNAVAILABLE'
    );
  }

  const chunkSizeBytes = toPositiveInteger(formatPayload.chunkSizeBytes) || DEFAULT_CHUNK_SIZE_BYTES;
  const chunks = createChunks(sizeBytes, chunkSizeBytes);
  const tokenPayload = {
    sourceUrl: formatPayload.sourceUrl,
    sourcePageUrl: formatPayload.sourcePageUrl || url,
    headers: formatPayload.headers || {},
    formatId: String(formatPayload.formatId),
    fileName: formatPayload.fileName,
    mimeType: formatPayload.mimeType,
    sizeBytes,
    chunkSizeBytes,
  };
  const downloadToken = signDownloadToken(tokenPayload);
  const verifiedPayload = verifyDownloadToken(downloadToken);

  return {
    runtimeVersion: RUNTIME_VERSION,
    delivery: 'proxy',
    title: formatPayload.title || 'Untitled video',
    fileName: formatPayload.fileName,
    mimeType: formatPayload.mimeType,
    sizeBytes,
    chunkSizeBytes,
    chunkEndpoint: CHUNK_ENDPOINT,
    downloadToken,
    expiresAt: new Date(verifiedPayload.expiresAt).toISOString(),
    supportsRange: probed.supportsRange || Boolean(formatPayload.sizeBytes) || chunks.length === 1,
    chunks,
  };
}

async function fetchProxyChunk(token, start, end) {
  const payload = verifyDownloadToken(token);
  const range = validateChunkRange(payload, start, end);
  const upstreamHeaders = {
    ...buildProxyHeaders(payload.sourceUrl, payload.sourcePageUrl, payload.headers),
    Range: `bytes=${range.start}-${range.end}`,
  };

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(payload.sourceUrl, {
      method: 'GET',
      headers: upstreamHeaders,
      redirect: 'follow',
    });
  } catch (error) {
    logger.warn(error, 'Unable to fetch upstream media chunk.');
    throw createHttpError('Failed to fetch media chunk from upstream CDN.', 502, 'UPSTREAM_FAILURE');
  }

  const fullSingleChunk = range.start === 0 && range.end + 1 >= payload.sizeBytes;
  const validStatus = upstreamResponse.status === 206
    || (fullSingleChunk && upstreamResponse.status === 200);

  if (!validStatus) {
    mapUpstreamStatus(upstreamResponse.status);
  }

  return {
    statusCode: upstreamResponse.status === 206 ? 206 : 200,
    headers: buildChunkResponseHeaders(upstreamResponse, payload, range.start, range.end),
    body: upstreamResponse.body,
  };
}

function createYtDlpStreamArgs(url, formatId) {
  return ['-f', String(formatId), '--no-playlist', '-o', '-', url];
}

function getYtDlpStream(args) {
  if (ytDlpStreamFactory) {
    return ytDlpStreamFactory(args);
  }

  ensureYtDlp();
  return ytDlpWrap.execStream(args);
}

function setYtDlpStreamFactoryForTests(factory) {
  const previousFactory = ytDlpStreamFactory;
  ytDlpStreamFactory = factory;

  return () => {
    ytDlpStreamFactory = previousFactory;
  };
}

function createStreamFallback(formatToken, url, formatId) {
  const formatPayload = formatToken
    ? verifyFormatToken(formatToken)
    : null;
  const resolvedUrl = formatPayload?.sourcePageUrl || url;
  const resolvedFormatId = formatPayload?.formatId || formatId;

  if (!resolvedUrl || !resolvedFormatId) {
    throw createHttpError('A valid URL and formatId are required for stream fallback.', 400, 'STREAM_INPUT_INVALID');
  }

  if (formatPayload && String(formatPayload.formatId) !== String(formatId)) {
    throw createHttpError('Format token does not match selected format.', 400, 'FORMAT_NOT_AVAILABLE');
  }

  const stream = getYtDlpStream(createYtDlpStreamArgs(resolvedUrl, resolvedFormatId));

  return {
    fileName: formatPayload?.fileName || 'download.mp4',
    mimeType: formatPayload?.mimeType || 'application/octet-stream',
    stream,
  };
}

export async function initialize() {
  if (!fs.existsSync(binaryPath)) {
    logger.info(`Downloading yt-dlp binary to: ${binaryPath}`);
    try {
      await YTDlpWrap.downloadFromGithub(binaryPath);
      logger.info('yt-dlp binary downloaded successfully.');
    } catch (error) {
      logger.error(error, 'Failed to download yt-dlp binary.');
      throw error;
    }
  } else {
    logger.info('yt-dlp binary already exists.');
  }

  ytDlpWrap = new YTDlpWrap(binaryPath);
}

export {
  DEFAULT_CHUNK_SIZE_BYTES,
  DOWNLOAD_TOKEN_TTL_MS,
  RUNTIME_VERSION,
  createChunks,
  createFormatPayload,
  createYtDlpStreamArgs,
  filterProxyHeaders,
  buildProxyHeaders,
  normalizeFormats,
  sanitizeFileName,
  signDownloadToken,
  signFormatToken,
  setYtDlpStreamFactoryForTests,
  validateChunkRange,
  verifyDownloadToken,
  verifyFormatToken,
};

export const downloadService = {
  fetchVideoInfo,
  createDownloadManifest,
  fetchProxyChunk,
  createStreamFallback,
};
