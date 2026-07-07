export const RUNTIME_VERSION = 'client-downloader-v2';
export const RUNTIME_STORAGE_KEY = 'clientDownloaderRuntime:v2';
export const DEFAULT_CHUNK_SIZE_BYTES = 8 * 1024 * 1024;
export const DEFAULT_CONCURRENCY = 3;
export const STREAM_FALLBACK_CODE = 'SOURCE_EXPIRED_OR_BLOCKED';

const FORBIDDEN_BROWSER_HEADERS = new Set([
  'accept-encoding',
  'access-control-request-headers',
  'access-control-request-method',
  'connection',
  'content-length',
  'cookie',
  'cookie2',
  'date',
  'dnt',
  'expect',
  'host',
  'keep-alive',
  'origin',
  'referer',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'user-agent',
  'via',
]);

function getBrowserStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }

  return null;
}

function toPositiveInteger(value, fallback) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.round(numberValue)
    : fallback;
}

export function createDefaultRuntimeSettings() {
  return {
    version: RUNTIME_VERSION,
    chunkSizeBytes: DEFAULT_CHUNK_SIZE_BYTES,
    concurrency: DEFAULT_CONCURRENCY,
  };
}

export function ensureRuntimeSettings(storage) {
  const targetStorage = getBrowserStorage(storage);
  const defaults = createDefaultRuntimeSettings();

  if (!targetStorage) {
    return defaults;
  }

  try {
    const rawValue = targetStorage.getItem(RUNTIME_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : null;

    if (parsedValue?.version === RUNTIME_VERSION) {
      const settings = {
        version: RUNTIME_VERSION,
        chunkSizeBytes: toPositiveInteger(
          parsedValue.chunkSizeBytes,
          DEFAULT_CHUNK_SIZE_BYTES
        ),
        concurrency: toPositiveInteger(parsedValue.concurrency, DEFAULT_CONCURRENCY),
      };

      targetStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(settings));
      return settings;
    }

    targetStorage.setItem(RUNTIME_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  } catch (error) {
    return defaults;
  }
}

export function createChunkRanges(sizeBytes, chunkSizeBytes = DEFAULT_CHUNK_SIZE_BYTES) {
  const size = toPositiveInteger(sizeBytes, 0);
  const chunkSize = toPositiveInteger(chunkSizeBytes, DEFAULT_CHUNK_SIZE_BYTES);

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

export function sanitizeFileName(value, fallback = 'download') {
  const safeName = String(value || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 180);

  return safeName || fallback;
}

export function buildSuggestedFileName(title, ext) {
  const safeExt = String(ext || 'bin').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin';
  const safeTitle = sanitizeFileName(title || 'download');

  if (safeTitle.toLowerCase().endsWith(`.${safeExt}`)) {
    return safeTitle;
  }

  return `${safeTitle}.${safeExt}`;
}

function filterRequestHeaders(headers = {}) {
  return Object.entries(headers).reduce((accumulator, [name, value]) => {
    const normalizedName = name.toLowerCase();

    if (
      FORBIDDEN_BROWSER_HEADERS.has(normalizedName) ||
      normalizedName.startsWith('proxy-') ||
      normalizedName.startsWith('sec-')
    ) {
      return accumulator;
    }

    if (typeof value === 'string' && value) {
      accumulator[name] = value;
    }

    return accumulator;
  }, {});
}

function getExtension(fileName) {
  const match = String(fileName || '').match(/\.([a-z0-9]+)$/i);
  return match ? `.${match[1].toLowerCase()}` : '.bin';
}

export function supportsFileSystemAccess() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

export async function selectFileSystemTarget({ suggestedName, mimeType }) {
  if (!supportsFileSystemAccess()) {
    return null;
  }

  const fileName = sanitizeFileName(suggestedName);
  const extension = getExtension(fileName);
  const acceptType = String(mimeType || 'application/octet-stream').split(';')[0].trim();

  const handle = await window.showSaveFilePicker({
    suggestedName: fileName,
    types: [
      {
        description: 'Media file',
        accept: {
          [acceptType]: [extension],
        },
      },
    ],
  });

  return {
    kind: 'file-system-access',
    handle,
  };
}

function createDownloadError(error) {
  if (error?.name === 'AbortError') {
    return error;
  }

  const wrappedError = new Error(
    error?.message || 'The server could not proxy this media chunk from the platform CDN.'
  );
  wrappedError.code = error?.code || 'PROXY_DOWNLOAD_FAILED';
  wrappedError.status = error?.status;
  wrappedError.cause = error;
  return wrappedError;
}

function assertNotAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException('Download canceled.', 'AbortError');
  }
}

