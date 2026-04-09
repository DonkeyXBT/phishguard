import { NextRequest } from 'next/server'
import { analyzeEmail } from '@/lib/analyzer'
import { getApiKeyOrg, apiKeyFromRequest } from '@/lib/auth'
import { ok, err } from '@/lib/response'

const MAX_BATCH = 50

/**
 * POST /api/emails/batch
 * Analyze multiple emails at once (analysis only, no DB storage).
 *
 * Body: { emails: [{ sender, subject, body_text, body_html, ... }, ...] }
 */
export async function POST(req: NextRequest) {
  const apiKey = apiKeyFromRequest(req)
  if (!apiKey) return err('API key required', 401)
  const org = await getApiKeyOrg(apiKey)
  if (!org) return err('Invalid API key', 401)

  const body = await req.json()
  const emails: unknown[] = body.emails
  if (!Array.isArray(emails)) return err('Body must contain an "emails" array')
  if (emails.length === 0) return err('At least one email is required')
  if (emails.length > MAX_BATCH) return err(`Maximum ${MAX_BATCH} emails per batch`)

  const results = emails.map((email: any, index: number) => {
    try {
      const result = analyzeEmail({
        sender:      email.sender,
        replyTo:     email.reply_to,
        subject:     email.subject,
        bodyText:    email.body_text,
        bodyHtml:    email.body_html,
        attachments: email.attachments ?? [],
        rawHeaders:  email.raw_headers ?? email.headers ?? null,
      })
      return {
        index,
        sender:     email.sender ?? null,
        subject:    email.subject ?? null,
        risk_score: result.riskScore,
        risk_level: result.riskLevel,
        signals:    result.signals,
        summary:    result.summary,
        email_auth: result.emailAuth ?? null,
      }
    } catch (e) {
      return { index, error: String(e) }
    }
  })

  const totalHigh = results.filter((r: any) => r.risk_level === 'high' || r.risk_level === 'critical').length

  return ok({
    total:      results.length,
    high_risk:  totalHigh,
    results,
  })
}
