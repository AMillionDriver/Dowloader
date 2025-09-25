import axios from 'axios';
import httpClient from './httpClient.js';

export async function requestVideoDownload(videoUrl, signal) {
  const { data } = await httpClient.post(
    '/api/download',
    { url: videoUrl },
    { signal }
  );

  return data;
}

export function isDownloadCanceled(error) {
  return (
    axios.isCancel(error) ||
    error?.name === 'CanceledError' ||
    error?.name === 'AbortError'
  );
}

export function parseDownloadError(error) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.error || error.message;
    return message || 'Gagal memproses permintaan unduhan.';
  }

  return 'Terjadi kesalahan yang tidak terduga. Silakan coba lagi.';
}
