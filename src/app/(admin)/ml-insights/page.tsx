'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Brain, Sparkles, Play, FileText, AlertOctagon, ShieldCheck, HelpCircle } from 'lucide-react'

interface TokenContrib {
  token: string
  phishScore: number
  count: number
}

interface Explanation {
  text_length: number
  token_count: number
  probability: number
  confidence: number
  verdict: 'phishing' | 'legitimate' | 'uncertain'
  topPhishTokens: TokenContrib[]
  topHamTokens: TokenContrib[]
  model_phish_docs: number
  model_ham_docs: number
}

interface RecentReport {
  id: string
  subject: string | null
  sender: string | null
  riskScore: number
  riskLevel: string
  status: string
  reportedAt: string
}

export default function MlInsightsPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [explanation, setExplanation] = useState<Explanation | null>(null)
  const [loading, setLoading] = useState(false)
  const [recent, setRecent] = useState<RecentReport[]>([])
  const [recentExplanations, setRecentExplanations] = useState<Record<string, Explanation>>({})

  useEffect(() => {
    api.getQueue({ limit: '8' }).then(r => { if (r.ok) return r.json(); return [] }).then(d => {
      if (Array.isArray(d)) setRecent(d)
    })
  }, [])

  const explain = async (input: { text?: string; reportId?: string }, key?: string) => {
    setLoading(true)
    try {
      const res = await api.post('/api/admin/ml/explain', input)
      const data = await res.json()
      if (res.ok) {
        if (key) setRecentExplanations(prev => ({ ...prev, [key]: data }))
        else setExplanation(data)
      }
    } finally {
      setLoading(false)
    }
  }

  const sampleTexts = [
    {
      label: 'Phishing example',
      text: 'URGENT: Your account will be suspended immediately! Click here to verify your password and confirm your identity within 24 hours or you will lose access. Wire transfer required to avoid termination.',
    },
    {
      label: 'Legitimate example',
      text: 'Hi team, attached is the agenda for tomorrow\'s quarterly review meeting. Please review the project updates and let me know if you have any questions before our call. Thanks!',
    },
  ]

  return (
    <div className="p-8 page-enter">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--signal)] flex items-center justify-center">
          <Brain size={20} className="text-[var(--ink)]" />
        </div>
        <div>
          <p className="kicker text-xs uppercase tracking-widest text-[var(--text-tertiary)] mb-0.5" style={{ fontFamily: 'var(--mono)' }}>Admin</p>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">ML <em className="not-italic text-[var(--signal)]" style={{ fontFamily: 'var(--serif)' }}>insights</em></h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-0.5">See how the machine learning model decides which emails are phishing</p>
        </div>
      </div>

      {/* How it works explainer */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <HelpCircle size={16} className="text-[var(--accent)]" />
          <h2 className="font-semibold text-[var(--text-heading)]">How the model decides</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
          This is a <strong>Naive Bayes classifier</strong>. It looks at every word in an email and calculates two probabilities:
          how likely those words appear in phishing emails versus legitimate emails (based on what it&apos;s been trained on).
          The verdict is whichever class has the higher combined probability. Words like &quot;urgent&quot;, &quot;verify password&quot;,
          and &quot;wire transfer&quot; push the score toward phishing. Words like &quot;meeting&quot;, &quot;agenda&quot;, and &quot;thanks&quot; push it toward legitimate.
        </p>
      </div>

      {/* Test the model */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <h2 className="font-semibold text-[var(--text-heading)]">Test the Model</h2>
          </div>
          <div className="flex gap-2">
            {sampleTexts.map(s => (
              <button key={s.label} onClick={() => setText(s.text)}
                className="btn-press text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] rounded-md px-2 py-1">
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Paste any email text here to see the model's prediction and reasoning..."
          rows={6}
          className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--signal-deep)] mb-3 resize-y"
        />
        <button onClick={() => explain({ text })} disabled={loading || text.length < 10}
          className="btn-press flex items-center gap-2 bg-[var(--signal)] hover:bg-[var(--signal-deep)] disabled:opacity-50 text-[var(--ink)] text-sm font-semibold rounded-lg px-4 py-2">
          <Play size={14} />
          {loading ? 'Analyzing...' : 'Run Model'}
        </button>

        {explanation && <ExplanationCard exp={explanation} />}
      </div>

      {/* Recent reports with click-to-explain */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <FileText size={16} className="text-[var(--signal)]" />
          <h2 className="font-semibold text-[var(--text-heading)]">Recent Reports — Explain Any</h2>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] mb-4">Click any report to see what the ML model saw in that specific email.</p>

        <div className="space-y-2">
          {recent.length === 0 && <div className="text-sm text-[var(--text-tertiary)] text-center py-6">No reports yet</div>}
          {recent.map(r => {
            const exp = recentExplanations[r.id]
            return (
              <div key={r.id} className="border border-[var(--border-primary)] rounded-lg overflow-hidden">
                <button
                  onClick={() => exp ? setRecentExplanations(prev => { const n = { ...prev }; delete n[r.id]; return n }) : explain({ reportId: r.id }, r.id)}
                  className="w-full text-left p-3 hover:bg-[var(--bg-hover)] transition-colors flex items-center gap-3"
                >
                  <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${
                    r.riskLevel === 'critical' ? 'bg-[var(--rust)]'
                    : r.riskLevel === 'high' ? 'bg-[var(--amber)]'
                    : r.riskLevel === 'medium' ? 'bg-[var(--amber)]'
                    : 'bg-[var(--signal)]'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">{r.subject ?? '(no subject)'}</div>
                    <div className="text-xs text-[var(--text-tertiary)] truncate" style={{ fontFamily: 'var(--mono)' }}>{r.sender ?? 'unknown'}</div>
                  </div>
                  <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-input)] px-2 py-1 rounded shrink-0" style={{ fontFamily: 'var(--mono)' }}>
                    Rule: {r.riskScore}/100
                  </span>
                  <span className="text-xs text-[var(--accent)] font-medium shrink-0">
                    {exp ? 'Hide' : 'Explain \u2192'}
                  </span>
                </button>
                {exp && (
                  <div className="border-t border-[var(--border-primary)] p-4 bg-[var(--bg-hover)]">
                    <ExplanationCard exp={exp} compact />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function ExplanationCard({ exp, compact = false }: { exp: Explanation; compact?: boolean }) {
  const probPct = Math.round(exp.probability * 100)
  const confPct = Math.round(exp.confidence * 100)
  const verdictColor =
    exp.verdict === 'phishing' ? 'text-[var(--rust)] bg-[var(--rust)]/10 border-[var(--rust)]'
    : exp.verdict === 'legitimate' ? 'text-[var(--signal)] bg-[var(--signal)]/10 border-[var(--signal-deep)]'
    : 'text-[var(--amber)] bg-[var(--amber)]/10 border-[var(--amber)]'
  const verdictIcon =
    exp.verdict === 'phishing' ? <AlertOctagon size={16} />
    : exp.verdict === 'legitimate' ? <ShieldCheck size={16} />
    : <HelpCircle size={16} />

  // Compute max absolute score for bar normalization
  const maxAbs = Math.max(
    ...exp.topPhishTokens.map(t => Math.abs(t.phishScore)),
    ...exp.topHamTokens.map(t => Math.abs(t.phishScore)),
    1
  )

  return (
    <div className={compact ? 'mt-0' : 'mt-5'}>
      {/* Verdict */}
      <div className="flex items-center gap-3 mb-4">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold uppercase tracking-wide border ${verdictColor}`}>
          {verdictIcon}
          {exp.verdict}
        </div>
        <div className="text-sm text-[var(--text-secondary)]">
          <span className="font-bold text-[var(--text-primary)]">{probPct}%</span> phishing probability
          <span className="text-[var(--text-tertiary)]"> · {confPct}% confidence</span>
        </div>
      </div>

      {/* Probability bar */}
      <div className="mb-5">
        <div className="flex justify-between text-xs text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>
          <span>Legitimate</span>
          <span>Phishing</span>
        </div>
        <div className="h-3 rounded-full relative overflow-hidden" style={{ background: 'linear-gradient(to right, var(--signal), var(--amber), var(--rust))' }}>
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[var(--text-primary)] shadow"
            style={{ left: `${probPct}%`, transform: 'translateX(-50%)' }}
          ></div>
        </div>
      </div>

      {/* Token contributions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[var(--rust)]"></div>
            <h3 className="kicker text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--mono)' }}>Words Pushing \u2192 Phishing</h3>
          </div>
          {exp.topPhishTokens.length === 0 && <div className="text-xs text-[var(--text-tertiary)]">None</div>}
          <div className="space-y-1.5">
            {exp.topPhishTokens.map(t => {
              const width = Math.round((Math.abs(t.phishScore) / maxAbs) * 100)
              return (
                <div key={t.token} className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-primary)] w-24 truncate" style={{ fontFamily: 'var(--mono)' }}>{t.token}</span>
                  <div className="flex-1 h-4 bg-[var(--bg-input)] rounded overflow-hidden">
                    <div className="h-full bg-[var(--rust)]/70 bar-fill" style={{ width: `${width}%` }}></div>
                  </div>
                  {t.count > 1 && <span className="text-[10px] text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--mono)' }}>\u00d7{t.count}</span>}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[var(--signal)]"></div>
            <h3 className="kicker text-xs font-semibold uppercase tracking-widest text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--mono)' }}>Words Pushing \u2192 Legitimate</h3>
          </div>
          {exp.topHamTokens.length === 0 && <div className="text-xs text-[var(--text-tertiary)]">None</div>}
          <div className="space-y-1.5">
            {exp.topHamTokens.map(t => {
              const width = Math.round((Math.abs(t.phishScore) / maxAbs) * 100)
              return (
                <div key={t.token} className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-primary)] w-24 truncate" style={{ fontFamily: 'var(--mono)' }}>{t.token}</span>
                  <div className="flex-1 h-4 bg-[var(--bg-input)] rounded overflow-hidden">
                    <div className="h-full bg-[var(--signal)]/70 bar-fill" style={{ width: `${width}%` }}></div>
                  </div>
                  {t.count > 1 && <span className="text-[10px] text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--mono)' }}>\u00d7{t.count}</span>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {!compact && (
        <div className="mt-4 pt-4 border-t border-[var(--border-primary)] text-xs text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--mono)' }}>
          Analyzed {exp.token_count} tokens · Model trained on {exp.model_phish_docs} phishing + {exp.model_ham_docs} legitimate examples
        </div>
      )}
    </div>
  )
}
