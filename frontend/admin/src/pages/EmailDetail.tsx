import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { adminApi } from '../api/client'
import { EmailReport } from '../types'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import SignalsList from '../components/SignalsList'
import { formatDistanceToNow, format } from 'date-fns'

export default function EmailDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [report, setReport] = useState<EmailReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [activeTab, setActiveTab] = useState<'overview' | 'body' | 'links' | 'attachments' | 'history'>('overview')

  useEffect(() => {
    if (!id) return
    adminApi.getReport(id).then((r) => {
      setReport(r.data)
      setNotes(r.data.admin_notes || '')
    }).finally(() => setLoading(false))
  }, [id])

  const handleAction = async (action: string) => {
    if (!id) return
    setActionLoading(true)
    try {
      await adminApi.reviewReport(id, action, notes || undefined)
      const updated = await adminApi.getReport(id)
      setReport(updated.data)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Loading...</div>
  if (!report) return <div className="p-8 text-center text-gray-500">Report not found</div>

  const isPending = report.status === 'pending'

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <button onClick={() => navigate('/queue')} className="text-sm text-gray-400 hover:text-white mb-3 flex items-center gap-1">
            ← Back to queue
          </button>
          <h1 className="text-xl font-bold text-white">{report.subject || '(no subject)'}</h1>
          <div className="text-gray-400 text-sm mt-1">
            Reported by <strong className="text-white">{report.reporter_email}</strong> · {formatDistanceToNow(new Date(report.reported_at), { addSuffix: true })}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <RiskBadge level={report.risk_level} score={report.risk_score} />
          <StatusBadge status={report.status} />
        </div>
      </div>

      {/* Score bar */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400 font-medium">Phishing Risk Score</span>
          <span className="text-2xl font-bold text-white">{report.risk_score}<span className="text-gray-500 text-base">/100</span></span>
        </div>
        <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              report.risk_score >= 75 ? 'bg-red-500' :
              report.risk_score >= 50 ? 'bg-orange-500' :
              report.risk_score >= 25 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${report.risk_score}%` }}
          />
        </div>
        <div className="text-xs text-gray-400 mt-2">{report.signals.length} signal(s) detected</div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {(['overview', 'body', 'links', 'attachments', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab}
            {tab === 'links' && report.links.length > 0 && ` (${report.links.length})`}
            {tab === 'attachments' && report.attachments.length > 0 && ` (${report.attachments.length})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h3 className="font-semibold text-white mb-4">Email Details</h3>
            <dl className="space-y-3 text-sm">
              {[
                ['From', report.sender],
                ['Reply-To', report.reply_to],
                ['Sender Domain', report.sender_domain],
                ['Recipient', report.recipient_email],
                ['Subject', report.subject],
                ['Source', report.source],
              ].map(([label, value]) => value && (
                <div key={label} className="flex gap-4">
                  <dt className="text-gray-400 w-28 shrink-0">{label}</dt>
                  <dd className="text-white font-mono text-xs bg-gray-800 px-2 py-1 rounded">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
            <h3 className="font-semibold text-white mb-4">Detected Signals</h3>
            <SignalsList signals={report.signals} />
          </div>
        </div>
      )}

      {activeTab === 'body' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">Email Body</h3>
          {report.email_body_text ? (
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-800 rounded-lg p-4 max-h-96 overflow-auto">
              {report.email_body_text}
            </pre>
          ) : (
            <div className="text-gray-500 text-sm">No plain text body available</div>
          )}
          {report.email_body_html && (
            <div className="mt-4">
              <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">HTML Preview (sanitized)</div>
              <div
                className="bg-white rounded-lg p-4 max-h-96 overflow-auto text-gray-900 text-sm"
                dangerouslySetInnerHTML={{ __html: report.email_body_html.replace(/<script[^>]*>.*?<\/script>/gis, '').replace(/on\w+="[^"]*"/gi, '') }}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === 'links' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">Extracted Links ({report.links.length})</h3>
          {report.links.length === 0 ? (
            <div className="text-gray-500 text-sm">No links found</div>
          ) : (
            <div className="space-y-3">
              {report.links.map((link) => (
                <div key={link.id} className={`rounded-lg border p-3 text-sm ${link.is_suspicious ? 'border-red-800 bg-red-950/20' : 'border-gray-800 bg-gray-800/30'}`}>
                  {link.display_text && <div className="text-gray-300 mb-1">Display: <span className="font-mono text-xs">{link.display_text}</span></div>}
                  <div className="text-gray-400 break-all font-mono text-xs">{link.url}</div>
                  {link.domain && <div className="text-gray-500 text-xs mt-1">Domain: {link.domain}</div>}
                  {link.is_suspicious && (
                    <div className="text-red-400 text-xs mt-1 font-semibold">⚠ {link.risk_reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'attachments' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">Attachments ({report.attachments.length})</h3>
          {report.attachments.length === 0 ? (
            <div className="text-gray-500 text-sm">No attachments</div>
          ) : (
            <div className="space-y-3">
              {report.attachments.map((att) => (
                <div key={att.id} className={`rounded-lg border p-3 text-sm ${att.is_suspicious ? 'border-red-800 bg-red-950/20' : 'border-gray-800 bg-gray-800/30'}`}>
                  <div className="font-medium text-white">{att.filename || 'unnamed'}</div>
                  <div className="text-gray-400 text-xs mt-1">{att.content_type} {att.file_size ? `· ${(att.file_size / 1024).toFixed(1)} KB` : ''}</div>
                  {att.is_suspicious && (
                    <div className="text-red-400 text-xs mt-1 font-semibold">⚠ {att.risk_reason}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
          <h3 className="font-semibold text-white mb-4">Action History</h3>
          {report.actions.length === 0 ? (
            <div className="text-gray-500 text-sm">No actions taken yet</div>
          ) : (
            <div className="space-y-3">
              {report.actions.map((action) => (
                <div key={action.id} className="flex gap-3 text-sm">
                  <div className="text-gray-500 whitespace-nowrap text-xs mt-0.5">
                    {format(new Date(action.created_at), 'MMM d, HH:mm')}
                  </div>
                  <div>
                    <span className="text-white font-medium capitalize">{action.action}</span>
                    {action.notes && <div className="text-gray-400 text-xs mt-0.5">{action.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin Actions */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-5 mt-5">
        <h3 className="font-semibold text-white mb-4">Admin Action</h3>
        {!isPending && (
          <div className="mb-4 p-3 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-300">
            This report has already been <strong className="text-white">{report.status}</strong>.
            {report.reviewed_at && (
              <span className="ml-1 text-gray-400">({format(new Date(report.reviewed_at), 'MMM d yyyy, HH:mm')})</span>
            )}
          </div>
        )}
        <div className="mb-4">
          <label className="block text-sm text-gray-400 mb-2">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm resize-none focus:outline-none focus:border-blue-500"
            placeholder="Add notes about this decision..."
          />
        </div>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => handleAction('released')}
            disabled={actionLoading}
            className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 transition-colors"
          >
            ✅ Release to User
          </button>
          <button
            onClick={() => handleAction('deleted')}
            disabled={actionLoading}
            className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 transition-colors"
          >
            🗑️ Delete (Phishing)
          </button>
          <button
            onClick={() => handleAction('false_positive')}
            disabled={actionLoading}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 transition-colors"
          >
            False Positive
          </button>
          <button
            onClick={() => handleAction('escalated')}
            disabled={actionLoading}
            className="bg-orange-700 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg py-2.5 px-4 transition-colors"
          >
            🔺 Escalate
          </button>
        </div>
      </div>
    </div>
  )
}
