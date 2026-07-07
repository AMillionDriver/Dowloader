import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_CONCURRENCY,
  RUNTIME_STORAGE_KEY,
  RUNTIME_VERSION,
  createChunkRanges,
  downloadManifest,
  downloadStreamFallback,
  ensureRuntimeSettings,
} from '../src/services/clientDownloaderRuntime.js';
import apiClient from '../src/services/apiClient.js';
import { requestDownloadManifest } from '../src/services/videoDownloader.js';

class MemoryStorage {
  constructor(initialValues = {}) {
    this.values = { ...initialValues };
  }

  getItem(key) {
    return this.values[key] ?? null;
  }

  setItem(key, value) {
    this.values[key] = String(value);
  }
}

function installDownloadDomMocks() {
  const originalDocument = globalThis.document;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const clickedAnchors = [];

  globalThis.document = {
    body: {
      appendChild() {},
    },
    createElement() {
      return {
        href: '',
        download: '',
        click() {
          clickedAnchors.push(this.download);
        },
        remove() {},
      };
    },
  };
  URL.createObjectURL = () => 'blob:test';
  URL.revokeObjectURL = () => {};

  return {
    clickedAnchors,
    restore() {
      globalThis.document = originalDocument;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    },
  };
}

function createProxyManifest(overrides = {}) {
  return {
    fileName: 'video.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 6,
    chunkEndpoint: '/api/download-chunk',
    downloadToken: 'token-1',
    chunks: createChunkRanges(6, 3),
    ...overrides,
  };
}

test('ensureRuntimeSettings stores the current runtime version', () => {
  const storage = new MemoryStorage();
  const settings = ensureRuntimeSettings(storage);

  assert.equal(settings.version, RUNTIME_VERSION);
  assert.equal(settings.concurrency, DEFAULT_CONCURRENCY);
  assert.equal(JSON.parse(storage.getItem(RUNTIME_STORAGE_KEY)).version, RUNTIME_VERSION);
});

test('createChunkRanges splits a file into byte ranges', () => {
  assert.deepEqual(createChunkRanges(10, 4), [
    { index: 0, start: 0, end: 3 },
    { index: 1, start: 4, end: 7 },
    { index: 2, start: 8, end: 9 },
  ]);
});

test('downloadManifest downloads chunks through the proxy endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const domMocks = installDownloadDomMocks();
  const requests = [];

  globalThis.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    requests.push({ url, payload });
    const bytes = new Uint8Array(payload.end - payload.start + 1).fill(payload.start);
    return new Response(bytes, { status: 206 });
  };

  try {
    await downloadManifest(createProxyManifest(), {
      apiBaseUrl: 'http://localhost:5000',
      storage: new MemoryStorage(),
    });

    assert.deepEqual(
      requests.map((request) => request.url).sort(),
      [
        'http://localhost:5000/api/download-chunk',
        'http://localhost:5000/api/download-chunk',
      ]
    );
    assert.deepEqual(
      requests.map((request) => request.payload).sort((a, b) => a.start - b.start),
      [
        { token: 'token-1', start: 0, end: 2 },
        { token: 'token-1', start: 3, end: 5 },
      ]
    );
    assert.deepEqual(domMocks.clickedAnchors, ['video.mp4']);
  } finally {
    globalThis.fetch = originalFetch;
    domMocks.restore();
  }
});

test('downloadManifest refreshes manifest once when proxy token expires', async () => {
  const originalFetch = globalThis.fetch;
  const domMocks = installDownloadDomMocks();
  let fetchCount = 0;
  let refreshCount = 0;
  const tokens = [];

  globalThis.fetch = async (_url, options) => {
    fetchCount += 1;
    const payload = JSON.parse(options.body);
    tokens.push(payload.token);

    if (fetchCount === 1) {
      return Response.json(
        { error: 'Download token expired.', code: 'TOKEN_EXPIRED' },
        { status: 409 }
      );
    }

    const bytes = new Uint8Array(payload.end - payload.start + 1).fill(payload.start);
    return new Response(bytes, { status: 206 });
  };

  try {
    await downloadManifest(createProxyManifest(), {
      apiBaseUrl: 'http://localhost:5000',
      storage: new MemoryStorage(),
      refreshManifest: async () => {
        refreshCount += 1;
        return createProxyManifest({ downloadToken: 'token-2' });
      },
    });

    assert.equal(refreshCount, 1);
    assert.equal(tokens.includes('token-2'), true);
    assert.deepEqual(domMocks.clickedAnchors, ['video.mp4']);
  } finally {
    globalThis.fetch = originalFetch;
    domMocks.restore();
  }
});

