export interface Signal {
  code: string
  label: string
  description: string
  detail: string
  score: number
  severity: 'info' | 'warning' | 'danger' | 'critical'
}

export interface EmailLink {
  id: string
  display_text: string | null
  url: string | null
  final_url: string | null
  domain: string | null
  is_suspicious: boolean
  risk_reason: string | null
}

export interface EmailAttachment {
  id: string
  filename: string | null
  content_type: string | null
  file_size: number | null
  is_suspicious: boolean
  risk_reason: string | null
}

export interface AdminAction {
  id: string
  action: string
  notes: string | null
  created_at: string
  admin_id: string
}

export interface EmailReport {
  id: string
  reporter_email: string
  recipient_email: string | null
  subject: string | null
  sender: string | null
  sender_domain: string | null
  reply_to: string | null
  email_body_text: string | null
  email_body_html: string | null
  risk_score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  signals: Signal[]
  status: 'pending' | 'released' | 'deleted' | 'false_positive' | 'escalated'
  source: string
  reported_at: string
  reviewed_at: string | null
  admin_notes: string | null
  links: EmailLink[]
  attachments: EmailAttachment[]
  actions: AdminAction[]
}

export interface EmailReportSummary {
  id: string
  reporter_email: string
  subject: string | null
  sender: string | null
  risk_score: number
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  status: string
  reported_at: string
  source: string
}

export interface DashboardStats {
  total_reports: number
  pending_review: number
  released_today: number
  deleted_today: number
  high_risk_count: number
  avg_risk_score: number
}
