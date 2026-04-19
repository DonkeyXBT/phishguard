'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface LogEntry {
  id: string
  userId: string | null
  userEmail: string | null
  action: string
  resource: string | null
  detail: string | null
  ip: string | null
  createdAt: string
}

export default function AuditPage() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const limit = 30

  const load = async (p: number) => {
    const res = await api.getAuditLogs({ limit: String(limit), offset: String(p * limit) })
    if (!res.ok) return
    const data = await res.json()
    setLogs(data.logs ?? [])
    setTotal(data.total ?? 0)
  }

  useEffect(() => { load(page) }, [page])

  return (
    <div className="p-8 page-enter">
      <div className="mb-6">
        <p className="kicker text-xs uppercase tracking-widest text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>Admin</p>
        <h1 className="text-2xl font-bold text-[var(--text-heading)]">Audit <em className="not-italic text-[var(--signal)]" style={{ fontFamily: 'var(--serif)' }}>trail</em></h1>
        <p className="text-[var(--text-tertiary)] text-sm mt-1">Track all administrative actions</p>
      </div>
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--bg-active)] border-b border-[var(--border-primary)]">
              <th className="text-left px-4 py-3 text-[var(--text-tertiary)] font-medium text-xs uppercase tracking-widest" style={{ fontFamily: 'var(--mono)' }}>Time</th>
              <th className="text-left px-4 py-3 text-[var(--text-tertiary)] font-medium text-xs uppercase tracking-widest" style={{ fontFamily: 'var(--mono)' }}>User</th>
              <th className="text-left px-4 py-3 text-[var(--text-tertiary)] font-medium text-xs uppercase tracking-widest" style={{ fontFamily: 'var(--mono)' }}>Action</th>
              <th className="text-left px-4 py-3 text-[var(--text-tertiary)] font-medium text-xs uppercase tracking-widest" style={{ fontFamily: 'var(--mono)' }}>Resource</th>
              <th className="text-left px-4 py-3 text-[var(--text-tertiary)] font-medium text-xs uppercase tracking-widest" style={{ fontFamily: 'var(--mono)' }}>Detail</th>
              <th className="text-left px-4 py-3 text-[var(--text-tertiary)] font-medium text-xs uppercase tracking-widest" style={{ fontFamily: 'var(--mono)' }}>IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-secondary)]">
            {logs.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--text-tertiary)]">No audit logs yet</td></tr>
            )}
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-[var(--bg-hover)] row-hover">
                <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs whitespace-nowrap" style={{ fontFamily: 'var(--mono)' }}>{new Date(l.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2.5 text-[var(--text-primary)] text-xs">{l.userEmail ?? '-'}</td>
                <td className="px-4 py-2.5">
                  <span className="bg-[var(--signal)]/10 text-[var(--signal)] border border-[var(--signal-deep)] text-xs px-2 py-0.5 rounded" style={{ fontFamily: 'var(--mono)' }}>{l.action}</span>
                </td>
                <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs" style={{ fontFamily: 'var(--mono)' }}>{l.resource ?? '-'}</td>
                <td className="px-4 py-2.5 text-[var(--text-secondary)] text-xs max-w-xs truncate">{l.detail ?? '-'}</td>
                <td className="px-4 py-2.5 text-[var(--text-tertiary)] text-xs" style={{ fontFamily: 'var(--mono)' }}>{l.ip ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {total > limit && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm text-[var(--text-tertiary)]" style={{ fontFamily: 'var(--mono)' }}>{total} entries</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              className="btn-press px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm rounded-lg disabled:opacity-30 hover:bg-[var(--bg-hover)] flex items-center gap-1">
              <ChevronLeft size={14} /> Prev
            </button>
            <button disabled={(page + 1) * limit >= total} onClick={() => setPage(p => p + 1)}
              className="btn-press px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-primary)] text-[var(--text-primary)] text-sm rounded-lg disabled:opacity-30 hover:bg-[var(--bg-hover)] flex items-center gap-1">
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
