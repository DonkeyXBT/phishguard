import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '../api/client'
import { EmailReportSummary } from '../types'
import RiskBadge from '../components/RiskBadge'
import StatusBadge from '../components/StatusBadge'
import { formatDistanceToNow } from 'date-fns'

const STATUS_FILTERS = ['', 'pending', 'released', 'deleted', 'false_positive', 'escalated']
const RISK_FILTERS = ['', 'critical', 'high', 'medium', 'low']

export default function Queue() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<EmailReportSummary[]>([])
  const [status, setStatus] = useState('pending')
  const [riskLevel, setRiskLevel] = useState('')
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getQueue({ status: status || undefined, risk_level: riskLevel || undefined, limit: 100 })
      setReports(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status, riskLevel])

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Review Queue</h1>
          <p className="text-gray-400 text-sm mt-1">{reports.length} reports</p>
        </div>
        <button onClick={load} className="text-sm text-blue-400 hover:text-blue-300">
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                status === s ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {s || 'All Status'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
          {RISK_FILTERS.map((r) => (
            <button
              key={r}
              onClick={() => setRiskLevel(r)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                riskLevel === r ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {r || 'All Risk'}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        {loading && (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        )}
        {!loading && reports.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <div className="text-3xl mb-2">📭</div>
            No reports found
          </div>
        )}
        {!loading && reports.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Subject / Sender</th>
                <th className="text-left px-4 py-3">Reporter</th>
                <th className="text-left px-4 py-3">Risk</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Reported</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {reports.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => navigate(`/queue/${r.id}`)}
                  className="hover:bg-gray-800/50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-white truncate max-w-xs">{r.subject || '(no subject)'}</div>
                    <div className="text-gray-400 truncate max-w-xs">{r.sender || 'unknown sender'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{r.reporter_email}</td>
                  <td className="px-4 py-3">
                    <RiskBadge level={r.risk_level} score={r.risk_score} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                    {formatDistanceToNow(new Date(r.reported_at), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
