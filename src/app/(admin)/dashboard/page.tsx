'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import RiskBadge from '@/components/RiskBadge'
import StatusBadge from '@/components/StatusBadge'

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
    api.getStats().then(r => r.json()).then(setStats)
    api.getQueue({ limit: '5' }).then(r => r.json()).then(setRecent)
  }, [])

  const statCards = stats ? [
    { label: 'Total Reports',   value: stats.total_reports,  icon: '📨', color: 'text-blue-400' },
    { label: 'Pending Review',  value: stats.pending_review,  icon: '⏳', color: 'text-yellow-400' },
    { label: 'Released Today',  value: stats.released_today,  icon: '✅', color: 'text-green-400' },
    { label: 'Deleted Today',   value: stats.deleted_today,   icon: '🗑️', color: 'text-gray-400' },
    { label: 'High Risk Total', value: stats.high_risk_count, icon: '🚨', color: 'text-red-400' },
    { label: 'Avg Risk Score',  value: stats.avg_risk_score,  icon: '📊', color: 'text-purple-400' },
  ] : []

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Overview of phishing activity</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        {statCards.map(card => (
          <div key={card.label} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400">{card.label}</span>
              <span className="text-xl">{card.icon}</span>
            </div>
            <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {stats?.by_level && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-8">
          <h2 className="font-semibold text-white mb-4">Risk Level Distribution</h2>
          <div className="flex gap-4">
            {(['critical','high','medium','low'] as const).map(level => {
              const count = stats.by_level[level] ?? 0
              const pct = stats.total_reports > 0 ? Math.round((count / stats.total_reports) * 100) : 0
              return (
                <div key={level} className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize text-gray-400">{level}</span>
                    <span className="text-white">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${level === 'critical' ? 'bg-red-500' : level === 'high' ? 'bg-orange-500' : level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-gray-900 rounded-xl border border-gray-800">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <h2 className="font-semibold text-white">Recent Reports</h2>
          <button onClick={() => router.push('/queue')} className="text-sm text-blue-400 hover:text-blue-300">View all →</button>
        </div>
        <div className="divide-y divide-gray-800">
          {recent.length === 0 && <div className="p-8 text-center text-gray-500">No reports yet</div>}
          {recent.map(r => (
            <div key={r.id} onClick={() => router.push(`/queue/${r.id}`)}
              className="p-4 hover:bg-gray-800/50 cursor-pointer transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-white truncate">{r.subject ?? '(no subject)'}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">From: {r.sender ?? 'unknown'}</div>
                  <div className="text-xs text-gray-500 mt-0.5">by {r.reporterEmail} · {timeAgo(r.reportedAt)}</div>
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
