'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { BarChart3, AlertOctagon, ShieldAlert, ShieldCheck } from 'lucide-react'

interface Analytics {
  period_days: number
  reports_per_day: Array<{ day: string; count: number }>
  by_level: Record<string, number>
  by_source: Record<string, number>
  top_sender_domains: Array<{ domain: string; count: number }>
  top_signals: Array<{ code: string; count: number }>
  avg_score_per_day: Array<{ day: string; avg_score: number }>
  recent_critical: Array<{ id: string; subject: string | null; sender: string | null; riskScore: number; reportedAt: string; status: string }>
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--text-secondary)] w-8 text-right">{value}</span>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    api.get(`/api/admin/analytics?days=${days}`).then(r => r.json()).then(setData)
  }, [days])

  if (!data) return <div className="p-8 text-[var(--text-tertiary)]">Loading analytics...</div>

  const totalReports = data.reports_per_day.reduce((s, r) => s + r.count, 0)
  const maxDaily = Math.max(...data.reports_per_day.map(r => r.count), 1)
  const maxSignal = Math.max(...data.top_signals.map(s => s.count), 1)
  const maxDomain = Math.max(...data.top_sender_domains.map(d => d.count), 1)

  const summaryCards = [
    { label: 'Total Reports', value: totalReports, icon: BarChart3, color: 'blue', accent: 'border-l-blue-500' },
    { label: 'Critical', value: data.by_level.critical ?? 0, icon: AlertOctagon, color: 'red', accent: 'border-l-red-500' },
    { label: 'High', value: data.by_level.high ?? 0, icon: ShieldAlert, color: 'orange', accent: 'border-l-orange-500' },
    { label: 'Low', value: data.by_level.low ?? 0, icon: ShieldCheck, color: 'emerald', accent: 'border-l-emerald-500' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Analytics</h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">Phishing trends and attack patterns</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6 stagger-in">
        {summaryCards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className={`bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] border-l-[3px] ${c.accent} p-5 shadow-[var(--shadow-sm)]`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-secondary)]">{c.label}</span>
                <Icon size={16} className="text-[var(--text-tertiary)]" />
              </div>
              <div className="text-3xl font-bold text-[var(--text-primary)]">{c.value}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Reports per day */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Reports Per Day</h2>
          <div className="flex items-end gap-px h-40">
            {data.reports_per_day.slice(-days).map((r, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end" title={`${r.day.split('T')[0]}: ${r.count}`}>
                <div className="bg-blue-500 dark:bg-blue-400 rounded-t min-h-[2px] transition-all hover:opacity-80"
                  style={{ height: `${(r.count / maxDaily) * 100}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-2">
            <span>{data.reports_per_day[0]?.day.split(' ')[0] ?? ''}</span>
            <span>{data.reports_per_day[data.reports_per_day.length - 1]?.day.split(' ')[0] ?? ''}</span>
          </div>
        </div>

        {/* Avg score per day */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Average Risk Score</h2>
          <div className="flex items-end gap-px h-40">
            {data.avg_score_per_day.slice(-days).map((r, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end" title={`${r.day.split('T')[0]}: ${r.avg_score}`}>
                <div className={`rounded-t min-h-[2px] transition-all hover:opacity-80 ${r.avg_score >= 60 ? 'bg-red-500' : r.avg_score >= 30 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ height: `${r.avg_score}%` }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-2">
            <span>0</span>
            <span>100</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Top signals */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Top Attack Signals</h2>
          <div className="space-y-2">
            {data.top_signals.slice(0, 10).map(s => (
              <div key={s.code} className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-secondary)] w-48 truncate font-mono">{s.code}</span>
                <MiniBar value={s.count} max={maxSignal} color="bg-red-500 dark:bg-red-400" />
              </div>
            ))}
            {data.top_signals.length === 0 && <div className="text-sm text-[var(--text-tertiary)]">No data yet</div>}
          </div>
        </div>

        {/* Top sender domains */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Top Sender Domains</h2>
          <div className="space-y-2">
            {data.top_sender_domains.slice(0, 10).map(d => (
              <div key={d.domain} className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-secondary)] w-48 truncate font-mono">{d.domain}</span>
                <MiniBar value={d.count} max={maxDomain} color="bg-orange-500 dark:bg-orange-400" />
              </div>
            ))}
            {data.top_sender_domains.length === 0 && <div className="text-sm text-[var(--text-tertiary)]">No data yet</div>}
          </div>
        </div>
      </div>

      {/* Report sources + Recent critical */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Report Sources</h2>
          {Object.entries(data.by_source).map(([src, count]) => (
            <div key={src} className="flex items-center justify-between py-1.5 text-sm">
              <span className="text-[var(--text-secondary)]">{src}</span>
              <span className="text-[var(--text-primary)] font-semibold">{count}</span>
            </div>
          ))}
          {Object.keys(data.by_source).length === 0 && <div className="text-sm text-[var(--text-tertiary)]">No data yet</div>}
        </div>

        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 shadow-[var(--shadow-sm)]">
          <h2 className="font-semibold text-[var(--text-primary)] mb-4">Recent Critical Reports</h2>
          <div className="space-y-2">
            {data.recent_critical.map(r => (
              <div key={r.id} className="flex items-center justify-between text-sm border-b border-[var(--border-secondary)] pb-2">
                <div className="min-w-0">
                  <div className="text-[var(--text-primary)] truncate text-xs">{r.subject ?? '(no subject)'}</div>
                  <div className="text-[var(--text-tertiary)] text-xs">{r.sender ?? 'unknown'}</div>
                </div>
                <span className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 text-xs px-2 py-0.5 rounded shrink-0 ml-2 font-medium">{r.riskScore}</span>
              </div>
            ))}
            {data.recent_critical.length === 0 && <div className="text-sm text-[var(--text-tertiary)]">No critical reports</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
