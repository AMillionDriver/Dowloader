import apiClient from './apiClient';

export async function requestVideoInfo(url, signal) {
  const response = await apiClient.post(
    '/api/info',
    { url },
    { signal }
  );

  return response.data;
}

export async function requestVideoDownload(url, formatId, signal) {
  const response = await apiClient.post(
    '/api/download',
    { url, formatId },
    { signal }
  );

  return response.data;
}
