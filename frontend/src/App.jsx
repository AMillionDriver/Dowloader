import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [securityError, setSecurityError] = useState('');
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  const apiBaseUrl = useMemo(
    () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
    [],
  );

  const establishSession = useCallback(async () => {
    try {
      setSecurityError('');
      const response = await axios.get(`${apiBaseUrl}/api/security/handshake`, {
        timeout: 10000,
      });

      setSession({
        sessionId: response.data.sessionId,
        signature: response.data.signature,
        expiresAt: response.data.expiresAt,
      });
    } catch (err) {
      console.error('Failed to initialize secure session', err);
      setSecurityError('Tidak dapat membuat sesi aman. Mohon refresh halaman atau coba lagi nanti.');
      setSession(null);
    } finally {
      setIsInitializing(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    establishSession();
  }, [establishSession]);

  useEffect(() => {
    if (!session) {
      return undefined;
    }

    const expiresIn = Number(session.expiresAt) - Date.now() - 60000;
    if (Number.isNaN(expiresIn)) {
      return undefined;
    }

    const refreshDelay = Math.max(expiresIn, 15000);
    const timer = setTimeout(() => {
      establishSession();
    }, refreshDelay);

    return () => clearTimeout(timer);
  }, [session, establishSession]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!session) {
      setError('Sesi aman belum siap. Mohon tunggu sebentar dan coba lagi.');
      return;
    }

    try {
      setStatus('Processing...');
      setProgress(30);
      setError('');
      setDownloadInfo(null);

      const response = await axios.post(
        `${apiBaseUrl}/api/download`,
        { url },
        {
          headers: {
            'X-Session-Id': session.sessionId,
            'X-Session-Signature': session.signature,
            'X-Session-Expires': session.expiresAt,
          },
          timeout: 120000,
        },
      );

      setProgress(60);

      if (response.data.downloadUrl) {
        setStatus('Downloading...');
        setProgress(100);
        setDownloadInfo({
          fileName: response.data.fileName,
          size: response.data.size,
          expiresAt: response.data.expiresAt,
        });

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

      {isInitializing && <p className="info-message">Menginisialisasi sesi aman...</p>}
      {securityError && <p className="error-message">{securityError}</p>}

      <form onSubmit={handleSubmit} className="download-form">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste video URL here..."
          required
          className="url-input"
          disabled={Boolean(securityError) || isInitializing}
        />
        <button
          type="submit"
          className="download-button"
          disabled={Boolean(securityError) || isInitializing}
        >
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
      {downloadInfo && (
        <div className="download-meta">
          <p className="meta-line">
            <strong>File:</strong> {downloadInfo.fileName}
          </p>
          <p className="meta-line">
            <strong>Ukuran:</strong> {(downloadInfo.size / (1024 * 1024)).toFixed(2)} MB
          </p>
          <p className="meta-line">
            <strong>Kadaluarsa:</strong> {new Date(downloadInfo.expiresAt).toLocaleTimeString()}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
