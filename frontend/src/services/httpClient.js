import axios from 'axios';
import { API_BASE_URL, API_TIMEOUT } from '../config.js';

const httpClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withCredentials: false,
});

export default httpClient;
