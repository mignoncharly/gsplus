import { getStoredLocale } from './i18n.js';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const apiUrl = (path) => `${API_URL}${path}`;

export const apiFetch = async (path, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    'Accept-Language': getStoredLocale(),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.error?.message || `API request failed with ${response.status}`;
    const error = new Error(message);
    error.code = payload?.error?.code;
    error.details = payload?.error?.details || [];
    error.status = response.status;
    throw error;
  }

  return payload;
};

