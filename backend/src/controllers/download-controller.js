const { z } = require('zod');
const { fetchVideoMetadata, createDownloadStream, sanitizeFileName } = require('../utils/download');
const { createSignedDownloadPayload, decryptPayload, verifySignature } = require('../utils/crypto');
const { PUBLIC_BASE_URL, MAX_CONCURRENT_DOWNLOADS } = require('../config/app-config');
const Semaphore = require('../utils/semaphore');

const downloadSemaphore = new Semaphore(MAX_CONCURRENT_DOWNLOADS);

const requestSchema = z.object({
  url: z.string().url('URL tidak valid. Pastikan tautan dimulai dengan http atau https.'),
});

const streamQuerySchema = z.object({
  payload: z.string().min(10, 'Payload hilang atau rusak'),
  signature: z.string().min(10, 'Signature hilang'),
  expires: z.coerce.number().int().positive('Nilai kedaluwarsa tidak valid'),
});

async function createDownloadLink(req, res, next) {
  try {
    const { url } = requestSchema.parse(req.body);
    const metadata = await fetchVideoMetadata(url);
    const signed = createSignedDownloadPayload(url, metadata);
    const baseUrl = PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    const downloadUrl = `${baseUrl}/api/download/stream?payload=${encodeURIComponent(signed.payload)}&signature=${encodeURIComponent(signed.signature)}&expires=${signed.expiresAt}`;
    res.status(200).json({
      message: 'Tautan unduhan terenkripsi berhasil dibuat',
      downloadUrl,
      expiresAt: signed.expiresAt,
      metadata,
    });
  } catch (error) {
    next(error);
  }
}

async function streamDownload(req, res, next) {
  let permitAcquired = false;
  try {
    const { payload, signature, expires } = streamQuerySchema.parse(req.query);
    if (Date.now() > Number(expires)) {
      return res.status(410).json({ error: 'Tautan unduhan telah kedaluwarsa. Silakan buat tautan baru.' });
    }

    if (!verifySignature(signature, payload, Number(expires))) {
      return res.status(401).json({ error: 'Signature tidak valid' });
    }

    const decrypted = decryptPayload(payload);
    if (decrypted.expiresAt && Date.now() > decrypted.expiresAt) {
      return res.status(410).json({ error: 'Tautan unduhan telah kedaluwarsa.' });
    }

    const videoUrl = decrypted.url;
    const metadata = decrypted.metadata || {};
    const filename = `${sanitizeFileName(metadata.title || 'video')}.mp4`;

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await downloadSemaphore.acquire();
    permitAcquired = true;

    const { stream, completion } = await createDownloadStream(videoUrl, metadata.ext || 'mp4');
    stream.pipe(res);

    completion
      .catch((err) => {
        if (!res.headersSent) {
          res.status(500).json({ error: 'Gagal menyelesaikan proses unduh' });
        } else {
          res.destroy(err);
        }
      })
      .finally(() => {
        if (permitAcquired) {
          downloadSemaphore.release();
          permitAcquired = false;
        }
      });
  } catch (error) {
    if (permitAcquired) {
      downloadSemaphore.release();
      permitAcquired = false;
    }
    next(error);
  }
}

module.exports = {
  createDownloadLink,
  streamDownload,
};
