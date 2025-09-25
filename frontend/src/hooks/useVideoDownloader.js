import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestVideoDownload } from '../services/videoDownloader';

const RESET_DELAY_MS = 4000;

const createInitialState = () => ({
  status: 'idle',
  progress: 0,
  message: '',
  downloadLink: '',
});

export const useVideoDownloader = () => {
  const [url, setUrl] = useState('');
  const [{ status, progress, message, downloadLink }, setState] = useState(createInitialState);
  const resetTimeoutRef = useRef(null);

  const clearPendingReset = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearPendingReset(), [clearPendingReset]);

  const scheduleReset = useCallback(() => {
    clearPendingReset();
    resetTimeoutRef.current = setTimeout(() => {
      setUrl('');
      setState(createInitialState());
    }, RESET_DELAY_MS);
  }, [clearPendingReset]);

  const updateState = useCallback((partialState) => {
    setState((current) => ({
      ...current,
      ...partialState,
    }));
  }, []);

  const validateUrl = useCallback((value) => {
    const trimmedUrl = value.trim();

    if (!trimmedUrl) {
      throw new Error('Please enter the video URL you want to download.');
    }

    let parsedUrl;

    try {
      parsedUrl = new URL(trimmedUrl);
    } catch (error) {
      throw new Error('That does not look like a valid URL. Please try again.');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Only http and https URLs are supported.');
    }

    return parsedUrl.toString();
  }, []);

  const startDownload = useCallback(
    async (event) => {
      event.preventDefault();
      clearPendingReset();

      try {
        const sanitizedUrl = validateUrl(url);

        updateState({
          status: 'processing',
          progress: 20,
          message: 'Preparing your download…',
          downloadLink: '',
        });

        const response = await requestVideoDownload(sanitizedUrl);

        if (!response?.downloadUrl) {
          throw new Error('The server response did not include a download link.');
        }

        updateState({ status: 'downloading', progress: 75, message: 'Starting your download…' });

        updateState({
          status: 'success',
          progress: 100,
          downloadLink: response.downloadUrl,
          message: 'Your download should start automatically.',
        });

        scheduleReset();
      } catch (error) {
        updateState({
          status: 'error',
          progress: 0,
          message: error?.message || 'Failed to download the video. Please try again later.',
          downloadLink: '',
        });
      }
    },
    [clearPendingReset, scheduleReset, updateState, url, validateUrl],
  );

  const isBusy = useMemo(() => ['processing', 'downloading'].includes(status), [status]);

  return {
    url,
    setUrl,
    status,
    progress,
    message,
    downloadLink,
    isBusy,
    startDownload,
  };
};
