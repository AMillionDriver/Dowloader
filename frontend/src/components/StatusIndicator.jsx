import PropTypes from 'prop-types';

export function StatusIndicator({
  status,
  statusMessage = '',
  progress,
  progressDetails = null,
  downloadFileName = '',
  isProcessing = false,
  onCancel = () => {},
  onReset,
}) {
  const showProgress = ['preparing', 'downloading', 'saving'].includes(status);
  const hasProgressMeta = Boolean(
    showProgress &&
      (progressDetails?.downloaded ||
        progressDetails?.totalSize ||
        progressDetails?.currentSpeed ||
        progressDetails?.eta)
  );

  if (!statusMessage && progress === 0 && !showProgress) {
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
        <div className="status-copy">
          <p className="status-text">{statusMessage}</p>
          {downloadFileName && (
            <p className="status-filename" title={downloadFileName}>
              {downloadFileName}
            </p>
          )}
        </div>
        <div className="status-actions">
          {isProcessing && status !== 'fetching-info' && (
            <button type="button" className="cancel-button" onClick={onCancel}>
              Cancel
            </button>
          )}
          {['success', 'canceled'].includes(status) && (
            <button type="button" className="reset-button" onClick={onReset}>
              Download another video
            </button>
          )}
        </div>
      </div>
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
  downloadFileName: PropTypes.string,
  isProcessing: PropTypes.bool,
  onCancel: PropTypes.func,
  onReset: PropTypes.func.isRequired,
};
