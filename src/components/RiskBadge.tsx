import { AlertTriangle, AlertOctagon, ShieldAlert, ShieldCheck } from 'lucide-react'

type Level = 'low' | 'medium' | 'high' | 'critical'

const config: Record<Level, { bg: string; text: string; icon: typeof ShieldCheck }> = {
  low:      { bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', icon: ShieldCheck },
  medium:   { bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400', icon: AlertTriangle },
  high:     { bg: 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', icon: ShieldAlert },
  critical: { bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', icon: AlertOctagon },
}

export default function RiskBadge({ level, score }: { level: Level; score?: number }) {
  const c = config[level]
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${c.bg} ${c.text}`}>
      <Icon size={12} />
      {level}{score !== undefined ? ` \u2014 ${score}` : ''}
    </span>
  )
}
