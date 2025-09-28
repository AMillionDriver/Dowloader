import { v4 as uuidv4 } from 'uuid';
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

async function prepareDownload(req, res, next) {
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

    const downloadId = uuidv4();
    await downloadService.queueDownload(downloadId, url.trim(), formatId.trim());

    return res.status(202).json({ downloadId });
  } catch (error) {
    if (!error.statusCode) {
      const wrappedError = new Error(
        'Failed to start the download process. Please try again in a moment.'
      );
      wrappedError.statusCode = 502;
      wrappedError.cause = error;
      return next(wrappedError);
    }

    return next(error);
  }
}

function streamDownloadProgress(req, res) {
  const { downloadId } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }

  const sendSnapshot = () => {
    const snapshot = downloadService.getDownloadSnapshot(downloadId);

    if (!snapshot) {
      res.write('data: ' + JSON.stringify({ status: 'not-found' }) + '\n\n');
      clearInterval(intervalId);
      res.end();
      return;
    }

    if (snapshot.status === 'error') {
      res.write('data: ' + JSON.stringify({ status: 'error', error: snapshot.error }) + '\n\n');
      clearInterval(intervalId);
      res.end();
      return;
    }

    res.write('data: ' + JSON.stringify({
      status: snapshot.status,
      progress: snapshot.progress,
      fileName: snapshot.fileName,
    }) + '\n\n');

    if (snapshot.status === 'completed') {
      res.write('data: done\n\n');
      clearInterval(intervalId);
      res.end();
    }
  };

  const intervalId = setInterval(sendSnapshot, 1000);
  sendSnapshot();

  req.on('close', () => {
    clearInterval(intervalId);
  });
}

async function getFile(req, res, next) {
  try {
    const { downloadId } = req.params;
    const fileInfo = downloadService.getDownloadFileInfo(downloadId);

    if (!fileInfo) {
      return res.status(404).json({ error: 'Download not found or not ready.' });
    }

    return res.download(fileInfo.filePath, fileInfo.fileName, async (err) => {
      if (err) {
        return next(err);
      }

      await downloadService.cleanupDownload(downloadId);
    });
  } catch (error) {
    return next(error);
  }
}

async function downloadSubtitle(req, res, next) {
  try {
    const { url, lang } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    if (!URL_REGEX.test(url)) {
      return res.status(400).json({ error: 'Please enter a valid URL' });
    }

    if (typeof lang !== 'string' || !lang.trim()) {
      return res.status(400).json({ error: 'A subtitle language code is required.' });
    }

    const fileInfo = await downloadService.downloadSubtitleFile(url.trim(), lang.trim());

    return res.download(fileInfo.filePath, fileInfo.fileName, (err) => {
      downloadService.deleteTemporaryFile(fileInfo.filePath).catch(() => {});

      if (err) {
        return next(err);
      }

      return undefined;
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    return next(error);
  }
}

export const downloadController = {
  getVideoInfo,
  prepareDownload,
  streamDownloadProgress,
  getFile,
  downloadSubtitle,
};
