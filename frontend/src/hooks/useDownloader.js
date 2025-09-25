import { useCallback, useMemo, useRef, useState } from 'react';
import { SUPPORTED_PLATFORMS } from '../constants/platforms';
import { requestVideoDownload } from '../services/videoDownloader';

const STATUS_IDLE = 'idle';
const STATUS_VALIDATING = 'validating';
const STATUS_PROCESSING = 'processing';
const STATUS_DOWNLOADING = 'downloading';
const STATUS_SUCCESS = 'success';

function matchPlatform(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return SUPPORTED_PLATFORMS.find(({ hostPatterns }) =>
      hostPatterns.some((pattern) => pattern.test(hostname))
    );
  } catch (error) {
    return undefined;
  }
}

function validateUrl(url) {
  if (!url) {
    return {
      isValid: false,
      message: 'Video URL is required.',
    };
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return {
        isValid: false,
        message: 'Only HTTP and HTTPS URLs are supported.',
      };
    }
  } catch (error) {
    return {
      isValid: false,
      message: 'Enter a valid URL, including the protocol (https://).',
    };
  }

  const platform = matchPlatform(url);
  if (!platform) {
    return {
      isValid: false,
      message:
        'Unsupported platform. Please provide a TikTok, Instagram, or Facebook URL.',
    };
  }

  return { isValid: true, message: '', platform };
}

export function useDownloader() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState(STATUS_IDLE);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [validation, setValidation] = useState({ isValid: false, message: '' });
  const abortControllerRef = useRef(null);

  const isProcessing = useMemo(
    () => [STATUS_VALIDATING, STATUS_PROCESSING, STATUS_DOWNLOADING].includes(status),
    [status]
  );

  const handleUrlChange = useCallback((value) => {
    setUrl(value);
    const result = validateUrl(value);
    setValidation(result);

    if (!result.isValid) {
      setStatus(STATUS_IDLE);
      setStatusMessage('');
    }
  }, []);

  const resetProgress = useCallback(() => {
    setStatus(STATUS_IDLE);
    setProgress(0);
    setStatusMessage('');
    setError('');
    setValidation(validateUrl(url));
  }, [url]);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const result = validateUrl(url);
      setValidation(result);

      if (!result.isValid) {
        setError(result.message);
        return;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setError('');
        setStatus(STATUS_VALIDATING);
        setStatusMessage('Validating link...');
        setProgress(10);

        const platform = result.platform;
        setStatus(STATUS_PROCESSING);
        setStatusMessage(
          `Preparing download${platform ? ` from ${platform.name}` : ''}...`
        );
        setProgress(45);

        const data = await requestVideoDownload(url, controller.signal);

        if (!data?.downloadUrl) {
          throw new Error(
            'Download link was not provided by the server. Please try again.'
          );
        }

        setStatus(STATUS_DOWNLOADING);
        setStatusMessage('Starting download...');
        setProgress(85);

        const anchor = document.createElement('a');
        anchor.href = data.downloadUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.click();

        setStatus(STATUS_SUCCESS);
        setStatusMessage('Download started in a new tab.');
        setProgress(100);
      } catch (downloadError) {
        if (downloadError.name === 'CanceledError') {
          return;
        }

        setError(downloadError.message);
        setStatus(STATUS_IDLE);
        setStatusMessage('');
        setProgress(0);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [url]
  );

  return {
    url,
    status,
    statusMessage,
    progress,
    error,
    validation,
    isProcessing,
    handleUrlChange,
    handleSubmit,
    resetProgress,
  };
}
