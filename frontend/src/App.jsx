import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './App.css';
import {
  isDownloadCanceled,
  parseDownloadError,
  requestVideoDownload,
} from './services/downloadService.js';

const PROGRESS = Object.freeze({
  initialized: 15,
  requesting: 55,
  completed: 100,
});

const RESET_DELAY = 4000;

const openDownloadUrl = (downloadUrl) => {
  const downloadWindow = window.open(
    downloadUrl,
    '_blank',
    'noopener,noreferrer'
  );

  if (!downloadWindow) {
    window.location.assign(downloadUrl);
  }
};

function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const abortControllerRef = useRef(null);
  const resetTimeoutRef = useRef(null);

  const isUrlEmpty = videoUrl.trim().length === 0;

  const handleInputChange = useCallback((event) => {
    setVideoUrl(event.target.value);
    if (errorMessage) {
      setErrorMessage('');
    }
  }, [errorMessage]);

  const clearResetTimeout = useCallback(() => {
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  const scheduleReset = useCallback(() => {
    clearResetTimeout();
    resetTimeoutRef.current = window.setTimeout(() => {
      setStatusMessage('');
      setProgress(0);
    }, RESET_DELAY);
  }, [clearResetTimeout]);

  const cleanupAbortController = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    cleanupAbortController();
    clearResetTimeout();
  }, [cleanupAbortController, clearResetTimeout]);

  const validateUrl = useCallback((value) => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new Error('URL tidak boleh kosong.');
    }

    try {
      const parsedUrl = new URL(trimmedValue);
      return parsedUrl.toString();
    } catch (error) {
      throw new Error('Silakan masukkan URL video yang valid.');
    }
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();

    let normalizedUrl;
    try {
      normalizedUrl = validateUrl(videoUrl);
    } catch (validationError) {
      setErrorMessage(validationError.message);
      return;
    }

    cleanupAbortController();
    clearResetTimeout();

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setStatusMessage('Memulai permintaan unduhan...');
    setProgress(PROGRESS.initialized);
    setErrorMessage('');

    try {
      const downloadResponse = await requestVideoDownload(
        normalizedUrl,
        controller.signal
      );

      setStatusMessage('Tautan unduhan diterima. Menyiapkan unduhan...');
      setProgress(PROGRESS.requesting);

      if (!downloadResponse?.downloadUrl) {
        throw new Error('Tautan unduhan tidak ditemukan pada respons.');
      }

      openDownloadUrl(downloadResponse.downloadUrl);

      setStatusMessage('Unduhan dimulai. Selamat menikmati!');
      setProgress(PROGRESS.completed);
      scheduleReset();
    } catch (error) {
      if (isDownloadCanceled(error)) {
        setStatusMessage('Permintaan unduhan dibatalkan.');
      } else {
        const friendlyMessage = parseDownloadError(error);
        setErrorMessage(friendlyMessage);
        setStatusMessage('');
      }

      setProgress(0);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [
    videoUrl,
    validateUrl,
    cleanupAbortController,
    clearResetTimeout,
    scheduleReset,
  ]);

  const handleCancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStatusMessage('Permintaan unduhan dibatalkan.');
      setErrorMessage('');
      setProgress(0);
      setIsLoading(false);
    }
  }, []);

  const isSubmitDisabled = useMemo(
    () => isLoading || isUrlEmpty,
    [isLoading, isUrlEmpty]
  );

  return (
    <div className="page">
      <main className="container" role="main">
        <header className="header">
          <h1>Social Media Video Downloader</h1>
          <p className="subtitle">
            Unduh video dari TikTok, Instagram, dan Facebook dengan aman dan cepat.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="download-form" noValidate>
          <label className="form-label" htmlFor="video-url">
            Tautan video
          </label>
          <div className="input-group">
            <input
              id="video-url"
              name="video-url"
              type="url"
              autoComplete="off"
              value={videoUrl}
              onChange={handleInputChange}
              placeholder="Tempel tautan video di sini..."
              className="url-input"
              required
              aria-describedby="url-help"
              aria-invalid={Boolean(errorMessage)}
              disabled={isLoading}
            />
            <button
              type="submit"
              className="download-button"
              disabled={isSubmitDisabled}
            >
              {isLoading ? 'Memproses...' : 'Unduh'}
            </button>
            <button
              type="button"
              className="cancel-button"
              onClick={handleCancel}
              disabled={!isLoading}
            >
              Batalkan
            </button>
          </div>
          <p id="url-help" className="help-text">
            Pastikan tautan dapat diakses publik dan sesuai dengan syarat platform.
          </p>
        </form>

        {statusMessage && (
          <section
            className="status-container"
            role="status"
            aria-live="polite"
          >
            <div className="progress-bar" aria-hidden="true">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="status-text">{statusMessage}</p>
          </section>
        )}

        {errorMessage && (
          <p className="error-message" role="alert">
            {errorMessage}
          </p>
        )}
      </main>
    </div>
  );
}

export default App;
