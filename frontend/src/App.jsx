import React, { useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [metadata, setMetadata] = useState(null);

  const maskedUrl = useMemo(() => {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.hostname}${parsed.pathname.length > 12 ? `${parsed.pathname.slice(0, 12)}…` : parsed.pathname}`;
    } catch (err) {
      return url;
    }
  }, [url]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setStatus('Membuat tautan terenkripsi...');
      setProgress(25);
      setError('');
      setMetadata(null);

      const response = await axios.post(`${API_BASE_URL}/api/download`, { url }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      });

      setProgress(65);

      if (response.data.downloadUrl) {
        setMetadata(response.data.metadata ?? null);
        setStatus('Menginisiasi unduhan aman...');
        setProgress(90);

        const secureLink = document.createElement('a');
        secureLink.href = response.data.downloadUrl;
        secureLink.target = '_blank';
        secureLink.rel = 'noopener noreferrer';
        secureLink.click();

        setStatus('Unduhan terenkripsi dimulai!');
        setProgress(100);
        setTimeout(() => {
          setStatus('');
          setProgress(0);
        }, 3500);
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || 'Gagal menginisiasi unduhan. Pastikan tautan benar dan coba lagi.');
      setStatus('');
      setProgress(0);
    }
  };

  return (
    <div className="container">
      <h1>Social Media Video Downloader</h1>
      <p className="subtitle">Unduh video TikTok, Instagram, dan Facebook melalui kanal yang terenkripsi</p>

      <form onSubmit={handleSubmit} className="download-form">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Tempel tautan video di sini..."
          required
          className="url-input"
        />
        <button type="submit" className="download-button">
          Buat Tautan Aman
        </button>
      </form>

      {maskedUrl && (
        <p className="status-text subtle">Tautan terdeteksi: {maskedUrl}</p>
      )}

      {metadata && (
        <div className="metadata-card">
          {metadata.thumbnail && (
            <img src={metadata.thumbnail} alt={metadata.title || 'Thumbnail video'} className="metadata-thumb" />
          )}
          <div className="metadata-details">
            <h2>{metadata.title || 'Video tanpa judul'}</h2>
            {metadata.uploader && <p>Uploader: {metadata.uploader}</p>}
            {metadata.extractor && <p>Sumber: {metadata.extractor}</p>}
          </div>
        </div>
      )}

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

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default App;
