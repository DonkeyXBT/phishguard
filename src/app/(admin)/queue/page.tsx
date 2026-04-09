'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import RiskBadge from '@/components/RiskBadge'
import StatusBadge from '@/components/StatusBadge'
import { RefreshCw, Inbox } from 'lucide-react'

interface Report {
  id: string; reporterEmail: string; subject: string | null; sender: string | null
  riskScore: number; riskLevel: 'low' | 'medium' | 'high' | 'critical'
  status: string; reportedAt: string; source: string
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const STATUS_FILTERS = ['', 'pending', 'released', 'deleted', 'false_positive', 'escalated']
const RISK_FILTERS = ['', 'critical', 'high', 'medium', 'low']

export default function QueuePage() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [status, setStatus] = useState('pending')
  const [risk, setRisk] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    const params: Record<string, string> = { limit: '100' }
    if (status) params.status = status
    if (risk) params.risk_level = risk
    const res = await api.getQueue(params)
    if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setReports(data) }
    setLoading(false)
  }

  useEffect(() => { load() }, [status, risk])

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Review Queue</h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">{reports.length} reports</p>
        </div>
        <button onClick={load} className="btn-press text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1.5">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg p-1 shadow-[var(--shadow-sm)]">
          {STATUS_FILTERS.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={`filter-pill px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                status === s
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}>
              {s || 'All'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-lg p-1 shadow-[var(--shadow-sm)]">
          {RISK_FILTERS.map(r => (
            <button key={r} onClick={() => setRisk(r)}
              className={`filter-pill px-3 py-1.5 rounded-md text-xs font-medium capitalize ${
                risk === r
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}>
              {r || 'All Risk'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] overflow-hidden shadow-[var(--shadow-sm)]">
        {loading && <div className="p-8 text-center text-[var(--text-tertiary)]">Loading...</div>}
        {!loading && reports.length === 0 && (
          <div className="p-12 text-center text-[var(--text-tertiary)]">
            <Inbox size={36} className="mx-auto mb-3 opacity-40" />
            <div className="font-medium">No reports found</div>
          </div>
        )}
        {!loading && reports.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
                <th className="text-left px-4 py-3 text-[var(--text-tertiary)] text-xs uppercase tracking-wide font-medium">Subject / Sender</th>
                <th className="text-left px-4 py-3 text-[var(--text-tertiary)] text-xs uppercase tracking-wide font-medium">Reporter</th>
                <th className="text-left px-4 py-3 text-[var(--text-tertiary)] text-xs uppercase tracking-wide font-medium">Risk</th>
                <th className="text-left px-4 py-3 text-[var(--text-tertiary)] text-xs uppercase tracking-wide font-medium">Status</th>
                <th className="text-left px-4 py-3 text-[var(--text-tertiary)] text-xs uppercase tracking-wide font-medium">Reported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-secondary)]">
              {reports.map(r => (
                <tr key={r.id} onClick={() => router.push(`/queue/${r.id}`)}
                  className="hover:bg-[var(--bg-hover)] cursor-pointer row-hover">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)] truncate max-w-xs">{r.subject ?? '(no subject)'}</div>
                    <div className="text-[var(--text-tertiary)] truncate max-w-xs text-xs">{r.sender ?? 'unknown'}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)] text-xs">{r.reporterEmail}</td>
                  <td className="px-4 py-3"><RiskBadge level={r.riskLevel} score={r.riskScore} /></td>
                  <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                  <td className="px-4 py-3 text-[var(--text-tertiary)] whitespace-nowrap text-xs">{timeAgo(r.reportedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
