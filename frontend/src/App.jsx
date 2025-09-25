import './App.css';

import DownloadForm from './components/DownloadForm';
import StatusPanel from './components/StatusPanel';
import { useVideoDownloader } from './hooks/useVideoDownloader';

function App() {
  const {
    error,
    handleUrlChange,
    isSubmitting,
    isUrlValid,
    status,
    submitDownload,
    videoUrl,
  } = useVideoDownloader();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1 className="app-title">Social Media Video Downloader</h1>
        <p className="app-subtitle">
          Securely download videos from TikTok, Instagram, and Facebook using a
          single, easy-to-use interface.
        </p>
      </header>

      <main className="app-main" role="main">
        <DownloadForm
          errorMessage={error}
          isSubmitting={isSubmitting}
          isUrlValid={isUrlValid}
          onSubmit={submitDownload}
          onUrlChange={handleUrlChange}
          url={videoUrl}
        />

        <StatusPanel progress={status.progress} status={status} />
      </main>

      <footer className="app-footer">
        <p>
          Paste a public video URL and we&apos;ll do the rest. For the best
          experience, ensure the link is publicly accessible.
        </p>
      </footer>
    </div>
  );
}

export default App;
