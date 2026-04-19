'use client'

import { Info, AlertTriangle, ShieldAlert, AlertOctagon, ShieldCheck } from 'lucide-react'

interface Signal {
  code: string; label: string; detail: string; score: number; severity: string
}

const severityConfig: Record<string, { border: string; bg: string; text: string; icon: typeof Info }> = {
  info:     { border: 'border-[var(--signal)]/20', bg: 'bg-[var(--signal)]/5', text: 'text-[var(--signal)]', icon: Info },
  warning:  { border: 'border-[var(--amber)]/20', bg: 'bg-[var(--amber)]/5', text: 'text-[var(--amber)]', icon: AlertTriangle },
  danger:   { border: 'border-[var(--rust)]/20', bg: 'bg-[var(--rust)]/5', text: 'text-[var(--rust)]', icon: ShieldAlert },
  critical: { border: 'border-red-500/20', bg: 'bg-red-500/5', text: 'text-red-400', icon: AlertOctagon },
}

export default function SignalsList({ signals }: { signals: Signal[] }) {
  if (!signals?.length) {
    return (
      <div className="text-center py-8 text-[var(--text-tertiary)]">
        <ShieldCheck size={32} className="mx-auto mb-2 text-[var(--signal)]" />
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
          <div key={i} className={`rounded border p-3 ${c.border} ${c.bg}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2">
                <Icon size={16} className={`mt-0.5 ${c.text}`} />
                <div>
                  <div className={`font-medium text-sm ${c.text}`}>{s.label}</div>
                  <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{s.detail}</div>
                </div>
              </div>
              <div className={`shrink-0 text-xs font-bold ${c.text}`} style={{ fontFamily: 'var(--mono)' }}>+{s.score}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
