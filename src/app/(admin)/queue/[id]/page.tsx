'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import RiskBadge from '@/components/RiskBadge'
import StatusBadge from '@/components/StatusBadge'
import SignalsList from '@/components/SignalsList'
import { parseHeaders, authLabel, authColor } from '@/lib/headers'
import { ArrowLeft, CheckCircle, Trash2, Flag, ArrowUpRight, AlertTriangle, Link as LinkIcon, Paperclip, FileCode, History, ShieldCheck, ShieldBan } from 'lucide-react'

interface Link { id: string; displayText: string | null; url: string | null; domain: string | null; isSuspicious: boolean; riskReason: string | null }
interface Attachment { id: string; filename: string | null; contentType: string | null; isSuspicious: boolean; riskReason: string | null }
interface Action { id: string; action: string; notes: string | null; createdAt: string }
interface Report {
  id: string; reporterEmail: string; subject: string | null; sender: string | null
  senderDomain: string | null; replyTo: string | null; recipientEmail: string | null
  bodyText: string | null; bodyHtml: string | null; riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'; signals: any[]
  headers: Record<string, unknown>
  status: string; source: string; reportedAt: string; reviewedAt: string | null
  adminNotes: string | null; links: Link[]; attachments: Attachment[]; actions: Action[]
}

type Tab = 'overview' | 'body' | 'links' | 'attachments' | 'headers' | 'history'

function fmt(d: string) {
  return new Date(d).toLocaleString()
}

const tabConfig: { key: Tab; label: string; icon: typeof AlertTriangle }[] = [
  { key: 'overview', label: 'Overview', icon: AlertTriangle },
  { key: 'body', label: 'Body', icon: FileCode },
  { key: 'links', label: 'Links', icon: LinkIcon },
  { key: 'attachments', label: 'Attachments', icon: Paperclip },
  { key: 'headers', label: 'Headers', icon: FileCode },
  { key: 'history', label: 'History', icon: History },
]

