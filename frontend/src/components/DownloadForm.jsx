import PropTypes from 'prop-types';
import { useCallback, useId } from 'react';

const DownloadForm = ({
  errorMessage,
  isSubmitting,
  isUrlValid,
  onSubmit,
  onUrlChange,
  url,
}) => {
  const inputId = useId();

  const handleChange = useCallback(
    (event) => {
      onUrlChange(event.target.value);
    },
    [onUrlChange]
  );

  const handleSubmit = useCallback(
    (event) => {
      event.preventDefault();
      onSubmit();
    },
    [onSubmit]
  );

  const showValidationMessage = Boolean(url) && !isUrlValid;

  return (
    <form className="download-form" noValidate onSubmit={handleSubmit}>
      <div className="form-field">
        <label className="form-label" htmlFor={inputId}>
          Video URL
        </label>
        <input
          aria-describedby={showValidationMessage ? `${inputId}-helper` : undefined}
          aria-invalid={showValidationMessage}
          autoComplete="off"
          className="url-input"
          id={inputId}
          inputMode="url"
          onChange={handleChange}
          placeholder="Paste the video link here"
          required
          type="url"
          value={url}
        />
        <p
          aria-live={showValidationMessage ? 'assertive' : 'polite'}
          className="form-helper"
          id={`${inputId}-helper`}
          role={showValidationMessage ? 'status' : undefined}
        >
          {showValidationMessage
            ? 'Enter a valid URL that starts with http:// or https://'
            : 'We support TikTok, Instagram, and Facebook video links.'}
        </p>
      </div>

      <button
        className="download-button"
        disabled={isSubmitting || !url}
        type="submit"
      >
        {isSubmitting ? 'Processing…' : 'Download'}
      </button>

      {errorMessage && (
        <p aria-live="assertive" className="error-message" role="alert">
          {errorMessage}
        </p>
      )}
    </form>
  );
};

DownloadForm.propTypes = {
  errorMessage: PropTypes.string,
  isSubmitting: PropTypes.bool.isRequired,
  isUrlValid: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired,
  onUrlChange: PropTypes.func.isRequired,
  url: PropTypes.string.isRequired,
};

DownloadForm.defaultProps = {
  errorMessage: '',
};

export default DownloadForm;
