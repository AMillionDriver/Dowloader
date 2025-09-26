import YtDlpWrap from 'yt-dlp-wrap';

// Initialize yt-dlp-wrap. It will automatically download and use the yt-dlp binary.
const ytDlpWrap = new YtDlpWrap();

/**
 * Resolve a download URL for a given social media link using yt-dlp.
 *
 * @param {string} url
 * @returns {Promise<string|null>}
 */
export async function resolveDownload(url) {
  if (!url) return null;

  try {
    console.log(`[yt-dlp] Attempting to get video URL for: ${url}`);

    // Execute yt-dlp to get the direct video URL.
    // The format selection requests the best quality MP4 video and audio,
    // falling back to the best overall MP4 if separate streams aren't available.
    const videoUrl = await ytDlpWrap.execPromise([
      url,
      '-f',
      'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
      '--get-url',
    ]);

    console.log(`[yt-dlp] Successfully retrieved URL: ${videoUrl}`);
    return videoUrl.trim();
  } catch (error) {
    console.error(`[yt-dlp] Error resolving download for ${url}:`, error.message);
    // Return null if yt-dlp fails
    return null;
  }
}