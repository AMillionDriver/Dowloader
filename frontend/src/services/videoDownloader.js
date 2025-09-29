import apiClient from './apiClient.js';

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

export async function downloadSubtitle(url, lang) {
  try {
    const response = await apiClient.post(
      '/api/download-subtitle',
      { url, lang },
      {
        responseType: 'blob',
      }
    );

    return response;
  } catch (error) {
    const responseData = error?.response?.data;

    if (responseData instanceof Blob) {
      const text = await responseData.text();
      let parsed;

      try {
        parsed = JSON.parse(text);
      } catch (parseError) {
        parsed = null;
      }

      if (parsed?.error) {
        throw new Error(parsed.error);
      }
    }

    throw error;
  }
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
