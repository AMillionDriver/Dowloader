import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CHUNK_SIZE_BYTES,
  createChunks,
  createYtDlpStreamArgs,
  buildProxyHeaders,
  filterProxyHeaders,
  normalizeFormats,
  sanitizeFileName,
  signDownloadToken,
  signFormatToken,
  validateChunkRange,
  verifyDownloadToken,
  verifyFormatToken,
} from '../src/services/downloadService.js';

test('createChunks creates byte ranges with the configured chunk size', () => {
  assert.deepEqual(createChunks(10, 4), [
    { index: 0, start: 0, end: 3 },
    { index: 1, start: 4, end: 7 },
    { index: 2, start: 8, end: 9 },
  ]);

  assert.equal(createChunks(DEFAULT_CHUNK_SIZE_BYTES + 1).length, 2);
});

test('sanitizeFileName strips unsafe path characters', () => {
  assert.equal(sanitizeFileName('../bad:name?.mp4'), '-bad-name-.mp4');
  assert.equal(sanitizeFileName(''), 'download');
});

test('filterProxyHeaders preserves upstream request headers and removes hop-by-hop headers', () => {
  assert.deepEqual(
    filterProxyHeaders({
      'User-Agent': 'yt-dlp',
      Referer: 'https://www.tiktok.com/',
      Host: 'cdn.example',
      Connection: 'keep-alive',
      Accept: '*/*',
    }),
    {
      'User-Agent': 'yt-dlp',
      Referer: 'https://www.tiktok.com/',
      Accept: '*/*',
    }
  );
});

test('buildProxyHeaders adds browser-like platform headers for upstream CDN requests', () => {
  assert.deepEqual(
    buildProxyHeaders(
      'https://v16-webapp-prime.tiktok.com/video/tos/example',
      'https://www.tiktok.com/@user/video/123',
      { Connection: 'keep-alive' }
    ),
    {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Origin: 'https://www.tiktok.com',
      Referer: 'https://www.tiktok.com/',
    }
  );
});

test('normalizeFormats keeps only direct single-file formats', () => {
  const formats = normalizeFormats([
    {
      format_id: '18',
      ext: 'mp4',
      protocol: 'https',
      url: 'https://cdn.example/video.mp4',
      vcodec: 'avc1',
      acodec: 'mp4a',
      height: 360,
      filesize: 123,
    },
    {
      format_id: 'video-only',
      ext: 'mp4',
      protocol: 'https',
      url: 'https://cdn.example/video-only.mp4',
      vcodec: 'avc1',
      acodec: 'none',
    },
    {
      format_id: 'hls',
      ext: 'mp4',
      protocol: 'm3u8_native',
      url: 'https://cdn.example/playlist.m3u8',
      vcodec: 'avc1',
      acodec: 'mp4a',
    },
  ]);

  assert.equal(formats.length, 1);
  assert.equal(formats[0].formatId, '18');
  assert.equal(formats[0].hasAudio, true);
  assert.equal(formats[0].hasVideo, true);
});

test('normalizeFormats includes signed format tokens when metadata context is available', () => {
  const formats = normalizeFormats(
    [
      {
        format_id: '18',
        ext: 'mp4',
        protocol: 'https',
        url: 'https://cdn.example/video.mp4',
        vcodec: 'avc1',
        acodec: 'mp4a',
        height: 360,
        filesize: 123,
        http_headers: { 'User-Agent': 'yt-dlp-test' },
      },
    ],
    {
      parsedJson: { title: 'Token Video' },
      sourcePageUrl: 'https://www.tiktok.com/@user/video/123',
    }
  );

  assert.equal(formats.length, 1);
  assert.equal(typeof formats[0].formatToken, 'string');

  const payload = verifyFormatToken(formats[0].formatToken);
  assert.equal(payload.sourceUrl, 'https://cdn.example/video.mp4');
  assert.equal(payload.sourcePageUrl, 'https://www.tiktok.com/@user/video/123');
  assert.equal(payload.fileName, 'Token Video.mp4');
});

test('download token is signed, verified, and expires without server storage', () => {
  const token = signDownloadToken(
    {
      sourceUrl: 'https://cdn.example/video.mp4',
      headers: { 'User-Agent': 'test' },
      sizeBytes: 10,
      chunkSizeBytes: 4,
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      formatId: '18',
    },
    {
      now: 1000,
      expiresAt: 2000,
      secret: 'test-secret',
    }
  );

  const payload = verifyDownloadToken(token, { now: 1500, secret: 'test-secret' });
  assert.equal(payload.sourceUrl, 'https://cdn.example/video.mp4');
  assert.equal(payload.headers['User-Agent'], 'test');

  assert.throws(
    () => verifyDownloadToken(token, { now: 2000, secret: 'test-secret' }),
    { code: 'TOKEN_EXPIRED', statusCode: 409 }
  );
  assert.throws(
    () => verifyDownloadToken(`${token}tampered`, { now: 1500, secret: 'test-secret' }),
    { code: 'INVALID_TOKEN', statusCode: 401 }
  );
});

test('format token is signed separately from download token', () => {
  const token = signFormatToken(
    {
      sourceUrl: 'https://cdn.example/video.mp4',
      sourcePageUrl: 'https://www.tiktok.com/@user/video/123',
      headers: { 'User-Agent': 'test' },
      sizeBytes: 10,
      chunkSizeBytes: 4,
      fileName: 'video.mp4',
      mimeType: 'video/mp4',
      formatId: '18',
    },
    {
      now: 1000,
      expiresAt: 2000,
      secret: 'test-secret',
    }
  );

  const payload = verifyFormatToken(token, { now: 1500, secret: 'test-secret' });
  assert.equal(payload.formatId, '18');
  assert.equal(payload.sourcePageUrl, 'https://www.tiktok.com/@user/video/123');

  assert.throws(
    () => verifyFormatToken(token, { now: 2000, secret: 'test-secret' }),
    { code: 'FORMAT_TOKEN_EXPIRED', statusCode: 409 }
  );
  assert.throws(
    () => verifyDownloadToken(token, { now: 1500, secret: 'test-secret' }),
    { code: 'INVALID_TOKEN', statusCode: 401 }
  );
});

test('createYtDlpStreamArgs streams the selected format to stdout', () => {
  assert.deepEqual(
    createYtDlpStreamArgs('https://www.tiktok.com/@user/video/123', '18'),
    ['-f', '18', '--no-playlist', '-o', '-', 'https://www.tiktok.com/@user/video/123']
  );
});

test('validateChunkRange enforces token size and chunk limits', () => {
  const payload = {
    sizeBytes: 10,
    chunkSizeBytes: 4,
  };

  assert.deepEqual(validateChunkRange(payload, 4, 7), { start: 4, end: 7 });
  assert.throws(() => validateChunkRange(payload, 4, 8), {
    code: 'INVALID_RANGE',
    statusCode: 400,
  });
  assert.throws(() => validateChunkRange(payload, 8, 10), {
    code: 'INVALID_RANGE',
    statusCode: 400,
  });
});
