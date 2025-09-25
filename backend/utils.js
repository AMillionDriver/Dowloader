const { URL } = require('url');

const PLATFORM_CONFIG = {
  tiktok: {
    hosts: ['tiktok.com', 'www.tiktok.com', 'm.tiktok.com', 'vt.tiktok.com'],
    label: 'TikTok',
  },
  instagram: {
    hosts: ['instagram.com', 'www.instagram.com', 'm.instagram.com'],
    label: 'Instagram',
  },
  facebook: {
    hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch'],
    label: 'Facebook',
  },
};

function normaliseHost(hostname) {
  return hostname.replace(/^www\./, '').toLowerCase();
}

function detectPlatform(urlString) {
  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (error) {
    const message = 'URL tidak valid. Pastikan menempel tautan lengkap.';
    const err = new Error(message);
    err.code = 'INVALID_URL';
    throw err;
  }

  const host = normaliseHost(parsed.hostname);
  const platformEntry = Object.entries(PLATFORM_CONFIG).find(([, config]) =>
    config.hosts.some((platformHost) => host === normaliseHost(platformHost))
  );

  if (!platformEntry) {
    const err = new Error('Platform tidak didukung. Gunakan tautan TikTok, Instagram, atau Facebook.');
    err.code = 'UNSUPPORTED_PLATFORM';
    throw err;
  }

  const [platform, config] = platformEntry;
  return { platform, label: config.label, parsedUrl: parsed };
}

function createDownloadLink(urlString) {
  const { platform, label } = detectPlatform(urlString);

  return {
    platform,
    label,
    downloadUrl: urlString,
  };
}

module.exports = {
  detectPlatform,
  createDownloadLink,
};
