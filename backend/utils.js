const PLATFORM_DOMAINS = {
  tiktok: ['tiktok.com', 'www.tiktok.com', 'vm.tiktok.com'],
  instagram: ['instagram.com', 'www.instagram.com', 'instagr.am'],
  facebook: [
    'facebook.com',
    'www.facebook.com',
    'm.facebook.com',
    'fb.com',
    'fb.watch'
  ]
};

class DownloadError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DownloadError';
    this.statusCode = statusCode;
  }
}

const ensureUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new DownloadError('A valid URL is required', 400);
  }

  const trimmed = rawUrl.trim();
  const urlWithProtocol = /^(https?:)?\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let parsed;
  try {
    parsed = new URL(urlWithProtocol);
  } catch (error) {
    throw new DownloadError('The provided URL is not valid', 400);
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new DownloadError('Only HTTP and HTTPS links are supported', 415);
  }

  return parsed;
};

const detectPlatform = (url) => {
  const hostname = url.hostname.toLowerCase();

  for (const [platform, domains] of Object.entries(PLATFORM_DOMAINS)) {
    if (domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
      return platform;
    }
  }

  throw new DownloadError(
    'Only TikTok, Instagram, and Facebook URLs are supported at the moment.',
    422
  );
};

const buildDownloadLink = (url, platform) => {
  if (process.env.DOWNLOAD_REDIRECT_BASE) {
    const base = process.env.DOWNLOAD_REDIRECT_BASE.replace(/\/$/, '');
    return `${base}?platform=${platform}&source=${encodeURIComponent(url.href)}`;
  }

  return url.href;
};

const getDownloadInfo = async (rawUrl) => {
  const url = ensureUrl(rawUrl);
  const platform = detectPlatform(url);
  const downloadUrl = buildDownloadLink(url, platform);

  return {
    platform,
    downloadUrl,
    message:
      'This is a placeholder link. Replace `buildDownloadLink` in backend/utils.js with your real extraction logic.'
  };
};

module.exports = {
  getDownloadInfo,
  DownloadError
};
