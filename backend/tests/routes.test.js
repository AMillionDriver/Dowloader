import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { Readable } from 'stream';

import app from '../src/app.js';
import {
  signDownloadToken,
  signFormatToken,
  setYtDlpStreamFactoryForTests,
} from '../src/services/downloadService.js';

async function withServer(run) {
  const server = app.listen(0);

  try {
    await new Promise((resolve) => {
      server.once('listening', resolve);
    });

    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function withMockUpstream(handler, run) {
  const server = http.createServer(handler);

  try {
    server.listen(0);
    await new Promise((resolve) => {
      server.once('listening', resolve);
    });

    const { port } = server.address();
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('health endpoint responds successfully', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('removed server-side download routes return 404', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/prepare-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/video', formatId: '18' }),
    });

    assert.equal(response.status, 404);
  });
});

test('download manifest validates missing URL', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/download-manifest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formatId: '18' }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Video URL is required' });
  });
});

test('download chunk validates missing token', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/download-chunk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start: 0, end: 3 }),
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'A valid download token is required.' });
  });
});

test('download manifest uses a signed format token without re-extracting metadata', async () => {
  const formatToken = signFormatToken({
    sourceUrl: 'https://cdn.example/video.mp4',
    sourcePageUrl: 'https://www.tiktok.com/@user/video/123',
    headers: { 'User-Agent': 'yt-dlp-test' },
    sizeBytes: 10,
    chunkSizeBytes: 4,
    fileName: 'video.mp4',
    mimeType: 'video/mp4',
    formatId: '18',
    title: 'Video',
  });

  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/download-manifest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: 'https://www.tiktok.com/@user/video/123',
        formatId: '18',
        formatToken,
      }),
    });

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.delivery, 'proxy');
    assert.equal(payload.fileName, 'video.mp4');
    assert.equal(payload.sizeBytes, 10);
    assert.equal(payload.chunkEndpoint, '/api/download-chunk');
    assert.equal(typeof payload.downloadToken, 'string');
    assert.deepEqual(payload.chunks, [
      { index: 0, start: 0, end: 3 },
      { index: 1, start: 4, end: 7 },
      { index: 2, start: 8, end: 9 },
    ]);
  });
});

test('download chunk streams bytes from upstream and forwards range headers', async () => {
  let observedRange = null;
  let observedUserAgent = null;

  await withMockUpstream((req, res) => {
    observedRange = req.headers.range;
    observedUserAgent = req.headers['user-agent'];
    res.writeHead(206, {
      'Content-Type': 'video/mp4',
      'Content-Length': '4',
      'Content-Range': 'bytes 0-3/10',
    });
    res.end(Buffer.from([1, 2, 3, 4]));
  }, async (upstreamUrl) => {
    const token = signDownloadToken(
      {
        sourceUrl: `${upstreamUrl}/video.mp4`,
        headers: { 'User-Agent': 'proxy-test-agent' },
        sizeBytes: 10,
        chunkSizeBytes: 4,
        fileName: 'video.mp4',
        mimeType: 'video/mp4',
        formatId: '18',
      },
      { secret: 'development-download-token-secret' }
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/download-chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, start: 0, end: 3 }),
      });

      assert.equal(response.status, 206);
      assert.equal(response.headers.get('content-range'), 'bytes 0-3/10');
      assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3, 4]);
      assert.equal(observedRange, 'bytes=0-3');
      assert.equal(observedUserAgent, 'proxy-test-agent');
    });
  });
});

test('download chunk maps upstream forbidden responses to refreshable errors', async () => {
  await withMockUpstream((_req, res) => {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('forbidden');
  }, async (upstreamUrl) => {
    const token = signDownloadToken(
      {
        sourceUrl: `${upstreamUrl}/video.mp4`,
        headers: {},
        sizeBytes: 10,
        chunkSizeBytes: 4,
        fileName: 'video.mp4',
        mimeType: 'video/mp4',
        formatId: '18',
      },
      { secret: 'development-download-token-secret' }
    );

    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/download-chunk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, start: 0, end: 3 }),
      });

      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, 'SOURCE_EXPIRED_OR_BLOCKED');
    });
  });
});

test('download stream fallback pipes yt-dlp stdout without writing a server file', async () => {
  let observedArgs = null;
  const restoreStreamFactory = setYtDlpStreamFactoryForTests((args) => {
    observedArgs = args;
    return Readable.from(Buffer.from([9, 8, 7]));
  });
  const formatToken = signFormatToken({
    sourceUrl: 'https://cdn.example/video.mp4',
    sourcePageUrl: 'https://www.tiktok.com/@user/video/123',
    headers: {},
    sizeBytes: 3,
    chunkSizeBytes: 4,
    fileName: 'video.mp4',
    mimeType: 'video/mp4',
    formatId: '18',
    title: 'Video',
  });

  try {
    await withServer(async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/download-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://www.tiktok.com/@user/video/123',
          formatId: '18',
          formatToken,
        }),
      });

      assert.equal(response.status, 200);
      assert.equal(response.headers.get('content-type'), 'video/mp4');
      assert.match(response.headers.get('content-disposition'), /video\.mp4/);
      assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [9, 8, 7]);
      assert.deepEqual(observedArgs, [
        '-f',
        '18',
        '--no-playlist',
        '-o',
        '-',
        'https://www.tiktok.com/@user/video/123',
      ]);
    });
  } finally {
    restoreStreamFactory();
  }
});
