// frontend/src/services/admin_auth_service.ts
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// -----------------------------
// Token Helpers
// -----------------------------
const TOKEN_KEY = "admin_token";

export const adminAuthToken = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

// -----------------------------
// Axios Instance with JWT
// -----------------------------
const adminAxios = axios.create({
  baseURL: API_BASE,
});

// Attach token to every request
adminAxios.interceptors.request.use((config) => {
  const token = adminAuthToken.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-logout on unauthorized
adminAxios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      adminAuthToken.clear();
      window.location.href = "/admin/login";
    }
    return Promise.reject(err);
  }
);

// -----------------------------
// Admin Auth API
// -----------------------------
export const adminAuthService = {
  async login(email: string, password: string) {
    const res = await axios.post(`${API_BASE}/admin/auth/login`, {
      email,
      password,
    });

    const token = res.data?.access_token;
    if (token) {
      adminAuthToken.set(token);
    }

    return res.data;
  },

  logout() {
    adminAuthToken.clear();
    window.location.href = "/admin/login";
  },

  isLoggedIn() {
    return !!adminAuthToken.get();
  },

  axios: adminAxios, // export axios instance for other services
};

export default adminAuthService;
