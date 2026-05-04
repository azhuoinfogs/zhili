const TOKEN_KEY = 'zhili_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function apiJson(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const r = await fetch(`/api${path}`, { ...options, headers });
  if (r.status === 401) {
    setToken(null);
    if (!path.startsWith('/admin/auth/login')) {
      window.location.hash = '#/login';
    }
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || '401 未授权');
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || `请求失败 ${r.status}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

export async function uploadImage(file) {
  const token = getToken();
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/admin/upload/image', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (r.status === 401) {
    setToken(null);
    window.location.hash = '#/login';
    throw new Error('401 未授权');
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message || '上传失败');
  }
  return r.json();
}
