'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface DomainEntry {
  id: string
  domain: string
  listType: 'whitelist' | 'blacklist'
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
  const accent = isWhitelist ? 'green' : 'red'
  const btnClass = isWhitelist
    ? 'bg-emerald-600 hover:bg-emerald-700'
    : 'bg-red-600 hover:bg-red-700'

  return (
    <form onSubmit={submit} className="mt-4 space-y-2">
      {error && <div className="text-xs text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</div>}
      <input
        value={domain}
        onChange={e => setDomain(e.target.value)}
        placeholder="e.g. example.com"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 font-mono"
      />
      <input
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
      />
      <button
        type="submit"
        disabled={loading || !domain.trim()}
        className={`w-full ${btnClass} disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2 transition-colors`}
      >
        {loading ? 'Adding...' : `+ Add to ${isWhitelist ? 'Whitelist' : 'Blacklist'}`}
      </button>
    </form>
  )
}

function DomainChip({ entry, onRemove }: { entry: DomainEntry; onRemove: () => void }) {
  const [removing, setRemoving] = useState(false)
  const isWhite = entry.listType === 'whitelist'

  const remove = async () => {
    if (!confirm(`Remove ${entry.domain} from the ${entry.listType}?`)) return
    setRemoving(true)
    await api.removeDomain(entry.id)
    onRemove()
  }

  return (
    <div className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-sm ${
      isWhite ? 'bg-emerald-950/40 border-emerald-800/40' : 'bg-red-950/40 border-red-800/40'
    }`}>
      <div className="min-w-0">
        <div className={`font-mono font-semibold truncate ${isWhite ? 'text-emerald-300' : 'text-red-300'}`}>
          {entry.domain}
        </div>
        {entry.reason && <div className="text-xs text-gray-500 truncate mt-0.5">{entry.reason}</div>}
      </div>
      <button
        onClick={remove}
        disabled={removing}
        className="text-gray-600 hover:text-red-400 transition-colors text-lg leading-none flex-shrink-0 disabled:opacity-40"
        title="Remove"
      >
        ×
      </button>
    </div>
  )
}

function DomainPanel({
  title, icon, description, listType, entries, onAdded, onRemoved,
}: {
  title: string; icon: string; description: string
  listType: 'whitelist' | 'blacklist'
  entries: DomainEntry[]
  onAdded: (e: DomainEntry) => void
  onRemoved: (id: string) => void
}) {
  const isWhite = listType === 'whitelist'
  const headerColor = isWhite ? 'text-emerald-400' : 'text-red-400'
  const countBg = isWhite ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400'

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 flex flex-col">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <h2 className={`font-bold text-lg ${headerColor}`}>{title}</h2>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${countBg}`}>
          {entries.length} domain{entries.length !== 1 ? 's' : ''}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-4">{description}</p>

      {entries.length === 0 ? (
        <div className="text-center py-8 text-gray-600 text-sm">No domains added yet.</div>
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

  useEffect(() => {
    api.getDomains().then(r => r.json()).then(data => {
      setWhitelist(data.whitelist ?? [])
      setBlacklist(data.blacklist ?? [])
      setLoading(false)
    })
  }, [])

  const addTo = (type: 'whitelist' | 'blacklist') => (entry: DomainEntry) => {
    if (type === 'whitelist') setWhitelist(p => [...p, entry])
    else setBlacklist(p => [...p, entry])
  }

  const removeFrom = (type: 'whitelist' | 'blacklist') => (id: string) => {
    if (type === 'whitelist') setWhitelist(p => p.filter(e => e.id !== id))
    else setBlacklist(p => p.filter(e => e.id !== id))
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Domain Lists</h1>
        <p className="text-gray-400 text-sm mt-1">
          Whitelisted domains are always treated as safe. Blacklisted domains always trigger a critical alert.
          Both override the automatic phishing analysis.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DomainPanel
            title="Whitelist" icon="✅" listType="whitelist"
            description="Trusted domains — emails from these senders are always shown as safe regardless of content."
            entries={whitelist}
            onAdded={addTo('whitelist')}
            onRemoved={removeFrom('whitelist')}
          />
          <DomainPanel
            title="Blacklist" icon="🚫" listType="blacklist"
            description="Blocked domains — emails from these senders always trigger a critical phishing alert."
            entries={blacklist}
            onAdded={addTo('blacklist')}
            onRemoved={removeFrom('blacklist')}
          />
        </div>
      )}

      <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">How it works</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-400">
          <div>
            <span className="text-emerald-400 font-semibold">Whitelisted domain</span> — score forced to 0/100, shown as "Safe Email". Useful for internal company domains or trusted partners.
          </div>
          <div>
            <span className="text-red-400 font-semibold">Blacklisted domain</span> — score forced to 100/100, shown as "Phishing Detected". Useful for known malicious domains.
          </div>
          <div>
            <span className="text-blue-400 font-semibold">Domain format</span> — enter the bare domain (e.g. <code className="font-mono">evil.com</code>). Subdomains must be added separately.
          </div>
        </div>
      </div>
    </div>
  )
}
