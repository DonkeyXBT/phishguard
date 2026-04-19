'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { ShieldCheck, ShieldBan, Plus, X, RefreshCw, Shield } from 'lucide-react'

interface DomainEntry {
  id: string
  domain: string
  listType: 'whitelist' | 'blacklist'
  source: string
  reason: string | null
  createdAt: string
}

function AddForm({ listType, onAdded }: { listType: 'whitelist' | 'blacklist'; onAdded: (entry: DomainEntry) => void }) {
  const [domain, setDomain] = useState('')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain.trim()) return
    setError('')
    setLoading(true)
    try {
      const res = await api.addDomain(domain.trim(), listType, reason.trim() || undefined)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onAdded(data)
      setDomain('')
      setReason('')
    } finally {
      setLoading(false)
    }
  }

  const isWhitelist = listType === 'whitelist'

  return (
    <form onSubmit={submit} className="mt-4 space-y-2">
      {error && <div className="text-xs text-[var(--rust)] bg-[var(--rust)]/10 border border-[var(--rust)] rounded-lg px-3 py-2">{error}</div>}
      <input
        value={domain}
        onChange={e => setDomain(e.target.value)}
        placeholder="e.g. example.com"
        className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--signal-deep)] transition-colors"
        style={{ fontFamily: 'var(--mono)' }}
      />
      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--signal-deep)] transition-colors"
      />
      <button
        type="submit"
        disabled={loading || !domain.trim()}
        className={`btn-press w-full disabled:opacity-50 text-sm font-semibold rounded-lg py-2 flex items-center justify-center gap-1.5 ${
          isWhitelist ? 'bg-[var(--signal)] hover:bg-[var(--signal-deep)] text-[var(--ink)]' : 'bg-[var(--rust)] hover:brightness-110 text-white'
        }`}
      >
        <Plus size={14} /> {loading ? 'Adding...' : `Add to ${isWhitelist ? 'Whitelist' : 'Blacklist'}`}
      </button>
    </form>
  )
}

const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  openphish: { label: 'OpenPhish', cls: 'bg-[var(--amber)]/10 text-[var(--amber)] border-[var(--amber)]' },
  phishtank: { label: 'PhishTank', cls: 'bg-[var(--amber)]/10 text-[var(--amber)] border-[var(--amber)]' },
  auto:      { label: 'Auto',      cls: 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]' },
  manual:    { label: 'Manual',    cls: 'bg-[var(--bg-input)] text-[var(--text-secondary)] border-[var(--border-primary)]' },
}

