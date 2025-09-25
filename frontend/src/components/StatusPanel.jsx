import PropTypes from 'prop-types';

const StatusPanel = ({ progress, status }) => {
  if (!status?.message) {
    return null;
  }

  return (
    <section className="status-panel" aria-live="polite" role="status">
      <div className="progress-bar" aria-hidden="true">
        <div
          className={`progress-fill progress-${status.type}`}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="status-text">{status.message}</p>
    </section>
  );
};

StatusPanel.propTypes = {
  progress: PropTypes.number,
  status: PropTypes.shape({
    message: PropTypes.string,
    progress: PropTypes.number,
    type: PropTypes.oneOf(['idle', 'loading', 'success']),
  }),
};

StatusPanel.defaultProps = {
  progress: 0,
  status: undefined,
};

export default StatusPanel;
