import { useCallback, useMemo, useRef, useState } from 'react';
import { SUPPORTED_PLATFORMS } from '../constants/platforms';
import { requestVideoDownload, requestVideoInfo } from '../services/videoDownloader';

const STATUS_IDLE = 'idle';
const STATUS_FETCHING_INFO = 'fetching-info';
const STATUS_READY = 'ready';
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

  return { isValid: true, message: '', platform };
}

export function useDownloader() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState(STATUS_IDLE);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [validation, setValidation] = useState({ isValid: false, message: '' });
  const [videoInfo, setVideoInfo] = useState(null);
  const infoAbortControllerRef = useRef(null);
  const downloadAbortControllerRef = useRef(null);

  const isProcessing = useMemo(
    () => [STATUS_FETCHING_INFO, STATUS_DOWNLOADING].includes(status),
    [status]
  );

  const handleUrlChange = useCallback((value) => {
    if (infoAbortControllerRef.current) {
      infoAbortControllerRef.current.abort();
      infoAbortControllerRef.current = null;
    }

    setUrl(value);
    setValidation(validateUrl(value));
    setError('');
    setVideoInfo(null);
    setStatus(STATUS_IDLE);
    setStatusMessage('');
    setProgress(0);
  }, []);

  const resetProgress = useCallback(() => {
    if (infoAbortControllerRef.current) {
      infoAbortControllerRef.current.abort();
      infoAbortControllerRef.current = null;
    }

    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
      downloadAbortControllerRef.current = null;
    }

    setUrl('');
    setVideoInfo(null);
    setStatus(STATUS_IDLE);
    setProgress(0);
    setStatusMessage('');
    setError('');
    setValidation({ isValid: false, message: '' });
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const trimmedUrl = url.trim();
      const result = validateUrl(trimmedUrl);
      setValidation(result);

      if (!result.isValid) {
        setError(result.message);
        return;
      }

      if (infoAbortControllerRef.current) {
        infoAbortControllerRef.current.abort();
      }

      const controller = new AbortController();
      infoAbortControllerRef.current = controller;

      try {
        setError('');
        setVideoInfo(null);
        setStatus(STATUS_FETCHING_INFO);
        setStatusMessage('Fetching video information...');
        setProgress(30);

        setUrl(trimmedUrl);

        const info = await requestVideoInfo(trimmedUrl, controller.signal);
        setVideoInfo(info);

        const platformName = result.platform?.name;
        setStatus(STATUS_READY);
        setStatusMessage(
          `Select a format to download${platformName ? ` (${platformName})` : ''}.`
        );
        setProgress(60);
      } catch (requestError) {
        if (requestError.name === 'CanceledError') {
          return;
        }

        setError(requestError.message);
        setStatus(STATUS_IDLE);
        setStatusMessage('');
        setProgress(0);
        setVideoInfo(null);
      } finally {
        infoAbortControllerRef.current = null;
      }
    },
    [url]
  );

  const handleFormatDownload = useCallback(
    async (format) => {
      if (!format?.formatId) {
        setError('A valid format selection is required.');
        return;
      }

      if (!validation.isValid) {
        setError('Enter a valid video URL before downloading.');
        return;
      }

      if (downloadAbortControllerRef.current) {
        downloadAbortControllerRef.current.abort();
      }

      const trimmedUrl = url.trim();

      if (!trimmedUrl) {
        setError('Enter a valid video URL before downloading.');
        return;
      }

      const controller = new AbortController();
      downloadAbortControllerRef.current = controller;

      try {
        setError('');
        setStatus(STATUS_DOWNLOADING);
        setStatusMessage('Generating download link...');
        setProgress(85);

        const data = await requestVideoDownload(trimmedUrl, format.formatId, controller.signal);

        if (!data?.downloadUrl) {
          throw new Error('Download link was not provided by the server. Please try again.');
        }

        const anchor = document.createElement('a');
        anchor.href = data.downloadUrl;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.download = '';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        setStatus(STATUS_SUCCESS);
        setStatusMessage('Your download should start automatically.');
        setProgress(100);
      } catch (downloadError) {
        if (downloadError.name === 'CanceledError') {
          return;
        }

        setError(downloadError.message);
        setStatus(STATUS_READY);
        setStatusMessage('Select a format to download.');
        setProgress(60);
      } finally {
        downloadAbortControllerRef.current = null;
      }
    },
    [url, validation.isValid]
  );

  return {
    url,
    status,
    statusMessage,
    progress,
    error,
    validation,
    isProcessing,
    videoInfo,
    handleUrlChange,
    handleSubmit,
    handleFormatDownload,
    resetProgress,
  };
}

