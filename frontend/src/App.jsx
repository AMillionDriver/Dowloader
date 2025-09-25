import React, { useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const apiClient = useMemo(() => {
    const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

    return axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setStatus('Processing...');
      setProgress(30);
      setError('');
      setMessage('');

      const response = await apiClient.post('/api/download', { url });

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
        if (response.data.message) {
          setMessage(response.data.message);
        }
        setTimeout(() => {
          setStatus('');
          setProgress(0);
          setMessage('');
        }, 3000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download video');
      setStatus('');
      setProgress(0);
      setMessage('');
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

      {message && <p className="info-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
    </div>
  );
}

export default App;
