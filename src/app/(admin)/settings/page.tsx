'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ShieldCheck, ShieldOff, Brain, RefreshCw } from 'lucide-react'

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
  const [mlStatus, setMlStatus] = useState<{
    exists: boolean
    version: number
    trainedOn: number
    phishDocs: number
    hamDocs: number
    vocabularySize: number
    updatedAt: string | null
    topPhishTokens: Array<{ token: string; phish: number; ham: number }>
    topHamTokens: Array<{ token: string; phish: number; ham: number }>
    recentTraining: Array<{ id: string; subject: string | null; sender: string | null; status: string; riskScore: number; riskLevel: string; reviewedAt: string }>
  } | null>(null)
  const [retraining, setRetraining] = useState(false)

  useEffect(() => {
    api.me().then(r => { if (r.ok) return r.json(); return null }).then(d => {
      if (d) setMfaEnabled(d.mfaEnabled)
      setLoading(false)
    })
    api.get('/api/admin/ml').then(r => { if (r.ok) return r.json(); return null }).then(d => { if (d) setMlStatus(d) })
  }, [])

  const retrainModel = async () => {
    setRetraining(true)
    setError(''); setMessage('')
    try {
      const res = await api.post('/api/admin/ml', {})
      const data = await res.json()
      if (res.ok) {
        setMessage(`Model retrained on ${data.trained} examples (${data.phish} phishing, ${data.ham} legitimate)`)
        const status = await api.get('/api/admin/ml').then(r => r.json())
        setMlStatus(status)
      } else {
        setError(data.error || 'Retrain failed')
      }
    } finally {
      setRetraining(false)
    }
  }

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

      {/* ── ML Model ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 shadow-[var(--shadow-sm)] mt-6">
        <div className="flex items-center gap-2 mb-1">
          <Brain size={20} className="text-blue-600 dark:text-blue-400" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Machine Learning Model</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          The Naive Bayes classifier learns from every email an admin reviews. When you mark an email as phishing
          (delete or escalate) or release it as legitimate, the model trains automatically to improve future detection.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] border-l-[3px] border-l-blue-500 rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1">Version</div>
            <div className="text-xl font-bold text-[var(--text-primary)]">v{mlStatus?.version ?? 1}</div>
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] border-l-[3px] border-l-violet-500 rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1">Total Examples</div>
            <div className="text-xl font-bold text-[var(--text-primary)]">{mlStatus?.trainedOn ?? 0}</div>
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] border-l-[3px] border-l-red-500 rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1">Phishing Docs</div>
            <div className="text-xl font-bold text-red-600 dark:text-red-400">{mlStatus?.phishDocs ?? 0}</div>
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] border-l-[3px] border-l-emerald-500 rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1">Legitimate Docs</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{mlStatus?.hamDocs ?? 0}</div>
          </div>
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] border-l-[3px] border-l-amber-500 rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1">Vocabulary</div>
            <div className="text-xl font-bold text-[var(--text-primary)]">{mlStatus?.vocabularySize ?? 0}</div>
            <div className="text-xs text-[var(--text-tertiary)]">words</div>
          </div>
        </div>

        {/* Top tokens */}
        {mlStatus && (mlStatus.topPhishTokens.length > 0 || mlStatus.topHamTokens.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Phishing Words Learned</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mlStatus.topPhishTokens.map(t => (
                  <span key={t.token} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-medium">
                    {t.token}
                    <span className="text-[10px] opacity-60">{t.phish}</span>
                  </span>
                ))}
                {mlStatus.topPhishTokens.length === 0 && <span className="text-xs text-[var(--text-tertiary)]">No data yet</span>}
              </div>
            </div>
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Legitimate Words Learned</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mlStatus.topHamTokens.map(t => (
                  <span key={t.token} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 font-medium">
                    {t.token}
                    <span className="text-[10px] opacity-60">{t.ham}</span>
                  </span>
                ))}
                {mlStatus.topHamTokens.length === 0 && <span className="text-xs text-[var(--text-tertiary)]">No data yet</span>}
              </div>
            </div>
          </div>
        )}

        {/* Recent training feed */}
        {mlStatus && mlStatus.recentTraining.length > 0 && (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-lg p-4 mb-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Brain size={14} className="text-blue-600 dark:text-blue-400" />
              Recent Training Feed
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {mlStatus.recentTraining.map(t => {
                const isPhish = t.status === 'deleted' || t.status === 'escalated'
                return (
                  <div key={t.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-secondary)]">
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${isPhish ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">{t.subject ?? '(no subject)'}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate">{t.sender ?? 'unknown'}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap ${
                      isPhish
                        ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800'
                        : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    }`}>
                      {isPhish ? 'PHISH' : 'HAM'}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">
                      {new Date(t.reviewedAt).toLocaleDateString()}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={retrainModel} disabled={retraining}
            className="btn-press flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2">
            <RefreshCw size={14} className={retraining ? 'animate-spin' : ''} />
            {retraining ? 'Retraining...' : 'Retrain From All Reports'}
          </button>
          <span className="text-xs text-[var(--text-tertiary)]">
            Last updated {mlStatus?.updatedAt ? new Date(mlStatus.updatedAt).toLocaleString() : 'never'}
          </span>
        </div>
      </div>
    </div>
  )
}