test('downloadManifest surfaces blocked source errors without refreshing manifest', async () => {
  const originalFetch = globalThis.fetch;
  let refreshCount = 0;

  globalThis.fetch = async () =>
    Response.json(
      {
        error: 'Upstream media URL expired or was blocked.',
        code: 'SOURCE_EXPIRED_OR_BLOCKED',
      },
      { status: 409 }
    );

  try {
    await assert.rejects(
      downloadManifest(createProxyManifest(), {
        apiBaseUrl: 'http://localhost:5000',
        storage: new MemoryStorage(),
        refreshManifest: async () => {
          refreshCount += 1;
          return createProxyManifest({ downloadToken: 'token-2' });
        },
      }),
      { code: 'SOURCE_EXPIRED_OR_BLOCKED' }
    );
    assert.equal(refreshCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('downloadStreamFallback posts to the stream endpoint and saves the response blob', async () => {
  const originalFetch = globalThis.fetch;
  const domMocks = installDownloadDomMocks();
  const progressEvents = [];
  let observedRequest = null;

  globalThis.fetch = async (url, options) => {
    observedRequest = {
      url,
      payload: JSON.parse(options.body),
    };
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'Content-Length': '3',
        'Content-Type': 'video/mp4',
      },
    });
  };

  try {
    await downloadStreamFallback(
      {
        streamEndpoint: '/api/download-stream',
        request: {
          url: 'https://www.tiktok.com/@user/video/123',
          formatId: '18',
          formatToken: 'format-token',
        },
        fileName: 'fallback.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 3,
      },
      {
        apiBaseUrl: 'http://localhost:5000',
        onProgress: (event) => progressEvents.push(event),
      }
    );

    assert.deepEqual(observedRequest, {
      url: 'http://localhost:5000/api/download-stream',
      payload: {
        url: 'https://www.tiktok.com/@user/video/123',
        formatId: '18',
        formatToken: 'format-token',
      },
    });
    assert.deepEqual(domMocks.clickedAnchors, ['fallback.mp4']);
    assert.equal(progressEvents.at(-1).percent, 100);
  } finally {
    globalThis.fetch = originalFetch;
    domMocks.restore();
  }
});

test('requestDownloadManifest sends the selected format token', async () => {
  const originalPost = apiClient.post;
  let observedCall = null;

  apiClient.post = async (...args) => {
    observedCall = args;
    return { data: { ok: true } };
  };

  try {
    const response = await requestDownloadManifest(
      'https://www.tiktok.com/@user/video/123',
      '18',
      'format-token',
      'signal-value'
    );

    assert.deepEqual(response, { ok: true });
    assert.equal(observedCall[0], '/api/download-manifest');
    assert.deepEqual(observedCall[1], {
      url: 'https://www.tiktok.com/@user/video/123',
      formatId: '18',
      formatToken: 'format-token',
    });
    assert.deepEqual(observedCall[2], { signal: 'signal-value' });
  } finally {
    apiClient.post = originalPost;
  }
});

test('downloadManifest rejects an aborted request', async () => {
  const controller = new AbortController();
  controller.abort();

  await assert.rejects(
    downloadManifest(
      createProxyManifest(),
      {
        apiBaseUrl: 'http://localhost:5000',
        storage: new MemoryStorage(),
        signal: controller.signal,
      }
    ),
    { name: 'AbortError' }
  );
});
