import apiClient from './apiClient';

export async function requestVideoDownload(url, signal) {
  const response = await apiClient.post(
    '/api/download',
    { url },
    { signal }
  );

  return response.data;
}
