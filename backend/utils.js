const SUPPORTED_DOMAINS = ['tiktok.com', 'instagram.com', 'facebook.com'];

function isSupportedUrl(inputUrl) {
  try {
    const { hostname } = new URL(inputUrl);
    return SUPPORTED_DOMAINS.some((domain) => hostname.includes(domain));
  } catch (error) {
    return false;
  }
}

export async function fetchDownloadLink(url) {
  if (!isSupportedUrl(url)) {
    throw new Error('Unsupported URL. Only TikTok, Instagram, and Facebook URLs are allowed.');
  }

  // TODO: Replace this placeholder implementation with real video extraction logic.
  return {
    downloadUrl: url,
    message: 'Download simulation successful. Replace with real downloader integration.',
  };
}