export default function EmailDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)
  const [domainMsg, setDomainMsg] = useState('')

  const load = async () => {
    const res = await api.getReport(id)
    const data = await res.json()
    setReport(data)
    setNotes(data.adminNotes ?? '')
  }

  useEffect(() => { load() }, [id])

  const doAction = async (action: string) => {
    setActing(true)
    await api.reviewReport(id, action, notes || undefined)
    await load()
    setActing(false)
  }

  if (!report) return <div className="p-8 text-center text-[var(--text-tertiary)]">Loading...</div>

  const rawHeaders = (report.headers as any)?.raw as string | undefined
  const headerAnalysis = rawHeaders ? parseHeaders(rawHeaders) : null

  return (
    <div className="p-8 max-w-5xl">
      <button onClick={() => router.push('/queue')} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-4 flex items-center gap-1 transition-colors">
        <ArrowLeft size={14} /> Back to Queue
      </button>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{report.subject ?? '(no subject)'}</h1>
          <div className="text-[var(--text-secondary)] text-sm mt-1">
            Reported by <strong className="text-[var(--text-primary)]">{report.reporterEmail}</strong> · {fmt(report.reportedAt)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <RiskBadge level={report.riskLevel} score={report.riskScore} />
          <StatusBadge status={report.status} />
        </div>
      </div>

      {/* Risk Score Bar */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 mb-5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-[var(--text-secondary)] font-medium">Risk Score</span>
          <span className="text-2xl font-bold text-[var(--text-primary)]">{report.riskScore}<span className="text-[var(--text-tertiary)] text-base">/100</span></span>
        </div>
        <div className="h-3 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
          <div className={`h-full rounded-full score-bar ${report.riskScore >= 75 ? 'bg-red-500' : report.riskScore >= 50 ? 'bg-orange-500' : report.riskScore >= 25 ? 'bg-amber-500' : 'bg-emerald-500'}`}
            style={{ width: `${report.riskScore}%` }} />
        </div>
        <div className="text-xs text-[var(--text-tertiary)] mt-2">{report.signals.length} signal(s)</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg p-1 w-fit shadow-[var(--shadow-sm)]">
        {tabConfig.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`filter-pill px-4 py-1.5 rounded-md text-xs font-medium ${
              tab === t.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}>
            {t.key === 'links' ? `Links (${report.links.length})` : t.key === 'attachments' ? `Attachments (${report.attachments.length})` : t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Email Details</h3>
            <dl className="space-y-3 text-sm">
              {[['From', report.sender], ['Reply-To', report.replyTo], ['Domain', report.senderDomain], ['To', report.recipientEmail], ['Subject', report.subject]].map(([l, v]) => v && (
                <div key={l} className="flex gap-4">
                  <dt className="text-[var(--text-tertiary)] w-24 shrink-0">{l}</dt>
                  <dd className="text-[var(--text-primary)] font-mono text-xs bg-[var(--bg-tertiary)] px-2 py-1 rounded break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
            <h3 className="font-semibold text-[var(--text-primary)] mb-4">Detected Signals</h3>
            <SignalsList signals={report.signals} />
          </div>
        </div>
      )}

      {tab === 'body' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
          {report.bodyText
            ? <pre className="text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-mono bg-[var(--bg-tertiary)] rounded-lg p-4 max-h-96 overflow-auto">{report.bodyText}</pre>
            : <div className="text-[var(--text-tertiary)] text-sm">No plain text body</div>}
          {report.bodyHtml && (
            <div className="mt-4">
              <div className="text-xs text-[var(--text-tertiary)] mb-2 font-semibold uppercase tracking-wide">HTML Preview (sanitized)</div>
              <div className="bg-white rounded-lg p-4 max-h-96 overflow-auto text-gray-900 text-sm border border-[var(--border-primary)]"
                dangerouslySetInnerHTML={{ __html: report.bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+="[^"]*"/gi, '') }} />
            </div>
          )}
        </div>
      )}

      {tab === 'links' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 space-y-3 shadow-[var(--shadow-sm)]">
          {report.links.length === 0 ? <div className="text-[var(--text-tertiary)] text-sm">No links found</div> : report.links.map(l => (
            <div key={l.id} className={`rounded-lg border p-3 text-sm ${l.isSuspicious ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20' : 'border-[var(--border-primary)] bg-[var(--bg-secondary)]'}`}>
              {l.displayText && <div className="text-[var(--text-secondary)] mb-1">Display: <span className="font-mono text-xs">{l.displayText}</span></div>}
              <div className="text-[var(--text-secondary)] break-all font-mono text-xs">{l.url}</div>
              {l.domain && <div className="text-[var(--text-tertiary)] text-xs mt-1">Domain: {l.domain}</div>}
              {l.isSuspicious && <div className="text-red-700 dark:text-red-400 text-xs mt-1 font-semibold flex items-center gap-1"><AlertTriangle size={12} /> {l.riskReason}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'attachments' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 space-y-3 shadow-[var(--shadow-sm)]">
          {report.attachments.length === 0 ? <div className="text-[var(--text-tertiary)] text-sm">No attachments</div> : report.attachments.map(a => (
            <div key={a.id} className={`rounded-lg border p-3 text-sm ${a.isSuspicious ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20' : 'border-[var(--border-primary)] bg-[var(--bg-secondary)]'}`}>
              <div className="font-medium text-[var(--text-primary)]">{a.filename ?? 'unnamed'}</div>
              <div className="text-[var(--text-tertiary)] text-xs mt-1">{a.contentType}</div>
              {a.isSuspicious && <div className="text-red-700 dark:text-red-400 text-xs mt-1 font-semibold flex items-center gap-1"><AlertTriangle size={12} /> {a.riskReason}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'headers' && (
        <div className="space-y-5">
          {!headerAnalysis ? (
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-8 text-center text-[var(--text-tertiary)] text-sm shadow-[var(--shadow-sm)]">
              No header data available. Headers are captured by the Outlook Add-in only.
            </div>
          ) : (
            <>
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4">Email Authentication</h3>
                <div className="grid grid-cols-3 gap-4">
                  {([
                    { label: 'SPF',   result: headerAnalysis.spf,   details: headerAnalysis.spfDetails },
                    { label: 'DKIM',  result: headerAnalysis.dkim,  details: headerAnalysis.dkimDetails },
                    { label: 'DMARC', result: headerAnalysis.dmarc, details: headerAnalysis.dmarcDetails },
                  ] as const).map(({ label, result, details }) => (
                    <div key={label} className={`rounded-lg border p-4 ${
                      result === 'pass' ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30'
                      : result === 'fail' || result === 'softfail' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
                      : 'border-[var(--border-primary)] bg-[var(--bg-secondary)]'
                    }`}>
                      <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-widest mb-1 font-semibold">{label}</div>
                      <div className={`text-base font-bold ${authColor(result)}`}>{authLabel(result)}</div>
                      {details && <div className="text-xs text-[var(--text-tertiary)] mt-1.5 font-mono break-all">{details}</div>}
                    </div>
                  ))}
                </div>
              </div>

              {headerAnalysis.receivedHops.length > 0 && (
                <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
                  <h3 className="font-semibold text-[var(--text-primary)] mb-4">Received Hops ({headerAnalysis.receivedHops.length})</h3>
                  <div className="space-y-2">
                    {headerAnalysis.receivedHops.map((hop, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="text-[var(--text-tertiary)] text-xs w-5 text-right shrink-0">{i + 1}</span>
                        <span className="text-[var(--text-secondary)] font-mono text-xs bg-[var(--bg-tertiary)] px-2 py-1 rounded">{hop}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
                <h3 className="font-semibold text-[var(--text-primary)] mb-3">Raw Headers</h3>
                <pre className="text-xs text-[var(--text-secondary)] font-mono bg-[var(--bg-tertiary)] rounded-lg p-4 max-h-72 overflow-auto whitespace-pre-wrap break-all">
                  {headerAnalysis.raw}
                </pre>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 space-y-3 shadow-[var(--shadow-sm)]">
          {report.actions.length === 0 ? <div className="text-[var(--text-tertiary)] text-sm">No actions yet</div> : report.actions.map(a => (
            <div key={a.id} className="flex gap-3 text-sm">
              <div className="text-[var(--text-tertiary)] whitespace-nowrap text-xs mt-0.5">{fmt(a.createdAt)}</div>
              <div>
                <span className="text-[var(--text-primary)] font-medium capitalize">{a.action}</span>
                {a.notes && <div className="text-[var(--text-secondary)] text-xs mt-0.5">{a.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Action */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 mt-5 shadow-[var(--shadow-sm)]">
        <h3 className="font-semibold text-[var(--text-primary)] mb-4">Admin Action</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
            placeholder="Add notes about this decision..." />
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => doAction('released')} disabled={acting}
            className="btn-press flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 flex items-center justify-center gap-1.5">
            <CheckCircle size={14} /> Release to User
          </button>
          <button onClick={() => doAction('deleted')} disabled={acting}
            className="btn-press flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 flex items-center justify-center gap-1.5">
            <Trash2 size={14} /> Delete (Phishing)
          </button>
          <button onClick={() => doAction('false_positive')} disabled={acting}
            className="btn-press bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] border border-[var(--border-primary)] disabled:opacity-50 text-[var(--text-primary)] text-sm font-semibold rounded-lg py-2.5 px-4 flex items-center gap-1.5">
            <Flag size={14} /> False Positive
          </button>
          <button onClick={() => doAction('escalated')} disabled={acting}
            className="btn-press bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 flex items-center gap-1.5">
            <ArrowUpRight size={14} /> Escalate
          </button>
        </div>
      </div>

      {/* Quick Domain Actions */}
      {report.senderDomain && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 mt-5 shadow-[var(--shadow-sm)]">
          <h3 className="font-semibold text-[var(--text-primary)] mb-2">Domain Actions</h3>
          <p className="text-xs text-[var(--text-tertiary)] mb-3">Quickly add <code className="font-mono bg-[var(--bg-tertiary)] px-1 py-0.5 rounded">{report.senderDomain}</code> to your domain lists.</p>
          {domainMsg && <div className="text-xs text-emerald-700 dark:text-emerald-400 mb-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2">{domainMsg}</div>}
          <div className="flex gap-3">
            <button onClick={async () => {
              const res = await api.addDomain(report.senderDomain!, 'blacklist', `Blacklisted from report: ${report.subject}`)
              const data = await res.json()
              setDomainMsg(res.ok ? `${report.senderDomain} added to blacklist` : (data.error || 'Failed'))
            }} className="btn-press flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg py-2 px-4">
              <ShieldBan size={14} /> Blacklist Domain
            </button>
            <button onClick={async () => {
              const res = await api.addDomain(report.senderDomain!, 'whitelist', `Whitelisted from report: ${report.subject}`)
              const data = await res.json()
              setDomainMsg(res.ok ? `${report.senderDomain} added to whitelist` : (data.error || 'Failed'))
            }} className="btn-press flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg py-2 px-4">
              <ShieldCheck size={14} /> Whitelist Domain
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
