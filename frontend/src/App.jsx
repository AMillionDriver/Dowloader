import React, { useState } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setStatus('Processing...');
      setProgress(30);
      setError('');

      const response = await axios.post(`${API_BASE_URL}/api/download`, { url });
      
      setProgress(60);
      
      if (response.data.downloadUrl) {
        setStatus('Downloading...');
        setProgress(100);
        
        // Create a temporary anchor element to trigger the download
        const link = document.createElement('a');
        link.href = response.data.downloadUrl;
        link.target = '_blank';
        link.click();
        
        setStatus('Download started!');
        setTimeout(() => {
          setStatus('');
          setProgress(0);
        }, 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download video');
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
        </div>
      )}

      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default App;
