import { Clock, CheckCircle, Trash2, Flag, ArrowUpRight } from 'lucide-react'

const config: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  pending:        { bg: 'bg-[var(--signal)]/10 border-[var(--signal)]/30', text: 'text-[var(--signal)]', icon: Clock },
  released:       { bg: 'bg-[var(--signal-deep)]/15 border-[var(--signal-deep)]/30', text: 'text-[var(--signal)]', icon: CheckCircle },
  deleted:        { bg: 'bg-[var(--mute)]/10 border-[var(--mute)]/30', text: 'text-[var(--mute)]', icon: Trash2 },
  false_positive: { bg: 'bg-violet-500/10 border-violet-500/30', text: 'text-violet-400', icon: Flag },
  escalated:      { bg: 'bg-[var(--rust)]/10 border-[var(--rust)]/30', text: 'text-[var(--rust)]', icon: ArrowUpRight },
}
const labels: Record<string, string> = {
  pending: 'Pending', released: 'Released', deleted: 'Deleted',
  false_positive: 'False Positive', escalated: 'Escalated',
}

export default function StatusBadge({ status }: { status: string }) {
  const c = config[status] ?? config.pending
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold border ${c.bg} ${c.text}`}>
      <Icon size={12} />
      {labels[status] ?? status}
    </span>
  )
}
