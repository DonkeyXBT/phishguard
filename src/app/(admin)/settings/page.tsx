'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ShieldCheck, ShieldOff } from 'lucide-react'

export default function SettingsPage() {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<'idle' | 'setup' | 'disable'>('idle')
  const [secret, setSecret] = useState('')
  const [otpauthUri, setOtpauthUri] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    api.me().then(r => { if (r.ok) return r.json(); return null }).then(d => {
      if (d) setMfaEnabled(d.mfaEnabled)
      setLoading(false)
    })
  }, [])

  const startSetup = async () => {
    setError(''); setMessage('')
    const res = await api.mfaSetup()
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setSecret(data.secret)
    setOtpauthUri(data.otpauth_uri)
    setStep('setup')
  }

  const confirmSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setMessage('')
    const res = await api.mfaVerify(code)
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setMfaEnabled(true)
    setStep('idle')
    setCode('')
    setMessage('MFA enabled successfully!')
  }

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(''); setMessage('')
    const res = await api.mfaDisable(password)
    const data = await res.json()
    if (!res.ok) { setError(data.error); return }
    setMfaEnabled(false)
    setStep('idle')
    setPassword('')
    setMessage('MFA disabled.')
  }

  if (loading) return <div className="p-8 text-[var(--text-tertiary)]">Loading...</div>

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
        <p className="text-[var(--text-tertiary)] text-sm mt-1">Manage your account security</p>
      </div>

      {message && <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm rounded-lg p-3 mb-4">{message}</div>}
      {error && <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg p-3 mb-4">{error}</div>}

      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-[var(--shadow-sm)]">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-1">Two-Factor Authentication</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Add an extra layer of security to your account with a TOTP authenticator app.
        </p>

        <div className="flex items-center gap-3 mb-4">
          {mfaEnabled
            ? <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
            : <ShieldOff size={18} className="text-[var(--text-tertiary)]" />
          }
          <span className={`text-sm font-medium ${mfaEnabled ? 'text-emerald-700 dark:text-emerald-400' : 'text-[var(--text-tertiary)]'}`}>
            {mfaEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {step === 'idle' && (
          mfaEnabled ? (
            <button onClick={() => setStep('disable')}
              className="btn-press bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              Disable MFA
            </button>
          ) : (
            <button onClick={startSetup}
              className="btn-press bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              Enable MFA
            </button>
          )
        )}

        {step === 'setup' && (
          <form onSubmit={confirmSetup} className="space-y-4 mt-4 border-t border-[var(--border-secondary)] pt-4">
            <div>
              <p className="text-sm text-[var(--text-secondary)] mb-2">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, 1Password, etc.):
              </p>
              <div className="bg-white p-4 rounded-lg inline-block mb-3 shadow-[var(--shadow-sm)]">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`}
                  alt="MFA QR Code" width={200} height={200} />
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mb-1">Or enter this secret manually:</p>
              <code className="block bg-[var(--bg-tertiary)] text-emerald-700 dark:text-emerald-400 text-xs p-2 rounded font-mono break-all select-all">{secret}</code>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Verification code</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="000000"
                maxLength={6} pattern="[0-9]{6}" autoFocus
                className="w-full max-w-xs bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm text-center tracking-widest font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-press bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                Verify &amp; Enable
              </button>
              <button type="button" onClick={() => setStep('idle')} className="btn-press bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm px-4 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        )}

        {step === 'disable' && (
          <form onSubmit={confirmDisable} className="space-y-4 mt-4 border-t border-[var(--border-secondary)] pt-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">Enter your password to confirm disabling MFA.</p>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                className="w-full max-w-xs bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
                Confirm Disable
              </button>
              <button type="button" onClick={() => setStep('idle')} className="btn-press bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm px-4 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
