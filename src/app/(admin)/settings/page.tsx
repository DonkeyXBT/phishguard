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
    <div className="p-8 max-w-2xl page-enter">
      <div className="mb-6">
        <p className="kicker text-xs uppercase tracking-widest text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>Admin</p>
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">System <em className="not-italic text-[var(--signal)]" style={{ fontFamily: 'var(--serif)' }}>settings</em></h1>
        <p className="text-[var(--text-tertiary)] text-sm mt-1">Manage your account security</p>
      </div>

      {message && <div className="bg-[var(--signal)]/10 border border-[var(--signal-deep)] text-[var(--signal)] text-sm rounded-lg p-3 mb-4">{message}</div>}
      {error && <div className="bg-[var(--rust)]/10 border border-[var(--rust)] text-[var(--rust)] text-sm rounded-lg p-3 mb-4">{error}</div>}

      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-[var(--text-heading)] mb-1">Two-Factor Authentication</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          Add an extra layer of security to your account with a TOTP authenticator app.
        </p>

        <div className="flex items-center gap-3 mb-4">
          {mfaEnabled
            ? <ShieldCheck size={18} className="text-[var(--signal)]" />
            : <ShieldOff size={18} className="text-[var(--text-tertiary)]" />
          }
          <span className={`text-sm font-medium ${mfaEnabled ? 'text-[var(--signal)]' : 'text-[var(--text-tertiary)]'}`}>
            {mfaEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {step === 'idle' && (
          mfaEnabled ? (
            <button onClick={() => setStep('disable')}
              className="btn-press bg-[var(--rust)] hover:brightness-110 text-white text-sm font-semibold px-4 py-2 rounded-lg">
              Disable MFA
            </button>
          ) : (
            <button onClick={startSetup}
              className="btn-press bg-[var(--signal)] hover:bg-[var(--signal-deep)] text-[var(--ink)] text-sm font-semibold px-4 py-2 rounded-lg">
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
              <div className="bg-[var(--paper)] p-4 rounded-lg inline-block mb-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUri)}`}
                  alt="MFA QR Code" width={200} height={200} />
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mb-1">Or enter this secret manually:</p>
              <code className="block bg-[var(--bg-input)] text-[var(--signal)] text-xs p-2 rounded break-all select-all" style={{ fontFamily: 'var(--mono)' }}>{secret}</code>
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Verification code</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="000000"
                maxLength={6} pattern="[0-9]{6}" autoFocus
                className="w-full max-w-xs bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm text-center tracking-widest focus:outline-none focus:border-[var(--signal-deep)] transition-colors"
                style={{ fontFamily: 'var(--mono)' }}
                required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-press bg-[var(--signal)] hover:bg-[var(--signal-deep)] text-[var(--ink)] text-sm font-semibold px-4 py-2 rounded-lg">
                Verify &amp; Enable
              </button>
              <button type="button" onClick={() => setStep('idle')} className="btn-press border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm px-4 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        )}

        {step === 'disable' && (
          <form onSubmit={confirmDisable} className="space-y-4 mt-4 border-t border-[var(--border-secondary)] pt-4">
            <p className="text-sm text-[var(--amber)]">Enter your password to confirm disabling MFA.</p>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password"
                className="w-full max-w-xs bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--signal-deep)] transition-colors" required />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-press bg-[var(--rust)] hover:brightness-110 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                Confirm Disable
              </button>
              <button type="button" onClick={() => setStep('idle')} className="btn-press border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm px-4 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── ML Model ── */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl p-6 mt-6">
        <div className="flex items-center gap-2 mb-1">
          <Brain size={20} className="text-[var(--accent)]" />
          <h2 className="text-lg font-semibold text-[var(--text-heading)]">Machine Learning Model</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-4">
          The Naive Bayes classifier learns from every email an admin reviews. When you mark an email as phishing
          (delete or escalate) or release it as legitimate, the model trains automatically to improve future detection.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="bg-[var(--bg-hover)] border border-[var(--border-primary)] border-l-[3px] border-l-[var(--signal)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>Version</div>
            <div className="text-xl font-bold text-[var(--text-primary)]">v{mlStatus?.version ?? 1}</div>
          </div>
          <div className="bg-[var(--bg-hover)] border border-[var(--border-primary)] border-l-[3px] border-l-[var(--accent)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>Total Examples</div>
            <div className="text-xl font-bold text-[var(--text-primary)]">{mlStatus?.trainedOn ?? 0}</div>
          </div>
          <div className="bg-[var(--bg-hover)] border border-[var(--border-primary)] border-l-[3px] border-l-[var(--rust)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>Phishing Docs</div>
            <div className="text-xl font-bold text-[var(--rust)]">{mlStatus?.phishDocs ?? 0}</div>
          </div>
          <div className="bg-[var(--bg-hover)] border border-[var(--border-primary)] border-l-[3px] border-l-[var(--signal)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>Legitimate Docs</div>
            <div className="text-xl font-bold text-[var(--signal)]">{mlStatus?.hamDocs ?? 0}</div>
          </div>
          <div className="bg-[var(--bg-hover)] border border-[var(--border-primary)] border-l-[3px] border-l-[var(--amber)] rounded-lg p-3">
            <div className="text-xs text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>Vocabulary</div>
            <div className="text-xl font-bold text-[var(--text-primary)]">{mlStatus?.vocabularySize ?? 0}</div>
            <div className="text-xs text-[var(--text-tertiary)]">words</div>
          </div>
        </div>

        {/* Top tokens */}
        {mlStatus && (mlStatus.topPhishTokens.length > 0 || mlStatus.topHamTokens.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div className="bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[var(--rust)]"></div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Phishing Words Learned</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mlStatus.topPhishTokens.map(t => (
                  <span key={t.token} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-[var(--rust)]/10 border border-[var(--rust)] text-[var(--rust)] font-medium" style={{ fontFamily: 'var(--mono)' }}>
                    {t.token}
                    <span className="text-[10px] opacity-60">{t.phish}</span>
                  </span>
                ))}
                {mlStatus.topPhishTokens.length === 0 && <span className="text-xs text-[var(--text-tertiary)]">No data yet</span>}
              </div>
            </div>
            <div className="bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-[var(--signal)]"></div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Legitimate Words Learned</h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mlStatus.topHamTokens.map(t => (
                  <span key={t.token} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-[var(--signal)]/10 border border-[var(--signal-deep)] text-[var(--signal)] font-medium" style={{ fontFamily: 'var(--mono)' }}>
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
          <div className="bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-lg p-4 mb-5">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <Brain size={14} className="text-[var(--accent)]" />
              Recent Training Feed
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {mlStatus.recentTraining.map(t => {
                const isPhish = t.status === 'deleted' || t.status === 'escalated'
                return (
                  <div key={t.id} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--bg-card)] border border-[var(--border-secondary)]">
                    <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${isPhish ? 'bg-[var(--rust)]' : 'bg-[var(--signal)]'}`}></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[var(--text-primary)] truncate">{t.subject ?? '(no subject)'}</div>
                      <div className="text-[11px] text-[var(--text-tertiary)] truncate" style={{ fontFamily: 'var(--mono)' }}>{t.sender ?? 'unknown'}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border whitespace-nowrap ${
                      isPhish
                        ? 'bg-[var(--rust)]/10 text-[var(--rust)] border-[var(--rust)]'
                        : 'bg-[var(--signal)]/10 text-[var(--signal)] border-[var(--signal-deep)]'
                    }`} style={{ fontFamily: 'var(--mono)' }}>
                      {isPhish ? 'PHISH' : 'HAM'}
                    </span>
                    <span className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap" style={{ fontFamily: 'var(--mono)' }}>
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
            className="btn-press flex items-center gap-2 bg-[var(--signal)] hover:bg-[var(--signal-deep)] disabled:opacity-50 text-[var(--ink)] text-sm font-semibold rounded-lg px-4 py-2">
            <RefreshCw size={14} className={retraining ? 'animate-spin' : ''} />
            {retraining ? 'Retraining...' : 'Retrain From All Reports'}
          </button>
          <span className="text-xs text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--mono)' }}>
            Last updated {mlStatus?.updatedAt ? new Date(mlStatus.updatedAt).toLocaleString() : 'never'}
          </span>
        </div>
      </div>
    </div>
  )
}
