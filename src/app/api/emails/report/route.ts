import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { analyzeEmail } from '@/lib/analyzer'
import { getApiKeyOrg, apiKeyFromRequest } from '@/lib/auth'
import { ok, err } from '@/lib/response'
import { isShortUrl, resolveUrl } from '@/lib/url-resolver'
import { notifyHighRisk } from '@/lib/notifications'

function extractDomain(sender?: string | null) {
  if (!sender) return null
  if (sender.includes('@')) return sender.split('@').pop()?.replace(/[>]/g, '').trim() ?? null
  return null
}

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
    bodyText: body.email_body_text,
    bodyHtml: body.email_body_html,
    attachments: body.attachments ?? [],
    rawHeaders: body.raw_headers ?? body.headers ?? null,
  })

  // Resolve shortened URLs in the background (best-effort)
  const linksWithFinal = await Promise.all(
    result.links.map(async l => {
      if (l.url && isShortUrl(l.url)) {
        try {
          const resolved = await resolveUrl(l.url)
          return { ...l, finalUrl: resolved.finalUrl }
        } catch {
          return { ...l, finalUrl: null as string | null }
        }
      }
      return { ...l, finalUrl: null as string | null }
    }),
  )

  const report = await prisma.emailReport.create({
    data: {
      orgId: org.id,
      reporterEmail: body.reporter_email,
      recipientEmail: body.recipient_email,
      subject: body.subject,
      sender: body.sender,
      senderDomain: extractDomain(body.sender),
      replyTo: body.reply_to,
      bodyText: body.email_body_text,
      bodyHtml: body.email_body_html,
      headers: body.raw_headers ? { raw: body.raw_headers } : (body.headers ?? {}),
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      signals: result.signals as unknown as import('@prisma/client').Prisma.InputJsonValue,
      source: body.source ?? 'user_report',
      links: {
        create: linksWithFinal.map(l => ({
          displayText: l.displayText,
          url: l.url,
          finalUrl: l.finalUrl,
          domain: l.domain,
          isSuspicious: l.isSuspicious,
          riskReason: l.riskReason,
        })),
      },
      attachments: {
        create: result.attachments.map(a => ({
          filename: a.filename,
          contentType: a.contentType,
          isSuspicious: a.isSuspicious,
          riskReason: a.riskReason,
        })),
      },
    },
    include: { links: true, attachments: true, actions: true },
  })

  // Fire alert for high-risk reports (non-blocking)
  if (result.riskLevel === 'high' || result.riskLevel === 'critical') {
    notifyHighRisk({
      reportId: report.id,
      sender: body.sender ?? null,
      subject: body.subject ?? null,
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      signalCount: result.signals.length,
      reporterEmail: body.reporter_email,
      summary: result.summary,
    }).catch(() => {})
  }

  return ok(report, 201)
}
