const BASE = ''  // same origin

async function request(path: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  })
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }
  return res
}

export const api = {
  // Generic methods
  get:    (path: string) => request(path),
  post:   (path: string, body: unknown) => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  (path: string, body: unknown) => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path: string)               => request(path, { method: 'DELETE' }),

  // Named helpers
  login: (email: string, password: string, mfa_code?: string) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password, mfa_code }) }),
  me: () => request('/api/auth/me'),
  setup: () => request('/api/auth/setup', { method: 'POST' }),
  getStats: () => request('/api/admin/stats'),
  getQueue: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/api/admin/queue${qs}`)
  },
  getReport:   (id: string) => request(`/api/admin/reports/${id}`),
  getDomains:  () => request('/api/admin/domains'),
  addDomain:   (domain: string, listType: string, reason?: string) =>
    request('/api/admin/domains', { method: 'POST', body: JSON.stringify({ domain, listType, reason }) }),
  removeDomain:   (id: string) => request(`/api/admin/domains/${id}`, { method: 'DELETE' }),
  syncThreatIntel: () => request('/api/admin/threat-intel/sync', { method: 'POST' }),
  reviewReport: (id: string, action: string, notes?: string) =>
    request(`/api/admin/reports/${id}/review`, { method: 'PUT', body: JSON.stringify({ action, notes }) }),

  // Audit
  getAuditLogs: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return request(`/api/admin/audit${qs}`)
  },

  // MFA
  mfaSetup:   () => request('/api/auth/mfa/setup', { method: 'POST' }),
  mfaVerify:  (code: string) => request('/api/auth/mfa/verify', { method: 'POST', body: JSON.stringify({ code }) }),
  mfaDisable: (password: string) => request('/api/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ password }) }),
}
