import axios from 'axios';

const DEFAULT_TIMEOUT = 15000;

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  timeout: DEFAULT_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.error) {
      return Promise.reject(new Error(error.response.data.error));
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(
        new Error('The request timed out. Please try again in a moment.')
      );
    }

    return Promise.reject(
      new Error(
        error.message || 'An unexpected error occurred. Please try again.'
      )
    );
  }
);

export default apiClient;
