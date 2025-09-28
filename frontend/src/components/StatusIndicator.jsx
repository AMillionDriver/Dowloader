import PropTypes from 'prop-types';

export function StatusIndicator({
  status,
  statusMessage,
  progress,
  progressDetails,
  isDownloadReady,
  downloadFileName,
  hasDownloadId,
  onDownloadNow,
  onReset,
}) {
  const showProgress = status === 'downloading' && !isDownloadReady;
  const showDownloadReady = Boolean(isDownloadReady && hasDownloadId);
  const hasProgressMeta = Boolean(
    showProgress &&
      (progressDetails?.downloaded ||
        progressDetails?.totalSize ||
        progressDetails?.currentSpeed ||
        progressDetails?.eta)
  );

  if (!statusMessage && progress === 0 && !showProgress && !showDownloadReady) {
    return null;
  }

  return (
    <section className="status-container" aria-live="polite">
      {showProgress && (
        <>
          <div
            className="progress-bar"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={progress}
          >
            <div className="progress-fill" style={{ width: `${Math.min(100, progress)}%` }} />
          </div>
          {hasProgressMeta && (
            <dl className="progress-details">
              {progressDetails?.downloaded && (
                <div className="progress-details__item">
                  <dt>Downloaded</dt>
                  <dd>
                    {progressDetails.downloaded}
                    {progressDetails.totalSize
                      ? ` / ${progressDetails.totalSize}`
                      : ''}
                  </dd>
                </div>
              )}
              {progressDetails?.currentSpeed && (
                <div className="progress-details__item">
                  <dt>Speed</dt>
                  <dd>{progressDetails.currentSpeed}</dd>
                </div>
              )}
              {progressDetails?.eta && (
                <div className="progress-details__item">
                  <dt>ETA</dt>
                  <dd>{progressDetails.eta}</dd>
                </div>
              )}
            </dl>
          )}
        </>
      )}

      <div className="status-row">
        <p className="status-text">{statusMessage}</p>
        {status === 'success' && (
          <button type="button" className="reset-button" onClick={onReset}>
            Download another video
          </button>
        )}
      </div>

      {showDownloadReady && (
        <div className="download-ready">
          <div className="download-ready__meta">
            <p className="download-ready__label">Server download complete</p>
            {downloadFileName && (
              <p className="download-ready__filename" title={downloadFileName}>
                {downloadFileName}
              </p>
            )}
          </div>
          <button type="button" className="download-now-button" onClick={onDownloadNow}>
            Download Now
          </button>
        </div>
      )}
    </section>
  );
}

StatusIndicator.propTypes = {
  status: PropTypes.string.isRequired,
  statusMessage: PropTypes.string,
  progress: PropTypes.number.isRequired,
  progressDetails: PropTypes.shape({
    percent: PropTypes.number,
    totalSize: PropTypes.string,
    currentSpeed: PropTypes.string,
    eta: PropTypes.string,
    downloaded: PropTypes.string,
    statusText: PropTypes.string,
  }),
  isDownloadReady: PropTypes.bool,
  downloadFileName: PropTypes.string,
  hasDownloadId: PropTypes.bool,
  onDownloadNow: PropTypes.func,
  onReset: PropTypes.func.isRequired,
};

StatusIndicator.defaultProps = {
  statusMessage: '',
  progressDetails: null,
  isDownloadReady: false,
  downloadFileName: '',
  hasDownloadId: false,
  onDownloadNow: () => {},
};
