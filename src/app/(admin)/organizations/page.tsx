'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-6 border-b border-gray-800 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Extension Setup</h2>
            <p className="text-sm text-gray-400 mt-0.5">{org.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-400">
            Share these values with users in this organization. They paste them into the PhishGuard browser extension popup.
          </p>

          {fields.map(f => (
            <div key={f.label}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{f.label}</label>
                <button
                  onClick={() => copy(f.value, f.label)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {copied === f.label ? '✅ Copied' : 'Copy'}
                </button>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 font-mono text-sm text-green-400 break-all select-all">
                {f.value}
              </div>
              <p className="text-xs text-gray-500 mt-1">{f.desc}</p>
            </div>
          ))}

          <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 mt-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Extension setup steps</div>
            <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
              <li>Install the PhishGuard Chrome extension</li>
              <li>Click the PhishGuard icon in the browser toolbar</li>
              <li>Paste the <span className="text-white font-medium">Server URL</span> above</li>
              <li>Paste the <span className="text-white font-medium">API Key</span> above</li>
              <li>Click <span className="text-white font-medium">Save Settings</span></li>
            </ol>
          </div>
        </div>

        <div className="p-6 pt-0">
          <button onClick={onClose}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors">
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">New Organization</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {error && <div className="bg-red-950 border border-red-800 text-red-400 text-sm rounded-lg p-3">{error}</div>}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Organization Name</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 transition-colors">
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
    setOrgs(await res.json())
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
    // Show setup card with new key
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
    <div className="p-8">
      {creating && <CreateOrgModal onCreated={handleCreated} onClose={() => setCreating(false)} />}
      {setupOrg && <SetupCard org={setupOrg} onClose={() => setSetupOrg(null)} />}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Organizations</h1>
          <p className="text-gray-400 text-sm mt-1">Manage organizations and their extension credentials</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors flex items-center gap-2"
        >
          + New Organization
        </button>
      </div>

      {loading && <div className="text-center py-16 text-gray-500">Loading...</div>}

      {!loading && orgs.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <div className="text-4xl mb-3">🏢</div>
          <div className="font-medium">No organizations yet</div>
          <div className="text-sm mt-1">Create one to get extension setup credentials</div>
        </div>
      )}

      <div className="space-y-4">
        {orgs.map(org => (
          <div key={org.id} className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🏢</span>
                  <h3 className="font-semibold text-white">{org.name}</h3>
                </div>
                <div className="flex gap-4 text-xs text-gray-500 mb-3">
                  <span>{org._count.users} user{org._count.users !== 1 ? 's' : ''}</span>
                  <span>{org._count.reports} report{org._count.reports !== 1 ? 's' : ''}</span>
                  <span>Created {new Date(org.createdAt).toLocaleDateString()}</span>
                </div>

                {/* API key preview */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">API Key:</span>
                  <code className="text-xs text-gray-400 font-mono bg-gray-800 px-2 py-0.5 rounded">
                    {org.apiKey.substring(0, 8)}••••••••{org.apiKey.substring(org.apiKey.length - 4)}
                  </code>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSetupOrg(org)}
                  className="bg-green-700 hover:bg-green-600 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
                >
                  📋 Setup Guide
                </button>
                <button
                  onClick={() => handleRotateKey(org)}
                  disabled={rotating === org.id}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
                >
                  {rotating === org.id ? 'Rotating...' : '🔄 Rotate Key'}
                </button>
                <button
                  onClick={() => handleDelete(org)}
                  disabled={deleting === org.id}
                  className="bg-gray-800 hover:bg-red-900/50 disabled:opacity-50 text-gray-400 hover:text-red-400 text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
                >
                  {deleting === org.id ? '...' : '🗑️'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