function resolveChunkUrl(chunkEndpoint, apiBaseUrl = '') {
  if (!chunkEndpoint) {
    return '';
  }

  try {
    return new URL(chunkEndpoint).toString();
  } catch (error) {
    const baseUrl =
      apiBaseUrl ||
      (typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return new URL(chunkEndpoint, baseUrl).toString();
  }
}

async function parseProxyError(response) {
  let payload = null;

  try {
    payload = await response.clone().json();
  } catch (error) {
    payload = null;
  }

  const code = payload?.code || 'PROXY_DOWNLOAD_FAILED';
  const messageByCode = {
    INVALID_RANGE: 'The server rejected an invalid chunk range.',
    INVALID_TOKEN: 'The download token is invalid. Please restart the download.',
    TOKEN_EXPIRED: 'The download token expired before this chunk finished.',
    SOURCE_EXPIRED: 'The platform media URL expired before this chunk finished.',
    SOURCE_EXPIRED_OR_BLOCKED: 'The platform media URL expired or blocked ranged proxy download.',
    UPSTREAM_FAILURE: 'The server could not fetch this chunk from the platform CDN.',
    STREAM_FALLBACK_FAILED: 'The server could not stream this media through yt-dlp.',
  };
  const error = new Error(payload?.error || messageByCode[code] || messageByCode.UPSTREAM_FAILURE);
  error.code = code;
  error.status = response.status;
  return error;
}

function shouldRefreshManifest(error) {
  return error?.code === 'TOKEN_EXPIRED';
}

async function refreshManifestOnce(manifestRef, options) {
  if (manifestRef.refreshed || typeof options.refreshManifest !== 'function') {
    if (manifestRef.refreshPromise) {
      await manifestRef.refreshPromise;
    }
    return manifestRef.refreshed;
  }

  manifestRef.refreshed = true;
  manifestRef.refreshPromise = Promise.resolve(options.refreshManifest())
    .then((refreshedManifest) => {
      if (!refreshedManifest?.downloadToken || !refreshedManifest?.chunkEndpoint) {
        throw new Error('The refreshed download manifest is incomplete.');
      }

      manifestRef.current = refreshedManifest;
      return refreshedManifest;
    })
    .finally(() => {
      manifestRef.refreshPromise = null;
    });

  await manifestRef.refreshPromise;
  return true;
}

async function fetchChunk(manifestRef, chunk, signal, options, hasRetried = false) {
  assertNotAborted(signal);

  const manifest = manifestRef.current;
  const chunkUrl = resolveChunkUrl(manifest.chunkEndpoint, options.apiBaseUrl);

  let response;
  try {
    response = await fetch(chunkUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        token: manifest.downloadToken,
        start: chunk.start,
        end: chunk.end,
      }),
      mode: 'cors',
      signal,
    });
  } catch (error) {
    throw createDownloadError(error);
  }

  const singleChunk = chunk.start === 0 && chunk.end + 1 >= manifestRef.current.sizeBytes;
  const validStatus = response.status === 206 || (singleChunk && response.status === 200);

  if (!validStatus) {
    const proxyError = await parseProxyError(response);

    if (
      shouldRefreshManifest(proxyError) &&
      !hasRetried &&
      await refreshManifestOnce(manifestRef, options)
    ) {
      return fetchChunk(manifestRef, chunk, signal, options, true);
    }

    throw createDownloadError(proxyError);
  }

  try {
    return await response.arrayBuffer();
  } catch (error) {
    throw createDownloadError(error);
  }
}

