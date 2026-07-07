import apiClient from './apiClient.js';

export async function requestVideoInfo(url, signal) {
  const response = await apiClient.post(
    '/api/info',
    { url },
    { signal }
  );

  return response.data;
}

export async function requestDownloadManifest(url, formatId, formatToken, signal) {
  const response = await apiClient.post(
    '/api/download-manifest',
    { url, formatId, formatToken },
    { signal }
  );

  return response.data;
}

export function resolveApiBaseUrl() {
  const baseURL = apiClient.defaults.baseURL || '';
  return baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
}
