const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

export const isValidUrl = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return false;
  }

  try {
    const parsedUrl = new URL(value.trim());
    return SUPPORTED_PROTOCOLS.has(parsedUrl.protocol);
  } catch (error) {
    return false;
  }
};

export const normaliseUrl = (value) => value.trim();
