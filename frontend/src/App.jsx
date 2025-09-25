import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

async function createSha256(value) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('Secure hashing is not supported in this browser.');
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [downloadMeta, setDownloadMeta] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setStatus('Processing...');
      setProgress(30);
      setError('');
      setDownloadMeta(null);

      const fingerprint = await createSha256(url);

      const response = await axios.post(`${API_BASE_URL}/api/download`, { url, fingerprint });

      setProgress(60);

      if (response.data.downloadUrl) {
        const computedHash = await createSha256(response.data.downloadUrl);
        if (computedHash !== response.data.downloadHash) {
          throw new Error('Integrity verification failed.');
        }

        setStatus('Downloading...');
        setProgress(100);

        setDownloadMeta({
          id: response.data.id,
          integrityToken: response.data.integrityToken,
          downloadHash: response.data.downloadHash,
          title: response.data.title,
          requestFingerprint: fingerprint
        });

        // Create a temporary anchor element to trigger the download
        const link = document.createElement('a');
        link.href = response.data.downloadUrl;
        link.target = '_blank';
        link.click();

        setStatus('Secure download started!');
        setTimeout(() => {
          setStatus('');
          setProgress(0);
        }, 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to download video');
      setStatus('');
      setProgress(0);
      setDownloadMeta(null);
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
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      {downloadMeta && (
        <div className="integrity-card">
          <h2>Encrypted Download Details</h2>
          <p>
            <strong>Request ID:</strong> {downloadMeta.id}
          </p>
          <p>
            <strong>Video Title:</strong> {downloadMeta.title || 'Unknown'}
          </p>
          <p>
            <strong>Request Fingerprint:</strong> {downloadMeta.requestFingerprint}
          </p>
          <p>
            <strong>Stream Hash:</strong> {downloadMeta.downloadHash}
          </p>
          <p>
            <strong>Integrity Token:</strong> {downloadMeta.integrityToken}
          </p>
          <p className="integrity-helper">Share these hashes only with trusted parties to verify your secure download.</p>
        </div>
      )}
    </div>
  );
}

export default App;
