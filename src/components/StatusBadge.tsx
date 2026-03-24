const styles: Record<string, string> = {
  pending:        'bg-blue-900/50 text-blue-400 border border-blue-800',
  released:       'bg-green-900/50 text-green-400 border border-green-800',
  deleted:        'bg-gray-800 text-gray-400 border border-gray-700',
  false_positive: 'bg-purple-900/50 text-purple-400 border border-purple-800',
  escalated:      'bg-red-900/50 text-red-400 border border-red-800',
}
const labels: Record<string, string> = {
  pending: 'Pending Review', released: 'Released', deleted: 'Deleted',
  false_positive: 'False Positive', escalated: 'Escalated',
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status] ?? styles.pending}`}>
      {labels[status] ?? status}
    </span>
  )
}
