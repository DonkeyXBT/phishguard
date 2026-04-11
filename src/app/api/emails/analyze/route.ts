import { NextRequest } from 'next/server'
import { after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeEmail } from '@/lib/analyzer'
import { getApiKeyOrg, apiKeyFromRequest } from '@/lib/auth'
import { getClassifier, saveClassifier } from '@/lib/ml-scorer'
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

  // Warm the ML classifier cache from the database (will use cached version after first call)
  await getClassifier()

  const result = analyzeEmail({
    sender:      body.sender,
    replyTo:     body.reply_to,
    subject:     body.subject,
    bodyText:    body.body_text,
    bodyHtml:    body.body_html,
    attachments: body.attachments ?? [],
    rawHeaders:  body.raw_headers ?? body.headers ?? null,
  })

  // ── Check if admin already reviewed this email as phishing ──────────────
  const sender = body.sender?.trim() || null
  const subject = body.subject?.trim() || null
  if (sender && subject) {
    const reviewed = await prisma.emailReport.findFirst({
      where: {
        orgId: org.id,
        sender: { equals: sender, mode: 'insensitive' },
        subject: { equals: subject, mode: 'insensitive' },
        status: { in: ['deleted', 'escalated'] },
      },
      orderBy: { reviewedAt: 'desc' },
    })
    if (reviewed) {
      result.riskScore = 100
      result.riskLevel = 'critical'
      result.signals   = [
        { code: 'admin_confirmed_phishing', label: 'Admin Confirmed Phishing', severity: 'critical', description: 'Your security team has reviewed this email and confirmed it is phishing.', detail: `Reviewed as ${reviewed.status}`, score: 100 },
        ...result.signals,
      ]
      result.summary = 'This email was confirmed as phishing by your security team. Do not interact with it.'
      return ok({
        risk_score:  result.riskScore,
        risk_level:  result.riskLevel,
        signals:     result.signals,
        summary:     result.summary,
        email_auth:  result.emailAuth ?? null,
        admin_reviewed: true,
      })
    }
  }

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

  // ── Weak-label training from analyzer confidence ────────────────────────
  // Use clearly-classified emails as additional training data:
  //   score >= 80 → confidently phishing
  //   score <= 10 → confidently legitimate
  // Skip the ambiguous middle zone to avoid teaching the model bad signals.
  // Best-effort, non-blocking — never let this slow down the response.
  const text = [body.subject ?? '', body.body_text ?? ''].join(' ').trim()
  if (text.length >= 30) {
    const isClearPhish = result.riskScore >= 80
    const isClearHam = result.riskScore <= 10
    if (isClearPhish || isClearHam) {
      // Run after the response is sent — Vercel keeps the function alive for after()
      after(async () => {
        try {
          const classifier = await getClassifier()
          classifier.train(text, isClearPhish)
          await saveClassifier(classifier, 1)
        } catch (e) {
          console.error('[analyze] weak-label training failed:', e)
        }
      })
    }
  }

  return ok({
    risk_score:  result.riskScore,
    risk_level:  result.riskLevel,
    signals:     result.signals,
    summary:     result.summary,
    email_auth:  result.emailAuth ?? null,
  })
}
