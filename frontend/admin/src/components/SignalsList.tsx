import { Signal } from '../types'

const severityColors: Record<string, string> = {
  info: 'border-blue-800 bg-blue-950/30',
  warning: 'border-yellow-800 bg-yellow-950/30',
  danger: 'border-orange-800 bg-orange-950/30',
  critical: 'border-red-800 bg-red-950/30',
}

const severityText: Record<string, string> = {
  info: 'text-blue-400',
  warning: 'text-yellow-400',
  danger: 'text-orange-400',
  critical: 'text-red-400',
}

const severityIcon: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  danger: '🔶',
  critical: '🚨',
}

export default function SignalsList({ signals }: { signals: Signal[] }) {
  if (!signals || signals.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-3xl mb-2">✅</div>
        <div>No suspicious signals detected</div>
      </div>
    )
  }

  const sorted = [...signals].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-2">
      {sorted.map((signal, i) => (
        <div key={i} className={`rounded-lg border p-3 ${severityColors[signal.severity] || severityColors.info}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <span>{severityIcon[signal.severity]}</span>
              <div>
                <div className={`font-medium text-sm ${severityText[signal.severity]}`}>{signal.label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{signal.detail}</div>
              </div>
            </div>
            <div className={`shrink-0 text-xs font-bold ${severityText[signal.severity]}`}>+{signal.score}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
