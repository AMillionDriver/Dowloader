import React, { useEffect, useRef } from 'react';
import './App.css';
import { useVideoDownloader } from './hooks/useVideoDownloader';

const STATUS_COPY = {
  idle: 'Paste a link to get started.',
  processing: 'Preparing your download…',
  downloading: 'Starting your download…',
  success: 'Your download should start automatically.',
  error: 'Failed to download the video.',
};

function App() {
  const {
    url,
    setUrl,
    status,
    progress,
    message,
    downloadLink,
    isBusy,
    startDownload,
  } = useVideoDownloader();
  const downloadAnchorRef = useRef(null);

  useEffect(() => {
    if (status === 'success' && downloadLink && downloadAnchorRef.current) {
      downloadAnchorRef.current.href = downloadLink;
      downloadAnchorRef.current.click();
    }
  }, [downloadLink, status]);

  return (
    <div className="app">
      <header className="hero">
        <h1 className="hero__title">Social Media Video Downloader</h1>
        <p className="hero__subtitle">
          Save videos from TikTok, Instagram, and Facebook quickly and safely.
        </p>
      </header>

      <main className="content">
        <form className="download-form" onSubmit={startDownload} noValidate>
          <label className="sr-only" htmlFor="video-url">
            Video URL
          </label>
          <input
            id="video-url"
            type="url"
            name="videoUrl"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/video"
            inputMode="url"
            autoComplete="off"
            required
            pattern="https?://.+"
            title="Enter a valid URL starting with http:// or https://"
            className="url-input"
            aria-describedby="status-message"
            aria-invalid={status === 'error'}
            disabled={isBusy}
          />
          <button type="submit" className="download-button" disabled={isBusy}>
            {isBusy ? 'Processing…' : 'Download'}
          </button>
        </form>

        <section className="feedback" aria-live="polite" id="status-message">
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin="0"
            aria-valuemax="100"
          >
            <span className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className={`message message--${status}`}>
            {message || STATUS_COPY[status]}
          </p>
        </section>

        <a
          ref={downloadAnchorRef}
          href={downloadLink || '#'}
          className="sr-only"
          rel="noopener noreferrer"
          target="_blank"
        >
          Download link
        </a>
      </main>
    </div>
  );
}

export default App;
