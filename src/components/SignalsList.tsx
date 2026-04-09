'use client'

import { Info, AlertTriangle, ShieldAlert, AlertOctagon, ShieldCheck } from 'lucide-react'

interface Signal {
  code: string; label: string; detail: string; score: number; severity: string
}

const severityConfig: Record<string, { border: string; bg: string; text: string; icon: typeof Info }> = {
  info:     { border: 'border-blue-200 dark:border-blue-800', bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-400', icon: Info },
  warning:  { border: 'border-amber-200 dark:border-amber-800', bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-400', icon: AlertTriangle },
  danger:   { border: 'border-orange-200 dark:border-orange-800', bg: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-700 dark:text-orange-400', icon: ShieldAlert },
  critical: { border: 'border-red-200 dark:border-red-800', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-400', icon: AlertOctagon },
}

export default function SignalsList({ signals }: { signals: Signal[] }) {
  if (!signals?.length) {
    return (
      <div className="text-center py-8 text-[var(--text-tertiary)]">
        <ShieldCheck size={32} className="mx-auto mb-2 text-emerald-500" />
        <div>No suspicious signals detected</div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {[...signals].sort((a, b) => b.score - a.score).map((s, i) => {
        const c = severityConfig[s.severity] ?? severityConfig.info
        const Icon = c.icon
        return (
          <div key={i} className={`rounded-lg border p-3 ${c.border} ${c.bg}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Icon size={16} className={`mt-0.5 ${c.text}`} />
                <div>
                  <div className={`font-medium text-sm ${c.text}`}>{s.label}</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{s.detail}</div>
                </div>
              </div>
              <div className={`shrink-0 text-xs font-bold ${c.text}`}>+{s.score}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
