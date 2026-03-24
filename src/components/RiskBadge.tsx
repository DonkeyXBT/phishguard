type Level = 'low' | 'medium' | 'high' | 'critical'

const styles: Record<Level, string> = {
  low:      'bg-green-900/50 text-green-400 border border-green-800',
  medium:   'bg-yellow-900/50 text-yellow-400 border border-yellow-800',
  high:     'bg-orange-900/50 text-orange-400 border border-orange-800',
  critical: 'bg-red-900/50 text-red-400 border border-red-800',
}
const icons: Record<Level, string> = { low: '✅', medium: '⚠️', high: '🔶', critical: '🚨' }

export default function RiskBadge({ level, score }: { level: Level; score?: number }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${styles[level]}`}>
      {icons[level]} {level}{score !== undefined ? ` — ${score}` : ''}
    </span>
  )
}
