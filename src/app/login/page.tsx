'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('admin@company.com')
  const [password, setPassword] = useState('admin123')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [setupMsg, setSetupMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await api.login(email, password)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Login failed'); return }
      localStorage.setItem('token', data.access_token)
      router.push('/dashboard')
    } catch {
      setError('Could not connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleSetup = async () => {
    const res = await api.setup()
    const data = await res.json()
    if (res.ok) setSetupMsg(`Setup done. Login: ${data.email} / ${data.password}. API Key: ${data.api_key}`)
    else setError(data.error ?? 'Setup failed')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-600 rounded-2xl mb-4 text-2xl">🛡️</div>
          <h1 className="text-2xl font-bold text-white">PhishGuard</h1>
          <p className="text-gray-400 text-sm mt-1">Admin Console</p>
        </div>
        <form onSubmit={handleLogin} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
          {error && <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg p-3">{error}</div>}
          {setupMsg && <div className="bg-green-950 border border-green-800 text-green-400 text-xs rounded-lg p-3 break-all">{setupMsg}</div>}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" required />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500" required />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={handleSetup} className="text-xs text-gray-500 hover:text-gray-400 underline">
            First time? Run initial setup
          </button>
        </div>
      </div>
    </div>
  )
}
