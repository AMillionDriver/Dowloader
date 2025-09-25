import PropTypes from 'prop-types';

export function StatusIndicator({ status, statusMessage, progress, onReset }) {
  if (!statusMessage && progress === 0) {
    return null;
  }

  return (
    <section className="status-container" aria-live="polite">
      <div className="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="status-row">
        <p className="status-text">{statusMessage}</p>
        {status === 'success' && (
          <button type="button" className="reset-button" onClick={onReset}>
            Download another video
          </button>
        )}
      </div>
    </section>
  );
}

StatusIndicator.propTypes = {
  status: PropTypes.string.isRequired,
  statusMessage: PropTypes.string,
  progress: PropTypes.number.isRequired,
  onReset: PropTypes.func.isRequired,
};

StatusIndicator.defaultProps = {
  statusMessage: '',
};
