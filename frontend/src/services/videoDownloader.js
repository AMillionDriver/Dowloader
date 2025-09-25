import { apiClient, extractApiError } from './apiClient';

export const requestVideoDownload = async (videoUrl) => {
  try {
    const { data } = await apiClient.post('/api/download', { url: videoUrl });
    return data;
  } catch (error) {
    const normalizedError = extractApiError(error);
    const downloadError = new Error(normalizedError.message);
    downloadError.status = normalizedError.status;
    throw downloadError;
  }
};
