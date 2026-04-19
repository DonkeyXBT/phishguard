'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import RiskBadge from '@/components/RiskBadge'
import StatusBadge from '@/components/StatusBadge'
import { Mail, Clock, CheckCircle, Trash2, AlertOctagon, BarChart3, ArrowRight } from 'lucide-react'

interface Stats {
  total_reports: number
  pending_review: number
  released_today: number
  deleted_today: number
  high_risk_count: number
  avg_risk_score: number
  by_level: Record<string, number>
  reports_per_day: Array<{ day: string; count: number }>
}

interface ReportSummary {
  id: string
  reporterEmail: string
  subject: string | null
  sender: string | null
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  status: string
  reportedAt: string
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<ReportSummary[]>([])

  useEffect(() => {
    api.getStats().then(r => { if (r.ok) return r.json(); return null }).then(d => { if (d) setStats(d) })
    api.getQueue({ limit: '5' }).then(r => { if (r.ok) return r.json(); return [] }).then(d => { if (Array.isArray(d)) setRecent(d) })
  }, [])

  const statCards = stats ? [
    { label: 'Total Reports',   value: stats.total_reports,  icon: Mail,         accent: 'var(--signal)' },
    { label: 'Pending Review',  value: stats.pending_review,  icon: Clock,        accent: 'var(--amber)' },
    { label: 'Released Today',  value: stats.released_today,  icon: CheckCircle,  accent: 'var(--signal-deep)' },
    { label: 'Deleted Today',   value: stats.deleted_today,   icon: Trash2,       accent: 'var(--mute)' },
    { label: 'High Risk Total', value: stats.high_risk_count, icon: AlertOctagon, accent: 'var(--rust)' },
    { label: 'Avg Risk Score',  value: stats.avg_risk_score,  icon: BarChart3,    accent: 'var(--fog)' },
  ] : []

  return (
    <div className="p-8">
      <div className="mb-8">
        <div className="kicker mb-2" style={{ fontFamily: 'var(--mono)' }}>[ Dashboard ]</div>
        <h1 className="text-2xl font-semibold text-[var(--text-heading)] tracking-tight">
          Phishing <em className="not-italic text-[var(--accent)]" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>activity</em>
        </h1>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 mb-8 stagger-in">
        {statCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className="bg-[var(--bg-card)] rounded border border-[var(--border-primary)] p-5" style={{ borderLeftWidth: '3px', borderLeftColor: card.accent }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">{card.label}</span>
                <Icon size={16} style={{ color: card.accent }} strokeWidth={1.5} />
              </div>
              <div className="text-3xl font-semibold text-[var(--text-heading)] tracking-tight">{card.value}</div>
            </div>
          )
        })}
      </div>

      {/* Risk Distribution */}
      {stats?.by_level && (
        <div className="bg-[var(--bg-card)] rounded border border-[var(--border-primary)] p-5 mb-8">
          <h2 className="font-semibold text-[var(--text-heading)] mb-4">Risk Level Distribution</h2>
          <div className="flex gap-4">
            {(['critical','high','medium','low'] as const).map(level => {
              const count = stats.by_level[level] ?? 0
              const pct = stats.total_reports > 0 ? Math.round((count / stats.total_reports) * 100) : 0
              const barColor = level === 'critical' ? 'bg-red-500' : level === 'high' ? 'bg-[var(--rust)]' : level === 'medium' ? 'bg-[var(--amber)]' : 'bg-[var(--signal)]'
              return (
                <div key={level} className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize text-[var(--text-secondary)]">{level}</span>
                    <span className="text-[var(--text-primary)] font-medium" style={{ fontFamily: 'var(--mono)' }}>{count}</span>
                  </div>
                  <div className="h-1.5 bg-[var(--border-primary)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} bar-fill`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-1" style={{ fontFamily: 'var(--mono)' }}>{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Reports */}
      <div className="bg-[var(--bg-card)] rounded border border-[var(--border-primary)]">
        <div className="p-5 border-b border-[var(--border-secondary)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-heading)]">Recent Reports</h2>
          <button onClick={() => router.push('/queue')} className="btn-press text-sm text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1">
            View all <ArrowRight size={14} />
          </button>
        </div>
        <div className="divide-y divide-[var(--border-secondary)]">
          {recent.length === 0 && <div className="p-8 text-center text-[var(--text-tertiary)]">No reports yet</div>}
          {recent.map(r => (
            <div key={r.id} onClick={() => router.push(`/queue/${r.id}`)}
              className="p-4 hover:bg-[var(--bg-hover)] cursor-pointer row-hover">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-[var(--text-primary)] truncate">{r.subject ?? '(no subject)'}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">From: {r.sender ?? 'unknown'}</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5" style={{ fontFamily: 'var(--mono)' }}>by {r.reporterEmail} · {timeAgo(r.reportedAt)}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <RiskBadge level={r.riskLevel} score={r.riskScore} />
                  <StatusBadge status={r.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
