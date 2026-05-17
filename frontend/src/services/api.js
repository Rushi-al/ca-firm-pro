import axios from 'axios';

const api = axios.create({
  baseURL:         import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,   // send httpOnly cookie on every request
});

let isRefreshing    = false;
let failedQueue     = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve(token));
  failedQueue = [];
};

// ── Attach access token ────────────────────────────────────
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Auto-refresh on 401 ────────────────────────────────────
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    const data     = err.response?.data;

    // If 401 with tokenExpired flag → try to refresh
    if (err.response?.status === 401 && data?.data?.tokenExpired && !original._retry) {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        }).catch(Promise.reject);
      }

      original._retry  = true;
      isRefreshing     = true;

      try {
        // Call refresh — refresh token is in httpOnly cookie automatically
        const baseUrl = import.meta.env.VITE_API_URL || '';
        const res   = await axios.post(`${baseUrl}/api/auth/refresh`, {}, { withCredentials: true });
        const token = res.data.data.accessToken;
        sessionStorage.setItem('accessToken', token);
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
        processQueue(null, token);
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        sessionStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // Hard 401 (not token-expired) → redirect to login
    if (err.response?.status === 401 && !data?.data?.tokenExpired) {
      sessionStorage.removeItem('accessToken');
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;
