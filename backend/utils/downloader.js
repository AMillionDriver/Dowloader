const youtubedl = require('yt-dlp-exec');

async function extractDownloadInfo(url) {
  const result = await youtubedl(url, {
    dumpSingleJson: true,
    noWarnings: true,
    preferFreeFormats: true,
    format: 'best',
    simulate: true,
    addHeader: [
      'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });

  const metadata = typeof result === 'string' ? JSON.parse(result) : result;
  if (!metadata) {
    throw new Error('Video metadata could not be retrieved.');
  }

  if (metadata.url) {
    return { url: metadata.url, title: metadata.title ?? 'download' };
  }

  if (Array.isArray(metadata.formats)) {
    const sortedFormats = metadata.formats
      .filter((format) => Boolean(format.url))
      .sort((a, b) => (b.filesize ?? b.tbr ?? 0) - (a.filesize ?? a.tbr ?? 0));
    if (sortedFormats.length > 0) {
      return { url: sortedFormats[0].url, title: metadata.title ?? sortedFormats[0].format_id };
    }
  }

  throw new Error('No downloadable formats were returned by the extractor.');
}

module.exports = {
  extractDownloadInfo
};
