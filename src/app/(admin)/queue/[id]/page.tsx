'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import RiskBadge from '@/components/RiskBadge'
import StatusBadge from '@/components/StatusBadge'
import SignalsList from '@/components/SignalsList'

interface Link { id: string; displayText: string | null; url: string | null; domain: string | null; isSuspicious: boolean; riskReason: string | null }
interface Attachment { id: string; filename: string | null; contentType: string | null; isSuspicious: boolean; riskReason: string | null }
interface Action { id: string; action: string; notes: string | null; createdAt: string }
interface Report {
  id: string; reporterEmail: string; subject: string | null; sender: string | null
  senderDomain: string | null; replyTo: string | null; recipientEmail: string | null
  bodyText: string | null; bodyHtml: string | null; riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'; signals: any[]
  status: string; source: string; reportedAt: string; reviewedAt: string | null
  adminNotes: string | null; links: Link[]; attachments: Attachment[]; actions: Action[]
}

type Tab = 'overview' | 'body' | 'links' | 'attachments' | 'history'

function fmt(d: string) {
  return new Date(d).toLocaleString()
}

export default function EmailDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [report, setReport] = useState<Report | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)

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

  if (!report) return <div className="p-8 text-center text-gray-500">Loading...</div>

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'body', label: 'Body' },
    { key: 'links', label: `Links (${report.links.length})` },
    { key: 'attachments', label: `Attachments (${report.attachments.length})` },
    { key: 'history', label: 'History' },
  ]

  return (
    <div className="p-8 max-w-5xl">
      <button onClick={() => router.push('/queue')} className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-1">← Back</button>

      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">{report.subject ?? '(no subject)'}</h1>
          <div className="text-gray-400 text-sm mt-1">
            Reported by <strong className="text-white">{report.reporterEmail}</strong> · {fmt(report.reportedAt)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <RiskBadge level={report.riskLevel} score={report.riskScore} />
          <StatusBadge status={report.status} />
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400 font-medium">Risk Score</span>
          <span className="text-2xl font-bold text-white">{report.riskScore}<span className="text-gray-500 text-base">/100</span></span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${report.riskScore >= 75 ? 'bg-red-500' : report.riskScore >= 50 ? 'bg-orange-500' : report.riskScore >= 25 ? 'bg-yellow-500' : 'bg-green-500'}`}
            style={{ width: `${report.riskScore}%` }} />
        </div>
        <div className="text-xs text-gray-400 mt-2">{report.signals.length} signal(s)</div>
      </div>

      <div className="flex gap-1 mb-5 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === t.key ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-5">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h3 className="font-semibold text-white mb-4">Email Details</h3>
            <dl className="space-y-3 text-sm">
              {[['From', report.sender], ['Reply-To', report.replyTo], ['Domain', report.senderDomain], ['To', report.recipientEmail], ['Subject', report.subject]].map(([l, v]) => v && (
                <div key={l} className="flex gap-4">
                  <dt className="text-gray-400 w-24 shrink-0">{l}</dt>
                  <dd className="text-white font-mono text-xs bg-gray-800 px-2 py-1 rounded break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h3 className="font-semibold text-white mb-4">Detected Signals</h3>
            <SignalsList signals={report.signals} />
          </div>
        </div>
      )}

      {tab === 'body' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          {report.bodyText
            ? <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-800 rounded-lg p-4 max-h-96 overflow-auto">{report.bodyText}</pre>
            : <div className="text-gray-500 text-sm">No plain text body</div>}
          {report.bodyHtml && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">HTML Preview (sanitized)</div>
              <div className="bg-white rounded-lg p-4 max-h-96 overflow-auto text-gray-900 text-sm"
                dangerouslySetInnerHTML={{ __html: report.bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/on\w+="[^"]*"/gi, '') }} />
            </div>
          )}
        </div>
      )}

      {tab === 'links' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
          {report.links.length === 0 ? <div className="text-gray-500 text-sm">No links found</div> : report.links.map(l => (
            <div key={l.id} className={`rounded-lg border p-3 text-sm ${l.isSuspicious ? 'border-red-800 bg-red-950/20' : 'border-gray-800 bg-gray-800/30'}`}>
              {l.displayText && <div className="text-gray-300 mb-1">Display: <span className="font-mono text-xs">{l.displayText}</span></div>}
              <div className="text-gray-400 break-all font-mono text-xs">{l.url}</div>
              {l.domain && <div className="text-gray-500 text-xs mt-1">Domain: {l.domain}</div>}
              {l.isSuspicious && <div className="text-red-400 text-xs mt-1 font-semibold">⚠ {l.riskReason}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'attachments' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
          {report.attachments.length === 0 ? <div className="text-gray-500 text-sm">No attachments</div> : report.attachments.map(a => (
            <div key={a.id} className={`rounded-lg border p-3 text-sm ${a.isSuspicious ? 'border-red-800 bg-red-950/20' : 'border-gray-800 bg-gray-800/30'}`}>
              <div className="font-medium text-white">{a.filename ?? 'unnamed'}</div>
              <div className="text-gray-400 text-xs mt-1">{a.contentType}</div>
              {a.isSuspicious && <div className="text-red-400 text-xs mt-1 font-semibold">⚠ {a.riskReason}</div>}
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 space-y-3">
          {report.actions.length === 0 ? <div className="text-gray-500 text-sm">No actions yet</div> : report.actions.map(a => (
            <div key={a.id} className="flex gap-3 text-sm">
              <div className="text-gray-500 whitespace-nowrap text-xs mt-0.5">{fmt(a.createdAt)}</div>
              <div>
                <span className="text-white font-medium capitalize">{a.action}</span>
                {a.notes && <div className="text-gray-400 text-xs mt-0.5">{a.notes}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mt-5">
        <h3 className="font-semibold text-white mb-4">Admin Action</h3>
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
            placeholder="Add notes about this decision..." />
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => doAction('released')} disabled={acting}
            className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 transition-colors">
            ✅ Release to User
          </button>
          <button onClick={() => doAction('deleted')} disabled={acting}
            className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 transition-colors">
            🗑️ Delete (Phishing)
          </button>
          <button onClick={() => doAction('false_positive')} disabled={acting}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 transition-colors">
            False Positive
          </button>
          <button onClick={() => doAction('escalated')} disabled={acting}
            className="bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 transition-colors">
            🔺 Escalate
          </button>
        </div>
      </div>
    </div>
  )
}