function DomainChip({ entry, onRemove }: { entry: DomainEntry; onRemove: () => void }) {
  const [removing, setRemoving] = useState(false)
  const isWhite = entry.listType === 'whitelist'
  const srcBadge = SOURCE_BADGE[entry.source] ?? SOURCE_BADGE.manual

  const remove = async () => {
    if (!confirm(`Remove ${entry.domain} from the ${entry.listType}?`)) return
    setRemoving(true)
    await api.removeDomain(entry.id)
    onRemove()
  }

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-sm ${
      isWhite
        ? 'bg-[var(--signal)]/10 border-[var(--signal-deep)]'
        : 'bg-[var(--rust)]/10 border-[var(--rust)]'
    }`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`font-semibold truncate ${isWhite ? 'text-[var(--signal)]' : 'text-[var(--rust)]'}`} style={{ fontFamily: 'var(--mono)' }}>
            {entry.domain}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${srcBadge.cls}`}>
            {srcBadge.label}
          </span>
        </div>
        {entry.reason && <div className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">{entry.reason}</div>}
      </div>
      <button
        onClick={remove}
        disabled={removing}
        className="text-[var(--text-tertiary)] hover:text-[var(--rust)] transition-colors flex-shrink-0 disabled:opacity-40 p-1 rounded hover:bg-[var(--bg-hover)]"
        title="Remove"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function DomainPanel({
  title, icon: Icon, description, listType, entries, onAdded, onRemoved,
}: {
  title: string; icon: typeof ShieldCheck; description: string
  listType: 'whitelist' | 'blacklist'
  entries: DomainEntry[]
  onAdded: (e: DomainEntry) => void
  onRemoved: (id: string) => void
}) {
  const isWhite = listType === 'whitelist'

  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5 flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon size={20} className={isWhite ? 'text-[var(--signal)]' : 'text-[var(--rust)]'} />
          <h2 className={`font-bold text-lg ${isWhite ? 'text-[var(--signal)]' : 'text-[var(--rust)]'}`}>{title}</h2>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
          isWhite
            ? 'bg-[var(--signal)]/10 text-[var(--signal)]'
            : 'bg-[var(--rust)]/10 text-[var(--rust)]'
        }`} style={{ fontFamily: 'var(--mono)' }}>
          {entries.length} domain{entries.length !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-xs text-[var(--text-tertiary)] mb-4">{description}</p>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-[var(--text-tertiary)] text-sm">No domains added yet.</div>
      ) : (
        <div className="space-y-2 mb-2 flex-1">
          {entries.map(entry => (
            <DomainChip key={entry.id} entry={entry} onRemove={() => onRemoved(entry.id)} />
          ))}
        </div>
      )}

      <AddForm listType={listType} onAdded={onAdded} />
    </div>
  )
}

export default function DomainsPage() {
  const [whitelist, setWhitelist] = useState<DomainEntry[]>([])
  const [blacklist, setBlacklist] = useState<DomainEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ total_added: number; synced_at: string; sources: Record<string, { added: number; error?: string }> } | null>(null)
  const [syncError, setSyncError] = useState('')

  const load = () =>
    api.getDomains().then(r => { if (r.ok) return r.json(); return null }).then(data => {
      if (data) { setWhitelist(data.whitelist ?? []); setBlacklist(data.blacklist ?? []) }
      setLoading(false)
    })

  useEffect(() => { load() }, [])

  const syncIntel = async () => {
    setSyncing(true)
    setSyncError('')
    setSyncResult(null)
    try {
      const res = await api.syncThreatIntel()
      const data = await res.json()
      if (!res.ok) { setSyncError(data.error ?? 'Sync failed'); return }
      setSyncResult(data)
      load()
    } catch {
      setSyncError('Cannot reach server')
    } finally {
      setSyncing(false)
    }
  }

  const addTo = (type: 'whitelist' | 'blacklist') => (entry: DomainEntry) => {
    if (type === 'whitelist') setWhitelist(p => [...p, entry])
    else setBlacklist(p => [...p, entry])
  }

  const removeFrom = (type: 'whitelist' | 'blacklist') => (id: string) => {
    if (type === 'whitelist') setWhitelist(p => p.filter(e => e.id !== id))
    else setBlacklist(p => p.filter(e => e.id !== id))
  }

  return (
    <div className="p-8 page-enter">
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="kicker text-xs uppercase tracking-widest text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>Admin</p>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">Domain <em className="not-italic text-[var(--signal)]" style={{ fontFamily: 'var(--serif)' }}>lists</em></h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">
            Whitelisted domains are always treated as safe. Blacklisted domains always trigger a critical alert.
            Both override the automatic phishing analysis.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            onClick={syncIntel}
            disabled={syncing}
            className="btn-press flex items-center gap-2 bg-[var(--signal)] hover:bg-[var(--signal-deep)] disabled:opacity-50 text-[var(--ink)] text-sm font-semibold rounded-lg px-4 py-2"
          >
            {syncing ? (
              <><RefreshCw size={14} className="animate-spin" /> Syncing...</>
            ) : (
              <><Shield size={14} /> Sync Threat Intel</>
            )}
          </button>
          {syncResult && (
            <div className="text-xs text-[var(--signal)] text-right" style={{ fontFamily: 'var(--mono)' }}>
              Added {syncResult.total_added} domains &middot;{' '}
              {Object.entries(syncResult.sources).map(([src, r]) => (
                <span key={src} className="ml-1">
                  {src}: <span className="font-semibold">{r.added}</span>
                  {r.error && <span className="text-[var(--rust)]"> (err)</span>}
                </span>
              ))}
            </div>
          )}
          {syncError && <div className="text-xs text-[var(--rust)]">{syncError}</div>}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[var(--text-tertiary)]">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 stagger-in">
          <DomainPanel
            title="Whitelist" icon={ShieldCheck} listType="whitelist"
            description="Trusted domains — emails from these senders are always shown as safe regardless of content."
            entries={whitelist}
            onAdded={addTo('whitelist')}
            onRemoved={removeFrom('whitelist')}
          />
          <DomainPanel
            title="Blacklist" icon={ShieldBan} listType="blacklist"
            description="Blocked domains — emails from these senders always trigger a critical phishing alert."
            entries={blacklist}
            onAdded={addTo('blacklist')}
            onRemoved={removeFrom('blacklist')}
          />
        </div>
      )}

      <div className="mt-6 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-4">
        <div className="kicker text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--mono)' }}>How it works</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--text-secondary)]">
          <div>
            <span className="text-[var(--signal)] font-semibold">Whitelisted domain</span> — score forced to 0/100, shown as &quot;Safe Email&quot;. Useful for internal company domains or trusted partners.
          </div>
          <div>
            <span className="text-[var(--rust)] font-semibold">Blacklisted domain</span> — score forced to 100/100, shown as &quot;Phishing Detected&quot;. Useful for known malicious domains.
          </div>
          <div>
            <span className="text-[var(--accent)] font-semibold">Domain format</span> — enter the bare domain (e.g. <code style={{ fontFamily: 'var(--mono)' }}>evil.com</code>). Subdomains must be added separately.
          </div>
        </div>
      </div>
    </div>
  )
}
