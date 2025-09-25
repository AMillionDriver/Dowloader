import React, { useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [platformLabel, setPlatformLabel] = useState('');

  const endpoint = useMemo(() => {
    if (API_BASE_URL) {
      return `${API_BASE_URL}/api/download`;
    }

    return '/api/download';
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setStatus('Memproses tautan...');
      setProgress(25);
      setError('');
      setPlatformLabel('');

      const response = await axios.post(endpoint, { url });

      setProgress(60);

      if (response.data.downloadUrl) {
        setStatus('Mengunduh video...');
        setProgress(100);
        setPlatformLabel(response.data.platformLabel ?? '');

        const link = document.createElement('a');
        link.href = response.data.downloadUrl;
        link.target = '_blank';
        link.rel = 'noreferrer';
        link.click();

        setStatus('Unduhan dimulai!');
      } else {
        setStatus('Tidak menemukan tautan unduhan.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Gagal mengunduh video.');
      setStatus('');
      setProgress(0);
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
          Download
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
          {platformLabel && (
            <p className="platform-text">Platform terdeteksi: {platformLabel}</p>
          )}
        </div>
      )}

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default App;
