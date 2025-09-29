import test from 'node:test';
import assert from 'node:assert/strict';

import { downloadSubtitle } from '../src/services/videoDownloader.js';
import apiClient from '../src/services/apiClient.js';

test('downloadSubtitle throws backend error message when Blob response contains error', async () => {
  const originalPost = apiClient.post;
  const error = new Error('Request failed with status code 404');
  error.response = {
    data: new Blob([JSON.stringify({ error: 'Subtitle not found' })], {
      type: 'application/json',
    }),
  };

  apiClient.post = () => Promise.reject(error);

  try {
    await assert.rejects(
      downloadSubtitle('https://example.com/video', 'en'),
      (err) => {
        assert.equal(err.message, 'Subtitle not found');
        return true;
      }
    );
  } finally {
    apiClient.post = originalPost;
  }
});

test('downloadSubtitle rethrows original error when response data is not a Blob', async () => {
  const originalPost = apiClient.post;
  const error = new Error('Request failed with status code 500');
  error.response = {
    data: { error: 'Server error' },
  };

  apiClient.post = () => Promise.reject(error);

  try {
    await assert.rejects(
      downloadSubtitle('https://example.com/video', 'en'),
      (err) => {
        assert.equal(err, error);
        return true;
      }
    );
  } finally {
    apiClient.post = originalPost;
  }
});
