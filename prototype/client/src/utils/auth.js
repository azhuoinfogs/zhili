const STORAGE_KEYS = {
  token: 'zhili_token',
  user: 'zhili_user',
  expiresAt: 'zhili_expires_at'
};

export function getToken() {
  return localStorage.getItem(STORAGE_KEYS.token);
}

export function setToken(token, expiresIn) {
  localStorage.setItem(STORAGE_KEYS.token, token);
  const expiresAt = Date.now() + expiresIn * 1000;
  localStorage.setItem(STORAGE_KEYS.expiresAt, String(expiresAt));
}

export function getUser() {
  const userStr = localStorage.getItem(STORAGE_KEYS.user);
  try {
    return userStr ? JSON.parse(userStr) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
}

export function removeAuth() {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.expiresAt);
}

export function isLoggedIn() {
  const token = getToken();
  const expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);
  if (!token || !expiresAt) return false;
  return Date.now() < Number(expiresAt);
}

export async function sendCode(phone) {
  const res = await fetch('/api/user/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone })
  });
  const data = await res.json();
  return { ok: res.ok, ...data };
}

export async function register(phone, password, nickname, code) {
  const res = await fetch('/api/user/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password, nickname, code })
  });
  const data = await res.json();
  if (res.ok && data.token) {
    setToken(data.token, data.expires_in);
    setUser(data.user);
  }
  return { ok: res.ok, ...data };
}

export async function login(phone, password) {
  const res = await fetch('/api/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password })
  });
  const data = await res.json();
  if (res.ok && data.token) {
    setToken(data.token, data.expires_in);
    setUser(data.user);
  }
  return { ok: res.ok, ...data };
}

export async function getUserInfo() {
  const token = getToken();
  if (!token) return { ok: false, error: 'NO_TOKEN' };
  
  const res = await fetch('/api/user/me', {
    method: 'GET',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await res.json();
  if (res.ok && data.user) {
    setUser(data.user);
  }
  return { ok: res.ok, ...data };
}

export async function updateUserInfo(nickname, avatar) {
  const token = getToken();
  if (!token) return { ok: false, error: 'NO_TOKEN' };
  
  const res = await fetch('/api/user/me', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ nickname, avatar })
  });
  const data = await res.json();
  if (res.ok && data.user) {
    setUser(data.user);
  }
  return { ok: res.ok, ...data };
}

export async function changePassword(oldPassword, newPassword) {
  const token = getToken();
  if (!token) return { ok: false, error: 'NO_TOKEN' };
  
  const res = await fetch('/api/user/password', {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ oldPassword, newPassword })
  });
  const data = await res.json();
  return { ok: res.ok, ...data };
}

export function logout() {
  removeAuth();
}