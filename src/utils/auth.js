export const AUTH_API = import.meta.env.VITE_AUTH_API || "";

const TOKEN_KEY = "kcs_token";
const STUDENT_ID_KEY = "kcs_student_id";
const AUTH_TOKEN_KEY = "kcs_auth_token";
const REFRESH_TOKEN_KEY = "kcs_refresh_token";

export function getStoredToken() { try { return localStorage.getItem(TOKEN_KEY); } catch(e) { return null; } }
export function getStoredStudentId() { try { return localStorage.getItem(STUDENT_ID_KEY); } catch(e) { return null; } }
export function getStoredAuthToken() { try { return localStorage.getItem(AUTH_TOKEN_KEY); } catch(e) { return null; } }
export function getStoredRefreshToken() { try { return localStorage.getItem(REFRESH_TOKEN_KEY); } catch(e) { return null; } }

export function storeAuth(token, studentId, authToken, refreshToken) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STUDENT_ID_KEY, studentId);
    if (authToken) localStorage.setItem(AUTH_TOKEN_KEY, authToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  } catch(e) {}
}

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(STUDENT_ID_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch(e) {}
}

let CURRENT_USER = null;
export function getUser() { return CURRENT_USER; }
export function setUser(u) { CURRENT_USER = u; }