async function runPool(items, concurrency, worker) {
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length || 1);

  async function runWorker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex]);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, runWorker));
}

function reportProgress(onProgress, downloadedBytes, totalBytes) {
  if (typeof onProgress !== 'function') {
    return;
  }

  const percent = totalBytes > 0 ? Math.min(100, (downloadedBytes / totalBytes) * 100) : 0;
  onProgress({
    downloadedBytes,
    totalBytes,
    percent,
  });
}

function triggerBlobDownload(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const revokeObjectUrl = URL.revokeObjectURL.bind(URL);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  const scheduleRevoke = typeof window !== 'undefined' ? window.setTimeout : setTimeout;
  const revokeTimer = scheduleRevoke(() => revokeObjectUrl(objectUrl), 30000);
  if (typeof revokeTimer?.unref === 'function') {
    revokeTimer.unref();
  }
}

export function triggerBlobSave(blob, fileName) {
  triggerBlobDownload(blob, sanitizeFileName(fileName || 'download'));
}

async function downloadToWritable(manifestRef, chunks, settings, target, signal, onProgress, options) {
  const writable = await target.handle.createWritable();
  let downloadedBytes = 0;
  let writeQueue = Promise.resolve();

  try {
    await runPool(chunks, settings.concurrency, async (chunk) => {
      const buffer = await fetchChunk(manifestRef, chunk, signal, options);
      const writeTask = writeQueue.then(() =>
        writable.write({
          type: 'write',
          position: chunk.start,
          data: buffer,
        })
      );
      writeQueue = writeTask.catch(() => {});
      await writeTask;

      downloadedBytes += buffer.byteLength;
      reportProgress(onProgress, downloadedBytes, manifestRef.current.sizeBytes);
    });

    await writeQueue;
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch (abortError) {
      // The original download error is more useful to the caller.
    }

    throw error;
  }
}

async function downloadToBlob(manifestRef, chunks, settings, signal, onProgress, options) {
  const parts = [];
  let downloadedBytes = 0;

  await runPool(chunks, settings.concurrency, async (chunk) => {
    const buffer = await fetchChunk(manifestRef, chunk, signal, options);
    parts[chunk.index] = buffer;
    downloadedBytes += buffer.byteLength;
    reportProgress(onProgress, downloadedBytes, manifestRef.current.sizeBytes);
  });

  assertNotAborted(signal);
  const blob = new Blob(parts, {
    type: manifestRef.current.mimeType || 'application/octet-stream',
  });
  triggerBlobDownload(blob, manifestRef.current.fileName || 'download.bin');
}

async function writeStreamToFile(response, target, signal, onProgress, totalBytes) {
  const writable = await target.handle.createWritable();
  const reader = response.body?.getReader();
  let downloadedBytes = 0;

  try {
    if (!reader) {
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      assertNotAborted(signal);
      await writable.write(buffer);
      downloadedBytes = buffer.byteLength;
      reportProgress(onProgress, downloadedBytes, totalBytes || downloadedBytes);
      await writable.close();
      return;
    }

    while (true) {
      assertNotAborted(signal);
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      await writable.write(value);
      downloadedBytes += value.byteLength;
      reportProgress(onProgress, downloadedBytes, totalBytes || downloadedBytes);
    }

    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch (abortError) {
      // Keep the original stream error visible to the caller.
    }

    throw error;
  }
}

