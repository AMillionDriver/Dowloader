import PropTypes from 'prop-types';
import { SUPPORTED_PLATFORMS } from '../constants/platforms';

export function DownloadForm({
  url,
  validation,
  isProcessing,
  onUrlChange,
  onSubmit,
}) {
  const helperMessage = validation.isValid
    ? 'Paste a video link from TikTok, Instagram, or Facebook.'
    : validation.message || 'Enter a valid video link to continue.';

  return (
    <form className="download-form" onSubmit={onSubmit} noValidate>
      <label className="input-label" htmlFor="video-url">
        Video URL
      </label>
      <div className="input-group">
        <input
          id="video-url"
          type="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://"
          className={`url-input ${validation.isValid ? '' : 'url-input--invalid'}`}
          autoComplete="off"
          inputMode="url"
          required
          aria-invalid={!validation.isValid}
          aria-describedby="url-helper"
          disabled={isProcessing}
        />
        <button
          type="submit"
          className="download-button"
          disabled={isProcessing || !validation.isValid}
        >
          {isProcessing ? 'Working...' : 'Download'}
        </button>
      </div>
      <p
        id="url-helper"
        className={`input-helper ${validation.isValid ? '' : 'input-helper--error'}`}
      >
        {helperMessage}
      </p>
      <details className="platform-details">
        <summary>Supported platforms</summary>
        <ul>
          {SUPPORTED_PLATFORMS.map((platform) => (
            <li key={platform.name}>
              <span className="platform-name">{platform.name}</span>
              <span className="platform-example">Example: {platform.example}</span>
            </li>
          ))}
        </ul>
      </details>
    </form>
  );
}

DownloadForm.propTypes = {
  url: PropTypes.string.isRequired,
  validation: PropTypes.shape({
    isValid: PropTypes.bool.isRequired,
    message: PropTypes.string,
  }).isRequired,
  isProcessing: PropTypes.bool.isRequired,
  onUrlChange: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};
