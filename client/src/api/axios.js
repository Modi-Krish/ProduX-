import axios from 'axios';
import { auth } from './firebase';

let apiBaseUrl = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

// Detect if running on a native mobile device (Capacitor webview)
const isCapacitor = 
  window.location.origin.startsWith('capacitor://') || 
  (window.location.origin === 'http://localhost' && !window.location.port) || 
  (window.location.origin === 'https://localhost' && !window.location.port);

// If on a native device and the configuration points to local machine localhost,
// redirect to the production backend so it doesn't crash on device.
if (isCapacitor && apiBaseUrl.includes('localhost')) {
  apiBaseUrl = 'https://produx-orcin.vercel.app/api';
}

const API = axios.create({
  baseURL: apiBaseUrl,
});

// Attach Firebase Auth ID token to every request asynchronously
API.interceptors.request.use(async (config) => {
  if (auth && auth.currentUser) {
    try {
      // Pass false (or nothing) so Firebase only refreshes the token if it's expired
      const token = await auth.currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    } catch (err) {
      console.error('Failed to retrieve Firebase ID token:', err);
    }
  } else {
    // Fallback if user is not fully loaded/cached
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isAuthRoute = error.config?.url?.includes('/auth/login') || error.config?.url?.includes('/auth/register');
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !isAuthRoute && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        if (auth && auth.currentUser) {
          // Force refresh the token
          const newToken = await auth.currentUser.getIdToken(true);
          
          // Update Redux/LocalStorage manually if needed (Redux usually handles this via onIdTokenChanged, 
          // but we update localStorage here just in case)
          localStorage.setItem('token', newToken);
          
          // Retry the original request with the new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return API(originalRequest);
        } else {
          throw new Error("No current user");
        }
      } catch (refreshError) {
        console.error('Failed to refresh token after 401:', refreshError);
        // If refresh fails, log out
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default API;
