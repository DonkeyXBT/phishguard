/**
 * Email notification system for high-risk report alerts.
 *
 * Supports multiple transports:
 *   - SMTP via nodemailer (when SMTP_* env vars are set)
 *   - Webhook (when ALERT_WEBHOOK_URL env var is set — Slack, Teams, etc.)
 *   - Console fallback (development)
 *
 * No external dependencies — uses fetch for webhooks and falls back to
 * console.log when no transport is configured.
 */

export interface AlertPayload {
  reportId: string
  sender: string | null
  subject: string | null
  riskScore: number
  riskLevel: string
  signalCount: number
  reporterEmail: string
  summary: string
}

async function sendWebhook(payload: AlertPayload): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL
  if (!url) return

  const text = [
    `🚨 *High-Risk Phishing Report*`,
    `*Subject:* ${payload.subject ?? '(none)'}`,
    `*From:* ${payload.sender ?? 'unknown'}`,
    `*Risk:* ${payload.riskLevel.toUpperCase()} (${payload.riskScore}/100)`,
    `*Signals:* ${payload.signalCount}`,
    `*Reported by:* ${payload.reporterEmail}`,
    `*Summary:* ${payload.summary}`,
    `*Report ID:* ${payload.reportId}`,
  ].join('\n')

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, username: 'PhishGuard Alert' }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {
    // Best-effort — never fail the main flow
  })
}

async function sendEmail(payload: AlertPayload): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM ?? 'phishguard@noreply.local'
  const to = process.env.ALERT_EMAIL_TO

  if (!host || !to) return

  // Use dynamic import to avoid requiring nodemailer in environments without it
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require('nodemailer') as any
    const transporter = nodemailer.createTransport({
      host,
      port: port ? parseInt(port) : 587,
      secure: port === '465',
      auth: user && pass ? { user, pass } : undefined,
    })

    await transporter.sendMail({
      from,
      to,
      subject: `[PhishGuard] ${payload.riskLevel.toUpperCase()} risk: ${payload.subject ?? 'No subject'}`,
      text: [
        `PhishGuard High-Risk Alert`,
        ``,
        `Subject: ${payload.subject ?? '(none)'}`,
        `From: ${payload.sender ?? 'unknown'}`,
        `Risk: ${payload.riskLevel.toUpperCase()} (${payload.riskScore}/100)`,
        `Signals: ${payload.signalCount}`,
        `Reported by: ${payload.reporterEmail}`,
        ``,
        `Summary: ${payload.summary}`,
        `Report ID: ${payload.reportId}`,
      ].join('\n'),
    })
  } catch {
    // nodemailer not installed or SMTP error — skip silently
  }
}

/**
 * Send a high-risk alert through all configured channels.
 * Fire-and-forget — never throws or blocks the caller.
 */
export async function notifyHighRisk(payload: AlertPayload): Promise<void> {
  const tasks: Promise<void>[] = []

  if (process.env.ALERT_WEBHOOK_URL) {
    tasks.push(sendWebhook(payload))
  }

  if (process.env.SMTP_HOST && process.env.ALERT_EMAIL_TO) {
    tasks.push(sendEmail(payload))
  }

  if (tasks.length === 0 && process.env.NODE_ENV === 'development') {
    console.log('[PhishGuard Alert]', payload.riskLevel.toUpperCase(), payload.subject, `(${payload.riskScore}/100)`)
  }

  await Promise.allSettled(tasks)
}
