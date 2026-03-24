'use client'

interface Signal {
  code: string; label: string; detail: string; score: number; severity: string
}

const severityColors: Record<string, string> = {
  info:     'border-blue-800 bg-blue-950/30',
  warning:  'border-yellow-800 bg-yellow-950/30',
  danger:   'border-orange-800 bg-orange-950/30',
  critical: 'border-red-800 bg-red-950/30',
}
const severityText: Record<string, string> = {
  info: 'text-blue-400', warning: 'text-yellow-400', danger: 'text-orange-400', critical: 'text-red-400',
}
const severityIcon: Record<string, string> = {
  info: 'ℹ️', warning: '⚠️', danger: '🔶', critical: '🚨',
}

export default function SignalsList({ signals }: { signals: Signal[] }) {
  if (!signals?.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-3xl mb-2">✅</div>
        <div>No suspicious signals detected</div>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {[...signals].sort((a, b) => b.score - a.score).map((s, i) => (
        <div key={i} className={`rounded-lg border p-3 ${severityColors[s.severity] ?? severityColors.info}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span>{severityIcon[s.severity]}</span>
              <div>
                <div className={`font-medium text-sm ${severityText[s.severity]}`}>{s.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.detail}</div>
              </div>
            </div>
            <div className={`shrink-0 text-xs font-bold ${severityText[s.severity]}`}>+{s.score}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
