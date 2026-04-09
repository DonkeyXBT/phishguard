import { Clock, CheckCircle, Trash2, Flag, ArrowUpRight } from 'lucide-react'

const config: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  pending:        { bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-400', icon: Clock },
  released:       { bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800', text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle },
  deleted:        { bg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700', text: 'text-slate-600 dark:text-slate-400', icon: Trash2 },
  false_positive: { bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800', text: 'text-violet-700 dark:text-violet-400', icon: Flag },
  escalated:      { bg: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400', icon: ArrowUpRight },
}
const labels: Record<string, string> = {
  pending: 'Pending Review', released: 'Released', deleted: 'Deleted',
  false_positive: 'False Positive', escalated: 'Escalated',
}

export default function StatusBadge({ status }: { status: string }) {
  const c = config[status] ?? config.pending
  const Icon = c.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${c.bg} ${c.text}`}>
      <Icon size={12} />
      {labels[status] ?? status}
    </span>
  )
}
