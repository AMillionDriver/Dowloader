import axios from 'axios';
import { API_BASE_URL, REQUEST_TIMEOUT } from '../config';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      return Promise.reject(error);
    }

    const networkError = new Error(
      'Unable to reach the server. Please check your connection and try again.'
    );
    networkError.name = 'NetworkError';
    return Promise.reject(networkError);
  }
);

export default apiClient;
