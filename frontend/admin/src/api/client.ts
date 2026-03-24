import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  setup: () => api.post('/auth/setup'),
}

export const adminApi = {
  getStats: () => api.get('/admin/stats'),
  getQueue: (params?: { status?: string; risk_level?: string; limit?: number; offset?: number }) =>
    api.get('/admin/queue', { params }),
  getReport: (id: string) => api.get(`/admin/reports/${id}`),
  reviewReport: (id: string, action: string, notes?: string) =>
    api.put(`/admin/reports/${id}/review`, { action, notes }),
}
