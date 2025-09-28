import './App.css';
import { DownloadForm } from './components/DownloadForm';
import { ErrorMessage } from './components/ErrorMessage';
import { StatusIndicator } from './components/StatusIndicator';
import { VideoInfoResult } from './components/VideoInfoResult';
import { useDownloader } from './hooks/useDownloader';

function App() {
  const {
    url,
    status,
    statusMessage,
    progress,
    error,
    validation,
    isProcessing,
    videoInfo,
    downloadId,
    progressDetails,
    isDownloadReady,
    downloadFileName,
    handleUrlChange,
    handleSubmit,
    handleFormatDownload,
    handleDownloadNow,
    handleSubtitleDownload,
    resetProgress,
  } = useDownloader();

  const shouldHideFormats =
    !videoInfo || status === 'downloading' || isDownloadReady;

  return (
    <div className="page">
      <header className="page__header">
        <h1>Social Media Video Downloader</h1>
        <p className="subtitle">
          Download videos from TikTok, Instagram, and Facebook in a single place.
        </p>
      </header>

      <main className="page__content">
        <DownloadForm
          url={url}
          validation={validation}
          isProcessing={isProcessing}
          onUrlChange={handleUrlChange}
          onSubmit={handleSubmit}
        />

        <StatusIndicator
          status={status}
          statusMessage={statusMessage}
          progress={progress}
          progressDetails={progressDetails}
          isDownloadReady={isDownloadReady}
          downloadFileName={downloadFileName}
          hasDownloadId={Boolean(downloadId)}
          onDownloadNow={handleDownloadNow}
          onReset={resetProgress}
        />

        <ErrorMessage message={error} />

        {!shouldHideFormats && (
          <VideoInfoResult
            info={videoInfo}
            onDownload={handleFormatDownload}
            onSubtitleDownload={handleSubtitleDownload}
            isBusy={isProcessing}
          />
        )}
      </main>

      <footer className="page__footer">
        <p>
          We never store your links. Downloads happen directly between your
          browser and the platform&apos;s CDN.
        </p>
      </footer>
    </div>
  );
}

export default App;
