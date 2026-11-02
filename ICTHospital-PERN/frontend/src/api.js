// Thin fetch wrapper. Throws ApiError(status, message, errors) so pages can show Laravel-style field errors.
export class ApiError extends Error { constructor(status, message, errors, permission) { super(message); this.status = status; this.errors = errors || {}; this.permission = permission; } }
const qs = (params) => { const p = new URLSearchParams(); Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); }); const s = p.toString(); return s ? `?${s}` : ''; };
async function request(method, url, body) {
  const headers = {}; let payload;
  if (body instanceof FormData) payload = body; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`/api${url}`, { method, headers, body: payload, credentials: 'same-origin' });
  const text = await res.text(); let data; try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith('/login') && !url.startsWith('/me') && !url.startsWith('/public')) window.dispatchEvent(new Event('auth:expired'));
    throw new ApiError(res.status, (data && data.error) || res.statusText, data && data.errors, data && data.permission);
  }
  return data;
}
export const api = {
  get: (url, params) => request('GET', url + qs(params)),
  post: (url, body = {}) => request('POST', url, body),
  put: (url, body = {}) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
  url: (url, params) => `/api${url}${qs(params)}`,
};
export const fileUrl = (rel) => (rel ? `/storage/${rel}` : null);
// Builds a FormData from a plain object (files stay files) for routes that accept uploads.
export function toForm(values) { const f = new FormData(); Object.entries(values).forEach(([k, v]) => { if (v === undefined || v === null) return; if (v instanceof File) f.append(k, v); else if (typeof v === 'boolean') f.append(k, v ? '1' : ''); else f.append(k, v); }); return f; }
