import axios from 'axios';

const FALLBACK_BASE_URL = 'http://localhost:5000';

const resolveBaseUrl = () => {
  const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL;

  if (!configuredBaseUrl) {
    return FALLBACK_BASE_URL;
  }

  try {
    const parsedUrl = new URL(configuredBaseUrl);

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Unsupported protocol');
    }

    return parsedUrl.origin;
  } catch (error) {
    console.warn(
      `Invalid VITE_API_BASE_URL provided ("${configuredBaseUrl}"). Falling back to ${FALLBACK_BASE_URL}.`,
    );
    return FALLBACK_BASE_URL;
  }
};

export const apiClient = axios.create({
  baseURL: resolveBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
  withCredentials: false,
});

const getErrorMessage = (error) => {
  if (error?.response?.data?.error) {
    return error.response.data.error;
  }

  if (error?.message) {
    return error.message;
  }

  return 'An unexpected error occurred. Please try again later.';
};

export const extractApiError = (error) => ({
  message: getErrorMessage(error),
  status: error?.response?.status ?? null,
});
