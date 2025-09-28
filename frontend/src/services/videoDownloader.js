import apiClient from './apiClient';

export async function requestVideoInfo(url, signal) {
  const response = await apiClient.post(
    '/api/info',
    { url },
    { signal }
  );

  return response.data;
}

export async function prepareServerDownload(url, formatId, signal) {
  const response = await apiClient.post(
    '/api/prepare-download',
    { url, formatId },
    { signal }
  );

  return response.data;
}

function resolveApiBaseUrl() {
  const baseURL = apiClient.defaults.baseURL || '';
  return baseURL.endsWith('/') ? baseURL.slice(0, -1) : baseURL;
}

export function createDownloadEventSource(downloadId) {
  const baseUrl = resolveApiBaseUrl();
  return new EventSource(`${baseUrl}/api/download-progress/${downloadId}`);
}

export function buildDownloadFileUrl(downloadId) {
  const baseUrl = resolveApiBaseUrl();
  return `${baseUrl}/api/get-file/${downloadId}`;
}
