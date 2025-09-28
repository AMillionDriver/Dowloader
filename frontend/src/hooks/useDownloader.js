import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SUPPORTED_PLATFORMS } from '../constants/platforms';
import {
  buildDownloadFileUrl,
  createDownloadEventSource,
  prepareServerDownload,
  requestVideoInfo,
} from '../services/videoDownloader';

const STATUS_IDLE = 'idle';
const STATUS_FETCHING_INFO = 'fetching-info';
const STATUS_READY = 'ready';
const STATUS_DOWNLOADING = 'downloading';
const STATUS_SUCCESS = 'success';

const INITIAL_PROGRESS_DETAILS = {
  percent: 0,
  totalSize: null,
  currentSpeed: null,
  eta: null,
  downloaded: null,
  statusText: '',
};

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
  const [downloadId, setDownloadId] = useState(null);
  const [isDownloadReady, setIsDownloadReady] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState('');
  const [progressDetails, setProgressDetails] = useState(INITIAL_PROGRESS_DETAILS);
  const infoAbortControllerRef = useRef(null);
  const downloadAbortControllerRef = useRef(null);
  const eventSourceRef = useRef(null);

  const isProcessing = useMemo(
    () => [STATUS_FETCHING_INFO, STATUS_DOWNLOADING].includes(status),
    [status]
  );

  const handleUrlChange = useCallback((value) => {
    if (infoAbortControllerRef.current) {
      infoAbortControllerRef.current.abort();
      infoAbortControllerRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setUrl(value);
    setValidation(validateUrl(value));
    setError('');
    setVideoInfo(null);
    setStatus(STATUS_IDLE);
    setStatusMessage('');
    setProgress(0);
    setDownloadId(null);
    setIsDownloadReady(false);
    setDownloadFileName('');
    setProgressDetails(INITIAL_PROGRESS_DETAILS);
  }, []);

  const closeDownloadStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      closeDownloadStream();
    };
  }, [closeDownloadStream]);

  const resetProgress = useCallback(() => {
    if (infoAbortControllerRef.current) {
      infoAbortControllerRef.current.abort();
      infoAbortControllerRef.current = null;
    }

    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
      downloadAbortControllerRef.current = null;
    }

    closeDownloadStream();

    setUrl('');
    setVideoInfo(null);
    setStatus(STATUS_IDLE);
    setProgress(0);
    setStatusMessage('');
    setError('');
    setValidation({ isValid: false, message: '' });
    setDownloadId(null);
    setIsDownloadReady(false);
    setDownloadFileName('');
    setProgressDetails(INITIAL_PROGRESS_DETAILS);
  }, [closeDownloadStream]);

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

      const trimmedUrl = url.trim();

      if (!trimmedUrl) {
        setError('Enter a valid video URL before downloading.');
        return;
      }

      if (downloadAbortControllerRef.current) {
        downloadAbortControllerRef.current.abort();
      }

      closeDownloadStream();

      const controller = new AbortController();
      downloadAbortControllerRef.current = controller;

      try {
        setError('');
        setStatus(STATUS_DOWNLOADING);
        setStatusMessage('Preparing your download...');
        setProgress(0);
        setIsDownloadReady(false);
        setDownloadFileName('');
        setProgressDetails({
          ...INITIAL_PROGRESS_DETAILS,
          statusText: 'pending',
        });

        const data = await prepareServerDownload(
          trimmedUrl,
          format.formatId,
          controller.signal
        );

        if (!data?.downloadId) {
          throw new Error('The server did not return a download identifier. Please try again.');
        }

        setDownloadId(data.downloadId);
        setStatusMessage('Downloading to server...');

        const eventSource = createDownloadEventSource(data.downloadId);
        eventSourceRef.current = eventSource;

        eventSource.onmessage = (event) => {
          if (event.data === 'done') {
            setIsDownloadReady(true);
            setStatus(STATUS_SUCCESS);
            setStatusMessage('Download ready! Click "Download Now" to save the file.');
            setProgress(100);
            setProgressDetails((previous) => ({
              ...previous,
              percent: 100,
              statusText: 'completed',
              eta: '00:00',
            }));
            closeDownloadStream();
            return;
          }

          let payload;
          try {
            payload = JSON.parse(event.data);
          } catch (parseError) {
            console.warn('Unable to parse progress payload', parseError);
            return;
          }

          if (payload.status === 'not-found') {
            setError('Download session was not found on the server. Please try again.');
            setStatus(STATUS_READY);
            setStatusMessage('Select a format to download.');
            setProgress(60);
            closeDownloadStream();
            setDownloadId(null);
            setIsDownloadReady(false);
            setDownloadFileName('');
            setProgressDetails(INITIAL_PROGRESS_DETAILS);
            return;
          }

          if (payload.status === 'error') {
            setError(payload.error || 'Download failed on the server. Please retry.');
            setStatus(STATUS_READY);
            setStatusMessage('Select a format to download.');
            setProgress(60);
            closeDownloadStream();
            setDownloadId(null);
            setIsDownloadReady(false);
            setDownloadFileName('');
            setProgressDetails(INITIAL_PROGRESS_DETAILS);
            return;
          }

          if (payload.progress) {
            const percentValue = Math.min(
              99,
              Math.max(0, Math.round(payload.progress.percent ?? 0))
            );
            setProgress(percentValue);
            setProgressDetails({
              percent: payload.progress.percent ?? percentValue,
              totalSize: payload.progress.totalSize ?? null,
              currentSpeed: payload.progress.currentSpeed ?? null,
              eta: payload.progress.eta ?? null,
              downloaded: payload.progress.downloaded ?? null,
              statusText: payload.progress.statusText ?? payload.status ?? 'downloading',
            });
          }

          if (payload.fileName) {
            setDownloadFileName(payload.fileName);
          }
        };

        eventSource.onerror = () => {
          setError('Connection to the server was interrupted. Please try again.');
          setStatus(STATUS_READY);
          setStatusMessage('Select a format to download.');
          setProgress(60);
          setDownloadId(null);
          setIsDownloadReady(false);
          setDownloadFileName('');
          setProgressDetails(INITIAL_PROGRESS_DETAILS);
          closeDownloadStream();
        };
      } catch (downloadError) {
        if (downloadError.name === 'CanceledError') {
          return;
        }

        setError(downloadError.message);
        setStatus(STATUS_READY);
        setStatusMessage('Select a format to download.');
        setProgress(60);
        setDownloadId(null);
        setIsDownloadReady(false);
        setDownloadFileName('');
        setProgressDetails(INITIAL_PROGRESS_DETAILS);
        closeDownloadStream();
      } finally {
        downloadAbortControllerRef.current = null;
      }
    },
    [
      url,
      validation.isValid,
      closeDownloadStream,
    ]
  );

  const handleDownloadNow = useCallback(() => {
    if (!downloadId) {
      return;
    }

    const downloadUrl = buildDownloadFileUrl(downloadId);

    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.download = downloadFileName || '';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    setStatusMessage('Your download should start shortly.');
  }, [downloadId, downloadFileName]);

  return {
    url,
    status,
    statusMessage,
    progress,
    error,
    validation,
    isProcessing,
    videoInfo,
    downloadId,
    progressDetails,
    isDownloadReady,
    downloadFileName,
    handleUrlChange,
    handleSubmit,
    handleFormatDownload,
    handleDownloadNow,
    resetProgress,
  };
}

