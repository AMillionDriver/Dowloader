import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '../services/apiClient';
import { isValidUrl, normaliseUrl } from '../utils/url';

const INITIAL_STATUS = { message: '', progress: 0, type: 'idle' };

const buildErrorMessage = (error) => {
  if (!error) {
    return 'An unexpected error occurred.';
  }

  if (error.name === 'NetworkError') {
    return error.message;
  }

  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (error.message) {
    return error.message;
  }

  return 'Unable to download the requested video. Please try again later.';
};

export const useVideoDownloader = () => {
  const [videoUrl, setVideoUrl] = useState('');
  const [status, setStatus] = useState(INITIAL_STATUS);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [downloadLink, setDownloadLink] = useState('');

  const isUrlValid = useMemo(() => isValidUrl(videoUrl), [videoUrl]);

  useEffect(() => {
    if (!downloadLink) {
      return undefined;
    }

    const anchor = document.createElement('a');
    anchor.href = downloadLink;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.click();

    const timeoutId = window.setTimeout(() => {
      setStatus(INITIAL_STATUS);
    }, 3500);

    setDownloadLink('');
    return () => window.clearTimeout(timeoutId);
  }, [downloadLink]);

  const handleUrlChange = useCallback((value) => {
    setVideoUrl(value);
    if (error) {
      setError('');
    }
  }, [error]);

  const submitDownload = useCallback(async () => {
    if (!isValidUrl(videoUrl)) {
      setError('Please enter a valid video URL.');
      return;
    }

    setIsSubmitting(true);
    setStatus({ message: 'Validating link…', progress: 15, type: 'loading' });

    try {
      const payload = { url: normaliseUrl(videoUrl) };
      setStatus({ message: 'Requesting download…', progress: 45, type: 'loading' });
      const { data } = await apiClient.post('/api/download', payload);

      if (!data?.downloadUrl) {
        throw new Error('The server response did not include a download link.');
      }

      setStatus({ message: 'Download ready! Starting…', progress: 100, type: 'success' });
      setDownloadLink(data.downloadUrl);
    } catch (err) {
      setError(buildErrorMessage(err));
      setStatus(INITIAL_STATUS);
    } finally {
      setIsSubmitting(false);
    }
  }, [videoUrl]);

  return {
    downloadLink,
    error,
    handleUrlChange,
    isSubmitting,
    isUrlValid,
    status,
    submitDownload,
    videoUrl,
  };
};
