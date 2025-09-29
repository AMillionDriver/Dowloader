import apiClient from './apiClient';

function resolveApiUrl(path) {
  const baseURL = apiClient.defaults.baseURL ?? window.location.origin;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;

  return new URL(normalizedPath, baseURL).toString();
}

export async function requestVideoInfo(url, signal) {
  const response = await apiClient.post(
    resolveApiUrl('api/info'),
    { url },
    { signal }
  );

  return response.data;
}

export async function prepareServerDownload(url, formatId, signal) {
  const response = await apiClient.post(
    resolveApiUrl('api/prepare-download'),
    { url, formatId },
    { signal }
  );

  return response.data;
}

export async function downloadSubtitle(url, lang) {
  const response = await apiClient.post(
    resolveApiUrl('api/download-subtitle'),
    { url, lang },
    {
      responseType: 'blob',
    }
  );

  return response;
}

export function createDownloadEventSource(downloadId) {
  return new EventSource(resolveApiUrl(`api/download-progress/${downloadId}`));
}

export function buildDownloadFileUrl(downloadId) {
  return resolveApiUrl(`api/get-file/${downloadId}`);
}
