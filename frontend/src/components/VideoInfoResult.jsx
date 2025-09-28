import PropTypes from 'prop-types';

function formatDuration(seconds, fallback) {
  if (typeof seconds !== 'number' || Number.isNaN(seconds) || seconds < 0) {
    return fallback || 'Unknown duration';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const parts = [minutes.toString().padStart(2, '0'), secs.toString().padStart(2, '0')];

  if (hours > 0) {
    parts.unshift(hours.toString());
  }

  return parts.join(':');
}

const browserLanguage =
  typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en';

const languageDisplayNames =
  typeof Intl !== 'undefined' && typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames([browserLanguage], { type: 'language' })
    : null;

function getLanguageLabel(code) {
  if (!code) {
    return '';
  }

  try {
    return languageDisplayNames?.of(code) || code;
  } catch (error) {
    return code;
  }
}

function FormatsTable({ title, emptyMessage, formats, onDownload, disabled }) {
  return (
    <section className="format-section">
      <h3>{title}</h3>
      {formats.length > 0 ? (
        <div className="format-table-wrapper">
          <table className="format-table">
            <thead>
              <tr>
                <th scope="col">Resolution</th>
                <th scope="col">Ext</th>
                <th scope="col">Note</th>
                <th scope="col" className="format-table__actions">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {formats.map((format) => (
                <tr key={format.formatId}>
                  <td data-label="Resolution">{format.resolution || 'Unknown'}</td>
                  <td data-label="Ext">{format.ext}</td>
                  <td data-label="Note">{format.note || '—'}</td>
                  <td className="format-table__actions">
                    <button
                      type="button"
                      className="format-download-button"
                      onClick={() => onDownload(format)}
                      disabled={disabled}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="format-table__empty">{emptyMessage}</p>
      )}
    </section>
  );
}

FormatsTable.propTypes = {
  title: PropTypes.string.isRequired,
  emptyMessage: PropTypes.string.isRequired,
  formats: PropTypes.arrayOf(
    PropTypes.shape({
      formatId: PropTypes.string.isRequired,
      resolution: PropTypes.string,
      ext: PropTypes.string.isRequired,
      type: PropTypes.oneOf(['video', 'audio']).isRequired,
      note: PropTypes.string,
    })
  ).isRequired,
  onDownload: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

FormatsTable.defaultProps = {
  disabled: false,
};

export function VideoInfoResult({ info, onDownload, onSubtitleDownload, isBusy }) {
  if (!info) {
    return null;
  }

  const availableFormats = Array.isArray(info.formats) ? info.formats : [];
  const availableSubtitles = Array.isArray(info.subtitles) ? info.subtitles : [];

  const videoFormats = [...availableFormats.filter((format) => format.type === 'video')].sort(
    (a, b) => {
      const toValue = (value) => {
        const numeric = parseInt(value, 10);
        return Number.isNaN(numeric) ? 0 : numeric;
      };

      return toValue(b.resolution) - toValue(a.resolution);
    }
  );

  const audioFormats = [...availableFormats.filter((format) => format.type === 'audio')].sort(
    (a, b) => {
      const toValue = (value) => {
        const numeric = parseInt(value, 10);
        return Number.isNaN(numeric) ? 0 : numeric;
      };

      return toValue(b.resolution) - toValue(a.resolution);
    }
  );

  const durationDisplay = info.durationFormatted || formatDuration(info.duration);

  return (
    <section className="video-result" aria-label="Video details">
      <div className="video-result__summary">
        {info.thumbnail && (
          <img
            src={info.thumbnail}
            alt={info.title}
            className="video-result__thumbnail"
            loading="lazy"
          />
        )}
        <div className="video-result__meta">
          <h2 className="video-result__title">{info.title}</h2>
          {durationDisplay && (
            <p className="video-result__duration">
              <span className="video-result__label">Duration:</span> {durationDisplay}
            </p>
          )}
          {info.subtitles?.length > 0 && (
            <p className="video-result__subtitles">
              <span className="video-result__label">Subtitles:</span> {info.subtitles.join(', ')}
            </p>
          )}
        </div>
      </div>

      {availableSubtitles.length > 0 && (
        <section className="subtitle-section" aria-label="Available subtitles">
          <h3>Available Subtitles</h3>
          <ul className="subtitle-list">
            {availableSubtitles.map((code) => (
              <li key={code} className="subtitle-list__item">
                <span className="subtitle-list__label">{getLanguageLabel(code)}</span>
                <button
                  type="button"
                  className="subtitle-download-button"
                  onClick={() => onSubtitleDownload(code)}
                  disabled={isBusy}
                >
                  Download
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="video-result__formats">
        <FormatsTable
          title="Video Formats"
          emptyMessage="No downloadable video formats were found."
          formats={videoFormats}
          onDownload={onDownload}
          disabled={isBusy}
        />

        <FormatsTable
          title="Audio Only"
          emptyMessage="No audio-only formats are available."
          formats={audioFormats}
          onDownload={onDownload}
          disabled={isBusy}
        />
      </div>
    </section>
  );
}

VideoInfoResult.propTypes = {
  info: PropTypes.shape({
    title: PropTypes.string,
    thumbnail: PropTypes.string,
    duration: PropTypes.number,
    durationFormatted: PropTypes.string,
    formats: PropTypes.arrayOf(
      PropTypes.shape({
        formatId: PropTypes.string.isRequired,
        resolution: PropTypes.string,
        ext: PropTypes.string.isRequired,
        type: PropTypes.oneOf(['video', 'audio']).isRequired,
        note: PropTypes.string,
      })
    ),
    subtitles: PropTypes.arrayOf(PropTypes.string),
  }),
  onDownload: PropTypes.func.isRequired,
  onSubtitleDownload: PropTypes.func,
  isBusy: PropTypes.bool,
};

VideoInfoResult.defaultProps = {
  info: null,
  onSubtitleDownload: () => {},
  isBusy: false,
};

