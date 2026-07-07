import { useCallback, useMemo, useRef, useState } from 'react';
import { SUPPORTED_PLATFORMS } from '../constants/platforms';
import {
  requestDownloadManifest,
  requestVideoInfo,
  resolveApiBaseUrl,
} from '../services/videoDownloader';
import {
  buildSuggestedFileName,
  downloadDirectResource,
  downloadManifest,
  downloadStreamFallback,
  selectFileSystemTarget,
  STREAM_FALLBACK_CODE,
} from '../services/clientDownloaderRuntime';

const STATUS_IDLE = 'idle';
const STATUS_FETCHING_INFO = 'fetching-info';
const STATUS_READY = 'ready';
const STATUS_PREPARING = 'preparing';
const STATUS_DOWNLOADING = 'downloading';
const STATUS_SAVING = 'saving';
const STATUS_SUCCESS = 'success';
const STATUS_CANCELED = 'canceled';

const INITIAL_PROGRESS_DETAILS = {
  percent: 0,
  totalSize: null,
  currentSpeed: null,
  eta: null,
  downloaded: null,
  statusText: '',
};

function formatBytes(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) {
    return null;
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}

function getAbortError() {
  return new DOMException('Download canceled.', 'AbortError');
}

function isAbortError(error) {
  return error?.name === 'AbortError';
}

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
  const [downloadFileName, setDownloadFileName] = useState('');
  const [progressDetails, setProgressDetails] = useState(INITIAL_PROGRESS_DETAILS);
  const infoAbortControllerRef = useRef(null);
  const downloadAbortControllerRef = useRef(null);
  const downloadLockRef = useRef(false);

  const isProcessing = useMemo(
    () =>
      [
        STATUS_FETCHING_INFO,
        STATUS_PREPARING,
        STATUS_DOWNLOADING,
        STATUS_SAVING,
      ].includes(status),
    [status]
  );

  const resetDownloadState = useCallback(() => {
    setProgress(0);
    setDownloadFileName('');
    setProgressDetails(INITIAL_PROGRESS_DETAILS);
  }, []);

  const handleUrlChange = useCallback(
    (value) => {
      if (infoAbortControllerRef.current) {
        infoAbortControllerRef.current.abort();
        infoAbortControllerRef.current = null;
      }

      if (downloadAbortControllerRef.current) {
        downloadAbortControllerRef.current.abort();
        downloadAbortControllerRef.current = null;
      }
      downloadLockRef.current = false;

      setUrl(value);
      setValidation(validateUrl(value));
      setError('');
      setVideoInfo(null);
      setStatus(STATUS_IDLE);
      setStatusMessage('');
      resetDownloadState();
    },
    [resetDownloadState]
  );

  const resetProgress = useCallback(() => {
    if (infoAbortControllerRef.current) {
      infoAbortControllerRef.current.abort();
      infoAbortControllerRef.current = null;
    }

    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
      downloadAbortControllerRef.current = null;
    }
    downloadLockRef.current = false;

    setUrl('');
    setVideoInfo(null);
    setStatus(STATUS_IDLE);
    setStatusMessage('');
    setError('');
    setValidation({ isValid: false, message: '' });
    resetDownloadState();
  }, [resetDownloadState]);

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
        resetDownloadState();
        setUrl(trimmedUrl);

        const info = await requestVideoInfo(trimmedUrl, controller.signal);
        setVideoInfo(info);

        const platformName = result.platform?.name;
        setStatus(STATUS_READY);
        setStatusMessage(
          `Select a proxied format to download${platformName ? ` (${platformName})` : ''}.`
        );
        setProgress(60);
      } catch (requestError) {
        if (isAbortError(requestError) || requestError.name === 'CanceledError') {
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
    [resetDownloadState, url]
  );

  const handleFormatDownload = useCallback(
    async (format) => {
      if (downloadLockRef.current) {
        return;
      }

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

      downloadLockRef.current = true;
      const controller = new AbortController();
      downloadAbortControllerRef.current = controller;
      const suggestedName = buildSuggestedFileName(videoInfo?.title, format.ext);

      try {
        setError('');
        setStatus(STATUS_PREPARING);
        setStatusMessage('Preparing proxied download...');
        setProgress(0);
        setDownloadFileName(suggestedName);
        setProgressDetails({
          ...INITIAL_PROGRESS_DETAILS,
          statusText: 'preparing',
        });

        const fileTarget = await selectFileSystemTarget({
          suggestedName,
          mimeType: format.mimeType || undefined,
        });

        if (controller.signal.aborted) {
          throw getAbortError();
        }

        const manifest = await requestDownloadManifest(
          trimmedUrl,
          format.formatId,
          format.formatToken,
          controller.signal
        );

        if (!manifest?.downloadToken || !manifest?.chunkEndpoint || !manifest?.sizeBytes) {
          throw new Error('The server returned an incomplete download manifest.');
        }

        setDownloadFileName(manifest.fileName || suggestedName);
        setStatus(STATUS_DOWNLOADING);
        setStatusMessage(
          fileTarget
            ? 'Downloading through the server proxy to your selected file...'
            : 'Downloading through the server proxy in your browser memory...'
        );

        const startedAt = Date.now();
        const handleProgress = ({ downloadedBytes, totalBytes, percent }) => {
          const elapsedSeconds = Math.max(1, (Date.now() - startedAt) / 1000);
          const bytesPerSecond = downloadedBytes / elapsedSeconds;
          const remainingBytes = Math.max(0, totalBytes - downloadedBytes);
          const etaSeconds = bytesPerSecond > 0
            ? Math.ceil(remainingBytes / bytesPerSecond)
            : null;
          const isSaving = percent >= 100;

          if (isSaving) {
            setStatus(STATUS_SAVING);
            setStatusMessage('Saving file to your device...');
          }
          setProgress(Math.round(percent));
          setProgressDetails({
            percent,
            totalSize: formatBytes(totalBytes),
            currentSpeed: bytesPerSecond > 0 ? `${formatBytes(bytesPerSecond)}/s` : null,
            eta: etaSeconds === null ? null : `${etaSeconds}s`,
            downloaded: formatBytes(downloadedBytes),
            statusText: isSaving ? 'saving' : 'downloading',
          });
        };

        try {
          await downloadManifest(manifest, {
            apiBaseUrl: resolveApiBaseUrl(),
            fileTarget,
            signal: controller.signal,
            refreshManifest: async () => {
              setStatusMessage('Refreshing expired media link...');
              return requestDownloadManifest(
                trimmedUrl,
                format.formatId,
                format.formatToken,
                controller.signal
              );
            },
            onProgress: handleProgress,
          });
        } catch (downloadError) {
          if (downloadError?.code !== STREAM_FALLBACK_CODE) {
            throw downloadError;
          }

          setStatus(STATUS_DOWNLOADING);
          setStatusMessage('Range proxy was blocked. Streaming through yt-dlp fallback...');
          await downloadStreamFallback({
            streamEndpoint: '/api/download-stream',
            request: {
              url: trimmedUrl,
              formatId: format.formatId,
              formatToken: format.formatToken,
            },
            fileName: manifest.fileName || suggestedName,
            mimeType: manifest.mimeType || format.mimeType,
            sizeBytes: manifest.sizeBytes,
          }, {
            apiBaseUrl: resolveApiBaseUrl(),
            fileTarget,
            signal: controller.signal,
            onProgress: handleProgress,
          });
        }

        if (controller.signal.aborted) {
          throw getAbortError();
        }

        setProgress(100);
        setProgressDetails((previous) => ({
          ...previous,
          percent: 100,
          statusText: 'saving',
        }));

        setStatus(STATUS_SUCCESS);
        setStatusMessage('Download completed and saved on your device.');
        setProgressDetails((previous) => ({
          ...previous,
          statusText: 'completed',
          eta: '0s',
        }));
      } catch (downloadError) {
        if (isAbortError(downloadError) || downloadError.name === 'CanceledError') {
          setStatus(STATUS_CANCELED);
          setStatusMessage('Download canceled.');
          setProgress(0);
          setProgressDetails(INITIAL_PROGRESS_DETAILS);
          return;
        }

        setError(downloadError.message);
        setStatus(STATUS_READY);
        setStatusMessage('Select a proxied format to download.');
        setProgress(60);
        setDownloadFileName('');
        setProgressDetails(INITIAL_PROGRESS_DETAILS);
      } finally {
        downloadAbortControllerRef.current = null;
        downloadLockRef.current = false;
      }
    },
    [url, validation.isValid, videoInfo?.title]
  );

  const handleCancelDownload = useCallback(() => {
    if (downloadAbortControllerRef.current) {
      downloadAbortControllerRef.current.abort();
    }
  }, []);

  const handleSubtitleDownload = useCallback(
    async (subtitle) => {
      const subtitleInfo =
        typeof subtitle === 'string'
          ? videoInfo?.subtitles?.find((entry) => entry.lang === subtitle)
          : subtitle;

      if (!subtitleInfo?.url) {
        setError('This subtitle is not available as a direct client-side download.');
        return;
      }

      try {
        setError('');
        setStatusMessage(`Downloading ${subtitleInfo.lang} subtitles...`);

        await downloadDirectResource({
          sourceUrl: subtitleInfo.url,
          fileName: subtitleInfo.fileName || `subtitle-${subtitleInfo.lang}.${subtitleInfo.ext || 'vtt'}`,
          mimeType: subtitleInfo.ext === 'srt' ? 'application/x-subrip' : 'text/vtt',
        });

        setStatusMessage(`Subtitle download for ${subtitleInfo.lang} should start shortly.`);
      } catch (subtitleError) {
        setError(subtitleError.message);
      }
    },
    [videoInfo?.subtitles]
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
    progressDetails,
    downloadFileName,
    handleUrlChange,
    handleSubmit,
    handleFormatDownload,
    handleCancelDownload,
    handleSubtitleDownload,
    resetProgress,
  };
}
