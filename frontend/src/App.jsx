import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [downloadInfo, setDownloadInfo] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setStatus('Processing request...');
      setProgress(25);
      setError('');
      setDownloadInfo(null);

      const response = await axios.post(`${API_BASE_URL}/download`, { url });

      setProgress(75);

      if (response.data.downloadUrl) {
        const { platform, downloadUrl, message } = response.data;
        setStatus(`Download link ready${platform ? ` for ${platform}` : ''}!`);
        setProgress(100);
        setDownloadInfo({ platform, downloadUrl, message });
      } else {
        throw new Error('Unexpected response from the server');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to prepare the download link');
      setStatus('');
      setProgress(0);
      setDownloadInfo(null);
    }
  };

  return (
    <div className="container">
      <h1>Social Media Video Downloader</h1>
      <p className="subtitle">Download videos from TikTok, Instagram, and Facebook</p>

      <form onSubmit={handleSubmit} className="download-form">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste video URL here..."
          required
          className="url-input"
        />
        <button type="submit" className="download-button">
          Get Download Link
        </button>
      </form>

      {status && (
        <div className="status-container">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="status-text">{status}</p>
        </div>
      )}

      {downloadInfo && (
        <div className="download-result">
          {downloadInfo.platform && (
            <p className="download-result__platform">
              Platform detected: <strong>{downloadInfo.platform}</strong>
            </p>
          )}
          <a
            href={downloadInfo.downloadUrl}
            className="download-result__link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open download link
          </a>
          {downloadInfo.message && (
            <p className="download-result__note">{downloadInfo.message}</p>
          )}
        </div>
      )}

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default App;
