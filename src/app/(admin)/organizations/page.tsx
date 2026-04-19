'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Plus, Building2, Copy, Check, RotateCcw, Trash2, BookOpen, X } from 'lucide-react'

interface Org {
  id: string
  name: string
  apiKey: string
  createdAt: string
  _count: { users: number; reports: number }
}

const PROD_URL = typeof window !== 'undefined' ? window.location.origin : ''

function SetupCard({ org, onClose }: { org: Org; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const fields = [
    { label: 'Server URL', value: PROD_URL, desc: 'Paste this into the extension Server URL field' },
    { label: 'API Key', value: org.apiKey, desc: 'Paste this into the extension API Key field' },
  ]

  return (
    <div className="fixed inset-0 bg-[var(--bg-overlay)] flex items-center justify-center z-50 p-4 modal-overlay">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-lg modal-content">
        <div className="p-6 border-b border-[var(--border-secondary)] flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-heading)]">Extension Setup</h2>
            <p className="text-sm text-[var(--text-tertiary)] mt-0.5" style={{ fontFamily: 'var(--mono)' }}>{org.name}</p>
          </div>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Share these values with users in this organization. They paste them into the PhishGuard browser extension popup.
          </p>

          {fields.map(f => (
            <div key={f.label}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="kicker text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-widest" style={{ fontFamily: 'var(--mono)' }}>{f.label}</label>
                <button
                  onClick={() => copy(f.value, f.label)}
                  className="text-xs text-[var(--accent)] hover:text-[var(--accent-deep)] transition-colors flex items-center gap-1"
                >
                  {copied === f.label ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
              </div>
              <div className="bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-sm text-[var(--signal)] break-all select-all" style={{ fontFamily: 'var(--mono)' }}>
                {f.value}
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">{f.desc}</p>
            </div>
          ))}

          <div className="bg-[var(--bg-hover)] border border-[var(--border-primary)] rounded-lg p-4 mt-2">
            <div className="kicker text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--mono)' }}>Extension setup steps</div>
            <ol className="text-sm text-[var(--text-secondary)] space-y-1 list-decimal list-inside">
              <li>Install the PhishGuard Chrome extension</li>
              <li>Click the PhishGuard icon in the browser toolbar</li>
              <li>Paste the <span className="text-[var(--text-primary)] font-medium">Server URL</span> above</li>
              <li>Paste the <span className="text-[var(--text-primary)] font-medium">API Key</span> above</li>
              <li>Click <span className="text-[var(--text-primary)] font-medium">Save Settings</span></li>
            </ol>
          </div>
        </div>

        <div className="p-6 pt-0">
          <button onClick={onClose}
            className="btn-press w-full border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm font-semibold rounded-lg py-2.5">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function CreateOrgModal({ onCreated, onClose }: { onCreated: (org: Org) => void; onClose: () => void }) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/api/admin/organizations', { name })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed'); return }
      onCreated(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-[var(--bg-overlay)] flex items-center justify-center z-50 p-4 modal-overlay">
      <div className="bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-2xl w-full max-w-md modal-content">
        <div className="p-6 border-b border-[var(--border-secondary)] flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text-heading)]">New Organization</h2>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-hover)] transition-colors">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="bg-[var(--rust)]/10 border border-[var(--rust)] text-[var(--rust)] text-sm rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Organization Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full bg-[var(--bg-input)] border border-[var(--border-primary)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--signal-deep)] transition-colors"
              required
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="btn-press flex-1 border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm font-semibold rounded-lg py-2.5">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="btn-press flex-1 bg-[var(--signal)] hover:bg-[var(--signal-deep)] disabled:opacity-50 text-[var(--ink)] text-sm font-semibold rounded-lg py-2.5">
              {loading ? 'Creating...' : 'Create Organization'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function OrganizationsPage() {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [setupOrg, setSetupOrg] = useState<Org | null>(null)
  const [rotating, setRotating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await api.get('/api/admin/organizations')
    if (res.ok) { const data = await res.json(); if (Array.isArray(data)) setOrgs(data) }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreated = (org: Org) => {
    setCreating(false)
    setOrgs(prev => [org, ...prev])
    setSetupOrg(org)
  }

  const handleRotateKey = async (org: Org) => {
    if (!confirm(`Rotate API key for "${org.name}"? All existing extension installations will stop working until updated.`)) return
    setRotating(org.id)
    const res = await api.patch(`/api/admin/organizations/${org.id}`, { action: 'rotate_key' })
    const data = await res.json()
    setOrgs(prev => prev.map(o => o.id === org.id ? { ...o, apiKey: data.api_key } : o))
    setRotating(null)
    setSetupOrg(orgs.find(o => o.id === org.id) ? { ...org, apiKey: data.api_key } : null)
  }

  const handleDelete = async (org: Org) => {
    if (!confirm(`Delete "${org.name}"? This cannot be undone.`)) return
    setDeleting(org.id)
    await api.delete(`/api/admin/organizations/${org.id}`)
    setOrgs(prev => prev.filter(o => o.id !== org.id))
    setDeleting(null)
  }

  return (
    <div className="p-8 page-enter">
      {creating && <CreateOrgModal onCreated={handleCreated} onClose={() => setCreating(false)} />}
      {setupOrg && <SetupCard org={setupOrg} onClose={() => setSetupOrg(null)} />}

      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="kicker text-xs uppercase tracking-widest text-[var(--text-tertiary)] mb-1" style={{ fontFamily: 'var(--mono)' }}>Admin</p>
          <h1 className="text-2xl font-bold text-[var(--text-heading)]">Your <em className="not-italic text-[var(--signal)]" style={{ fontFamily: 'var(--serif)' }}>organizations</em></h1>
          <p className="text-[var(--text-tertiary)] text-sm mt-1">Manage organizations and their extension credentials</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="btn-press bg-[var(--signal)] hover:bg-[var(--signal-deep)] text-[var(--ink)] text-sm font-semibold rounded-lg px-4 py-2.5 flex items-center gap-2"
        >
          <Plus size={16} /> New Organization
        </button>
      </div>

      {loading && <div className="text-center py-16 text-[var(--text-tertiary)]">Loading...</div>}

      {!loading && orgs.length === 0 && (
        <div className="text-center py-16 text-[var(--text-tertiary)]">
          <Building2 size={40} className="mx-auto mb-3 opacity-40" />
          <div className="font-medium">No organizations yet</div>
          <div className="text-sm mt-1">Create one to get extension setup credentials</div>
        </div>
      )}

      <div className="space-y-4 stagger-in">
        {orgs.map(org => (
          <div key={org.id} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-primary)] p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 size={18} className="text-[var(--text-tertiary)]" />
                  <h3 className="font-semibold text-[var(--text-primary)]">{org.name}</h3>
                </div>
                <div className="flex gap-4 text-xs text-[var(--text-tertiary)] mb-3" style={{ fontFamily: 'var(--mono)' }}>
                  <span>{org._count.users} user{org._count.users !== 1 ? 's' : ''}</span>
                  <span>{org._count.reports} report{org._count.reports !== 1 ? 's' : ''}</span>
                  <span>Created {new Date(org.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-tertiary)]">API Key:</span>
                  <code className="text-xs text-[var(--text-secondary)] bg-[var(--bg-input)] px-2 py-0.5 rounded" style={{ fontFamily: 'var(--mono)' }}>
                    {org.apiKey.substring(0, 8)}--------{org.apiKey.substring(org.apiKey.length - 4)}
                  </code>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSetupOrg(org)}
                  className="btn-press bg-[var(--signal)]/10 hover:bg-[var(--signal)]/20 text-[var(--signal)] border border-[var(--signal-deep)] text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5"
                >
                  <BookOpen size={14} /> Setup Guide
                </button>
                <button
                  onClick={() => handleRotateKey(org)}
                  disabled={rotating === org.id}
                  className="btn-press border border-[var(--border-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50 text-[var(--text-secondary)] text-xs font-semibold rounded-lg px-3 py-2 flex items-center gap-1.5"
                >
                  <RotateCcw size={14} /> {rotating === org.id ? 'Rotating...' : 'Rotate Key'}
                </button>
                <button
                  onClick={() => handleDelete(org)}
                  disabled={deleting === org.id}
                  className="btn-press border border-[var(--border-primary)] hover:bg-[var(--rust)]/10 disabled:opacity-50 text-[var(--text-tertiary)] hover:text-[var(--rust)] hover:border-[var(--rust)] text-xs font-semibold rounded-lg px-3 py-2"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
