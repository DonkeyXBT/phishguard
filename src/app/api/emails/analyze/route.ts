import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeEmail } from '@/lib/analyzer'
import { getApiKeyOrg, apiKeyFromRequest } from '@/lib/auth'
import { ok, err } from '@/lib/response'

function extractDomain(sender?: string | null): string | null {
  if (!sender) return null
  const match = sender.match(/@([\w.-]+)/)
  return match ? match[1].toLowerCase() : null
}

export async function POST(req: NextRequest) {
  const apiKey = apiKeyFromRequest(req)
  if (!apiKey) return err('API key required', 401)
  const org = await getApiKeyOrg(apiKey)
  if (!org) return err('Invalid API key', 401)

  const body = await req.json()
  const result = analyzeEmail({
    sender:      body.sender,
    replyTo:     body.reply_to,
    subject:     body.subject,
    bodyText:    body.body_text,
    bodyHtml:    body.body_html,
    attachments: body.attachments ?? [],
  })

  // ── Domain list override ──────────────────────────────────────────────────
  const domain = extractDomain(body.sender)
  if (domain) {
    const listed = await prisma.domainList.findFirst({
      where: { domain },
    })

    if (listed?.listType === 'whitelist') {
      result.riskScore = 0
      result.riskLevel = 'low'
      result.signals   = [{ code: 'domain_whitelisted', label: 'Whitelisted domain', severity: 'info', description: `${domain} is on your organization's trusted domain list.`, detail: domain, score: 0 }]
      result.summary   = `${domain} is on your organization's whitelist — email treated as safe.`
    } else if (listed?.listType === 'blacklist') {
      result.riskScore = 100
      result.riskLevel = 'critical'
      result.signals   = [
        { code: 'domain_blacklisted', label: 'Blacklisted domain', severity: 'critical', description: `${domain} is on your organization's blocked domain list.`, detail: domain, score: 100 },
        ...result.signals,
      ]
      result.summary = `${domain} is on your organization's blacklist — treat this email as phishing.`
    }
  }

  return ok({
    risk_score: result.riskScore,
    risk_level: result.riskLevel,
    signals:    result.signals,
    summary:    result.summary,
  })
}
