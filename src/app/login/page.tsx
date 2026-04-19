'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

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
    <div className="min-h-screen flex items-center justify-center bg-[var(--ink)]">
      <div className="w-full max-w-sm page-enter">
        <div className="text-center mb-8">
          {/* Cyfenced logo mark */}
          <div className="inline-block mb-4">
            <svg width="56" height="56" viewBox="0 0 64 64" aria-label="Cyfenced">
              <rect x="10" y="14" width="38" height="3" fill="#F4F1EA" />
              <rect x="10" y="47" width="38" height="3" fill="#F4F1EA" />
              <rect x="10" y="10" width="3" height="44" fill="#F4F1EA" />
              <rect x="18" y="17" width="3" height="30" fill="#F4F1EA" />
              <rect x="26" y="17" width="3" height="30" fill="#F4F1EA" />
              <rect x="34" y="17" width="3" height="30" fill="#F4F1EA" />
              <rect x="42" y="6" width="3" height="41" fill="#4ADE80" />
              <circle cx="43.5" cy="4" r="1.6" fill="#4ADE80" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--paper)] tracking-tight">
            cyfenced<span className="text-[var(--signal)]">.</span>
          </h1>
          <p className="text-[var(--mute)] text-xs mt-1 uppercase tracking-[2px]" style={{ fontFamily: 'var(--mono)' }}>PhishGuard Console</p>
        </div>
        <form onSubmit={handleLogin} className="bg-[var(--slate)] rounded-lg p-6 border border-[var(--slate-line)] space-y-4">
          {error && <div className="bg-[var(--rust)]/10 border border-[var(--rust)]/30 text-[var(--rust)] text-sm rounded p-3">{error}</div>}
          {setupMsg && <div className="bg-[var(--signal-soft)] border border-[var(--signal-deep)]/30 text-[var(--signal)] text-xs rounded p-3 break-all">{setupMsg}</div>}

          {!mfaRequired ? (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--fog)] mb-1.5">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.com"
                  className="w-full bg-[var(--ink)] border border-[var(--slate-line)] rounded px-3 py-2.5 text-[var(--paper)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/20 focus:border-[var(--signal-deep)]" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--fog)] mb-1.5">Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                  className="w-full bg-[var(--ink)] border border-[var(--slate-line)] rounded px-3 py-2.5 text-[var(--paper)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/20 focus:border-[var(--signal-deep)]" required />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-[var(--fog)] mb-1.5">MFA Code</label>
              <p className="text-xs text-[var(--mute)] mb-2">Enter the 6-digit code from your authenticator app</p>
              <input type="text" value={mfaCode} onChange={e => setMfaCode(e.target.value)} placeholder="000000"
                maxLength={6} pattern="[0-9]{6}" autoFocus
                className="w-full bg-[var(--ink)] border border-[var(--slate-line)] rounded px-3 py-2.5 text-[var(--paper)] text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-[var(--signal)]/20 focus:border-[var(--signal-deep)]" style={{ fontFamily: 'var(--mono)' }} required />
              <button type="button" onClick={() => { setMfaRequired(false); setMfaCode(''); setError('') }}
                className="text-xs text-[var(--mute)] hover:text-[var(--fog)] mt-2">
                Back to login
              </button>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="btn-press w-full bg-[var(--signal)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-[var(--ink)] font-semibold rounded py-2.5 text-sm">
            {loading ? 'Signing in...' : mfaRequired ? 'Verify' : 'Sign in →'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={handleSetup} className="text-xs text-[var(--mute)] hover:text-[var(--fog)] underline">
            First time? Run initial setup
          </button>
        </div>
      </div>
    </div>
  )
}
