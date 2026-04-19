import { AlertTriangle, AlertOctagon, ShieldAlert, ShieldCheck } from 'lucide-react'

type Level = 'low' | 'medium' | 'high' | 'critical'

const config: Record<Level, { bg: string; text: string; icon: typeof ShieldCheck }> = {
  low:      { bg: 'bg-[var(--signal)]/10 border-[var(--signal-deep)]/30', text: 'text-[var(--signal)]', icon: ShieldCheck },
  medium:   { bg: 'bg-[var(--amber)]/10 border-[var(--amber)]/30', text: 'text-[var(--amber)]', icon: AlertTriangle },
  high:     { bg: 'bg-[var(--rust)]/10 border-[var(--rust)]/30', text: 'text-[var(--rust)]', icon: ShieldAlert },
  critical: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', icon: AlertOctagon },
}

export default function RiskBadge({ level, score }: { level: Level; score?: number }) {
  const c = config[level]
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold uppercase tracking-wide border ${c.bg} ${c.text}`}>
      <Icon size={12} />
      {level}{score !== undefined ? ` \u2014 ${score}` : ''}
    </span>
  )
}
