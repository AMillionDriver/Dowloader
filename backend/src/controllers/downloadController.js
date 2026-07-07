import { downloadService } from '../services/downloadService.js';

function isValidUrl(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  try {
    const parsed = new URL(value.trim());
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

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

function validateVideoUrl(url, res) {
  if (!url) {
    res.status(400).json({ error: 'Video URL is required' });
    return false;
  }

  if (!isValidUrl(url)) {
    res.status(400).json({ error: 'Please enter a valid HTTP or HTTPS URL' });
    return false;
  }

  return true;
}

async function getVideoInfo(req, res, next) {
  try {
    const { url } = req.body || {};

    if (!validateVideoUrl(url, res)) {
      return undefined;
    }

    const info = await downloadService.fetchVideoInfo(url.trim());
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

async function createDownloadManifest(req, res, next) {
  try {
    const { url, formatId, formatToken } = req.body || {};

    if (!validateVideoUrl(url, res)) {
      return undefined;
    }

    if (!isValidFormatId(formatId)) {
      return res.status(400).json({ error: 'A valid formatId is required.' });
    }

    const manifest = await downloadService.createDownloadManifest(
      url.trim(),
      formatId.trim(),
      formatToken
    );
    return res.json(manifest);
  } catch (error) {
    if (!error.statusCode) {
      const wrappedError = new Error(
        'Failed to create a client-side download manifest. Please try another format.'
      );
      wrappedError.statusCode = 502;
      wrappedError.cause = error;
      return next(wrappedError);
    }

    return next(error);
  }
}

async function downloadChunk(req, res, next) {
  try {
    const { token, start, end } = req.body || {};

    if (typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ error: 'A valid download token is required.' });
    }

    const chunk = await downloadService.fetchProxyChunk(token, start, end);

    res.status(chunk.statusCode);
    Object.entries(chunk.headers).forEach(([name, value]) => {
      res.setHeader(name, value);
    });

    if (!chunk.body) {
      return res.end();
    }

    return chunk.body.pipeTo(
      new WritableStream({
        write(data) {
          res.write(Buffer.from(data));
        },
        close() {
          res.end();
        },
        abort(error) {
          next(error);
        },
      })
    ).catch(next);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    return next(error);
  }
}

async function downloadStream(req, res, next) {
  try {
    const { url, formatId, formatToken } = req.body || {};

    if (!validateVideoUrl(url, res)) {
      return undefined;
    }

    if (!isValidFormatId(formatId)) {
      return res.status(400).json({ error: 'A valid formatId is required.' });
    }

    const fallback = downloadService.createStreamFallback(formatToken, url.trim(), formatId.trim());

    res.status(200);
    res.setHeader('Content-Type', fallback.mimeType);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Disposition', `attachment; filename="${fallback.fileName}"`);

    fallback.stream.once('error', (error) => {
      if (!res.headersSent) {
        return res.status(502).json({
          error: 'Failed to stream media through yt-dlp.',
          code: 'STREAM_FALLBACK_FAILED',
        });
      }

      return next(error);
    });

    return fallback.stream.pipe(res);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
      });
    }

    return next(error);
  }
}

export const downloadController = {
  getVideoInfo,
  createDownloadManifest,
  downloadChunk,
  downloadStream,
};
