import { downloadService } from '../services/downloadService.js';

const URL_REGEX = /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/;

function isValidFormatId(formatId) {
  if (typeof formatId !== 'string') {
    return false;
  }

  const trimmed = formatId.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.length > 100 || /[\r\n\t]/.test(trimmed)) {
    return false;
  }

  return true;
}

async function getVideoInfo(req, res, next) {
  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    if (!URL_REGEX.test(url)) {
      return res.status(400).json({ error: 'Please enter a valid URL' });
    }

    const info = await downloadService.fetchVideoInfo(url);
    return res.json(info);
  } catch (error) {
    if (!error.statusCode) {
      const wrappedError = new Error(
        'Unable to fetch video information. Please verify the URL and try again.'
      );
      wrappedError.statusCode = 502;
      wrappedError.cause = error;
      return next(wrappedError);
    }

    return next(error);
  }
}

async function getDownloadLink(req, res, next) {
  try {
    const { url, formatId } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    if (!URL_REGEX.test(url)) {
      return res.status(400).json({ error: 'Please enter a valid URL' });
    }

    if (!isValidFormatId(formatId)) {
      return res.status(400).json({ error: 'A valid formatId is required.' });
    }

    const downloadUrl = await downloadService.resolveDownload(url, formatId.trim());

    return res.json({ downloadUrl });
  } catch (error) {
    if (!error.statusCode) {
      const wrappedError = new Error(
        'Failed to generate a download link for the selected format. Please try again or choose another format.'
      );
      wrappedError.statusCode = 502;
      wrappedError.cause = error;
      return next(wrappedError);
    }

    return next(error);
  }
}

export const downloadController = {
  getVideoInfo,
  getDownloadLink,
};
