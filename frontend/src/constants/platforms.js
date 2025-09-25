export const SUPPORTED_PLATFORMS = [
  {
    name: 'TikTok',
    hostPatterns: [/^([\w-]+\.)*tiktok\.com$/i],
    example: 'https://www.tiktok.com/@username/video/1234567890',
  },
  {
    name: 'Instagram',
    hostPatterns: [/^([\w-]+\.)*instagram\.com$/i],
    example: 'https://www.instagram.com/reel/ABCDEFG1234/',
  },
  {
    name: 'Facebook',
    hostPatterns: [/^([\w-]+\.)*facebook\.com$/i, /^fb\.watch$/i],
    example: 'https://www.facebook.com/watch/?v=1234567890',
  },
];
