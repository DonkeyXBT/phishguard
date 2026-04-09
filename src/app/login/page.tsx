'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Shield } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [setupMsg, setSetupMsg] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setLoading(true)
    try {
      const res = await api.login(email, password, mfaRequired ? mfaCode : undefined)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Login failed'); return }
      if (data.mfa_required) { setMfaRequired(true); return }
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
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-secondary)]">
      <div className="w-full max-w-sm page-enter">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-700 to-blue-500 rounded-2xl mb-4 shadow-lg shadow-blue-500/20">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">PhishGuard</h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">Admin Console</p>
        </div>
        <form onSubmit={handleLogin} className="bg-[var(--bg-card)] rounded-2xl p-6 border border-[var(--border-primary)] shadow-[var(--shadow-md)] space-y-4">
          {error && <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg p-3">{error}</div>}
          {setupMsg && <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-xs rounded-lg p-3 break-all">{setupMsg}</div>}

          {!mfaRequired ? (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.com"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" required />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">MFA Code</label>
              <p className="text-xs text-[var(--text-tertiary)] mb-2">Enter the 6-digit code from your authenticator app</p>
              <input type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value)} placeholder="000000"
                maxLength={6} pattern="[0-9]{6}" autoFocus
                className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500" required />
              <button type="button" onClick={() => { setMfaRequired(false); setMfaCode(''); setError('') }}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] mt-2">
                Back to login
              </button>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="btn-press w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm shadow-sm">
            {loading ? 'Signing in...' : mfaRequired ? 'Verify' : 'Sign in'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={handleSetup} className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] underline">
            First time? Run initial setup
          </button>
        </div>
      </div>
    </div>
  )
}
