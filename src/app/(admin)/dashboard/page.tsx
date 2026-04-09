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

const accentColors: Record<string, string> = {
  blue: 'border-l-blue-500',
  amber: 'border-l-amber-500',
  emerald: 'border-l-emerald-500',
  slate: 'border-l-slate-400',
  red: 'border-l-red-500',
  violet: 'border-l-violet-500',
}

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recent, setRecent] = useState<ReportSummary[]>([])

  useEffect(() => {
    api.getStats().then(r => r.json()).then(setStats)
    api.getQueue({ limit: '5' }).then(r => r.json()).then(setRecent)
  }, [])

  const statCards = stats ? [
    { label: 'Total Reports',   value: stats.total_reports,  icon: Mail,         color: 'blue',    trend: null },
    { label: 'Pending Review',  value: stats.pending_review,  icon: Clock,        color: 'amber',   trend: null },
    { label: 'Released Today',  value: stats.released_today,  icon: CheckCircle,  color: 'emerald', trend: null },
    { label: 'Deleted Today',   value: stats.deleted_today,   icon: Trash2,       color: 'slate',   trend: null },
    { label: 'High Risk Total', value: stats.high_risk_count, icon: AlertOctagon, color: 'red',     trend: null },
    { label: 'Avg Risk Score',  value: stats.avg_risk_score,  icon: BarChart3,    color: 'violet',  trend: null },
  ] : []

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-[var(--text-tertiary)] text-sm mt-1">Overview of phishing activity</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8 stagger-in">
        {statCards.map(card => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] border-l-[3px] ${accentColors[card.color]} p-5 shadow-[var(--shadow-sm)]`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-[var(--text-secondary)]">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${card.color === 'slate' ? 'slate' : card.color}-50 dark:bg-${card.color === 'slate' ? 'slate' : card.color}-950/40`}>
                  <Icon size={16} className={`text-${card.color === 'slate' ? 'slate-500' : card.color + '-600'} dark:text-${card.color === 'slate' ? 'slate-400' : card.color + '-400'}`} />
                </div>
              </div>
              <div className="text-3xl font-bold text-[var(--text-primary)]">{card.value}</div>
            </div>
          )
        })}
      </div>

      {/* Risk Distribution */}
      {stats?.by_level && (
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 mb-8 shadow-[var(--shadow-sm)]">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Risk Level Distribution</h2>
          <div className="flex gap-4">
            {(['critical','high','medium','low'] as const).map(level => {
              const count = stats.by_level[level] ?? 0
              const pct = stats.total_reports > 0 ? Math.round((count / stats.total_reports) * 100) : 0
              const barColor = level === 'critical' ? 'bg-red-500' : level === 'high' ? 'bg-orange-500' : level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
              return (
                <div key={level} className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize text-[var(--text-secondary)]">{level}</span>
                    <span className="text-[var(--text-primary)] font-medium">{count}</span>
                  </div>
                  <div className="h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColor} bar-fill`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-1">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Reports */}
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] shadow-[var(--shadow-sm)]">
        <div className="p-5 border-b border-[var(--border-secondary)] flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">Recent Reports</h2>
          <button onClick={() => router.push('/queue')} className="btn-press text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1">
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
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5">by {r.reporterEmail} · {timeAgo(r.reportedAt)}</div>
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
