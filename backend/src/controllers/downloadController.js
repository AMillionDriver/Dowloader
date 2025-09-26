import { downloadService } from '../services/downloadService.js';

const URL_REGEX = /^(http(s)?:\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/;

async function getDownloadLink(req, res, next) {
  try {
    const { url } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: 'Video URL is required' });
    }

    if (!URL_REGEX.test(url)) {
      return res.status(400).json({ error: 'Please enter a valid URL' });
    }

    const downloadUrl = await downloadService.resolveDownload(url);

    if (!downloadUrl) {
      return res.status(404).json({ error: 'This video platform is not supported or the link is invalid.' });
    }

    res.json({ downloadUrl });
  } catch (error) {
    // Pass the error to the centralized error handler
    next(error);
  }
}

export const downloadController = {
  getDownloadLink,
};