async function saveStreamAsBlob(response, fileName, mimeType, signal, onProgress, totalBytes) {
  const reader = response.body?.getReader();

  if (!reader) {
    const blob = await response.blob();
    assertNotAborted(signal);
    reportProgress(onProgress, totalBytes || blob.size, totalBytes || blob.size);
    triggerBlobDownload(
      new Blob([blob], { type: mimeType || blob.type || 'application/octet-stream' }),
      sanitizeFileName(fileName || 'download')
    );
    return;
  }

  const parts = [];
  let downloadedBytes = 0;

  while (true) {
    assertNotAborted(signal);
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    parts.push(value);
    downloadedBytes += value.byteLength;
    reportProgress(onProgress, downloadedBytes, totalBytes || downloadedBytes);
  }

  const blob = new Blob(parts, {
    type: mimeType || response.headers.get('content-type') || 'application/octet-stream',
  });
  triggerBlobDownload(blob, sanitizeFileName(fileName || 'download'));
}

export async function downloadManifest(manifest, options = {}) {
  if (!manifest?.downloadToken || !manifest?.chunkEndpoint || !manifest?.sizeBytes) {
    throw new Error('The download manifest is incomplete.');
  }

  const settings = ensureRuntimeSettings(options.storage);
  const manifestRef = {
    current: manifest,
    refreshed: false,
    refreshPromise: null,
  };
  const chunks = Array.isArray(manifest.chunks) && manifest.chunks.length > 0
    ? manifest.chunks
    : createChunkRanges(manifest.sizeBytes, settings.chunkSizeBytes);

  if (chunks.length === 0) {
    throw new Error('The download manifest is incomplete.');
  }

  reportProgress(options.onProgress, 0, manifest.sizeBytes);

  if (options.fileTarget?.kind === 'file-system-access') {
    await downloadToWritable(
      manifestRef,
      chunks,
      settings,
      options.fileTarget,
      options.signal,
      options.onProgress,
      options
    );
    return;
  }

  await downloadToBlob(manifestRef, chunks, settings, options.signal, options.onProgress, options);
}

export async function downloadStreamFallback(streamRequest, options = {}) {
  if (!streamRequest?.streamEndpoint || !streamRequest?.request) {
    throw new Error('The stream fallback request is incomplete.');
  }

  const streamUrl = resolveChunkUrl(streamRequest.streamEndpoint, options.apiBaseUrl);
  let response;

  try {
    response = await fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(streamRequest.request),
      mode: 'cors',
      signal: options.signal,
    });
  } catch (error) {
    throw createDownloadError(error);
  }

  if (!response.ok) {
    throw createDownloadError(await parseProxyError(response));
  }

  const totalBytes = toPositiveInteger(
    response.headers.get('content-length'),
    toPositiveInteger(streamRequest.sizeBytes, 0)
  );
  const mimeType = streamRequest.mimeType
    || response.headers.get('content-type')
    || 'application/octet-stream';

  reportProgress(options.onProgress, 0, totalBytes);

  if (options.fileTarget?.kind === 'file-system-access') {
    await writeStreamToFile(
      response,
      options.fileTarget,
      options.signal,
      options.onProgress,
      totalBytes
    );
    return;
  }

  await saveStreamAsBlob(
    response,
    streamRequest.fileName,
    mimeType,
    options.signal,
    options.onProgress,
    totalBytes
  );
}

export async function downloadDirectResource({
  sourceUrl,
  fileName,
  mimeType,
  headers,
  signal,
}) {
  try {
    const response = await fetch(sourceUrl, {
      headers: filterRequestHeaders(headers),
      mode: 'cors',
      signal,
    });

    if (!response.ok) {
      throw new Error(`Unexpected CDN response status: ${response.status}`);
    }

    const blob = await response.blob();
    triggerBlobDownload(
      new Blob([blob], { type: mimeType || blob.type || 'application/octet-stream' }),
      sanitizeFileName(fileName || 'download')
    );
  } catch (error) {
    throw createDownloadError(error);
  }
}
