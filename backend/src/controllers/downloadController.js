import { validationResult } from 'express-validator';

import {
  requestDownload,
  resolveDownload,
  markDownloadComplete,
} from '../services/downloadService.js';

export async function handleDownloadRequest(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { url } = req.body;
    const download = await requestDownload(url);
    const baseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

    const downloadUrl = `${baseUrl}/api/download/file/${download.downloadId}?signature=${download.signature}&expiresAt=${download.expiresAt}`;

    res.json({
      downloadUrl,
      fileName: download.fileName,
      size: download.size,
      expiresAt: download.expiresAt,
    });
  } catch (error) {
    next(error);
  }
}

export async function streamDownload(req, res, next) {
  try {
    const { id } = req.params;
    const { signature, expiresAt } = req.query;

    if (!id || !signature || !expiresAt) {
      return res.status(400).json({ error: 'Missing download token information.' });
    }

    const metadata = resolveDownload(id, expiresAt, signature);
    if (!metadata) {
      return res.status(410).json({ error: 'Download link is invalid or has expired.' });
    }

    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Length', metadata.size);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.fileName}"`);
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'none'; style-src 'none'; img-src 'none'");

    const stream = (await import('fs')).createReadStream(metadata.filePath);
    stream.on('close', async () => {
      await markDownloadComplete(id);
    });
    stream.on('error', async (err) => {
      stream.destroy(err);
      await markDownloadComplete(id);
      next(err);
    });

    stream.pipe(res);
  } catch (error) {
    next(error);
  }
}
