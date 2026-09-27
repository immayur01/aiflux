import axios from 'axios';
import { supabase } from '../supabase.js';

const api = axios.create({
  baseURL: '/api',
});

// ── Attach Supabase JWT Token on every request ────────────────────────────────
api.interceptors.request.use(async config => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      config.headers['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn('Could not retrieve Supabase session token:', err);
  }
  return config;
});

// ── Handle unauthorized responses ─────────────────────────────────────────────
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new Event('flux:logout'));
    }
    return Promise.reject(err);
  }
);

export default api;
