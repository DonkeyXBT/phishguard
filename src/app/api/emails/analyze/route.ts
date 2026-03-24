import { NextRequest } from 'next/server'
import { analyzeEmail } from '@/lib/analyzer'
import { getApiKeyOrg, apiKeyFromRequest } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function POST(req: NextRequest) {
  const apiKey = apiKeyFromRequest(req)
  if (!apiKey) return err('API key required', 401)
  const org = await getApiKeyOrg(apiKey)
  if (!org) return err('Invalid API key', 401)

  const body = await req.json()
  const result = analyzeEmail({
    sender: body.sender,
    replyTo: body.reply_to,
    subject: body.subject,
    bodyText: body.body_text,
    bodyHtml: body.body_html,
    attachments: body.attachments ?? [],
  })

  return ok({
    risk_score: result.riskScore,
    risk_level: result.riskLevel,
    signals: result.signals,
    summary: result.summary,
  })
}
