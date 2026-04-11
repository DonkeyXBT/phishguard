import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getClassifier, saveClassifier } from '@/lib/ml-scorer'
import { invalidateCache } from '@/lib/cache'
import { ok, err } from '@/lib/response'
import { audit } from '@/lib/audit'

const VALID_ACTIONS = ['released', 'deleted', 'false_positive', 'escalated']

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)
  const { id } = await params

  const { action, notes } = await req.json()
  if (!VALID_ACTIONS.includes(action)) return err(`Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}`)

  const report = await prisma.emailReport.findFirst({ where: { id } })
  if (!report) return err('Not found', 404)

  await prisma.$transaction([
    prisma.emailReport.update({
      where: { id },
      data: { status: action, reviewedAt: new Date(), reviewedBy: user.id, adminNotes: notes ?? null },
    }),
    prisma.adminAction.create({
      data: { reportId: id, adminId: user.id, action, notes: notes ?? null },
    }),
  ])

  audit(req, { userId: user.id, userEmail: user.email, action: `report.${action}`, resource: `report:${id}`, detail: notes ?? null })

  // Invalidate cached aggregations so dashboard shows fresh data
  invalidateCache('stats:')
  invalidateCache('analytics:')

  // ── Incremental ML training ──────────────────────────────────────────────
  if (action === 'deleted' || action === 'escalated' || action === 'released') {
    try {
      const text = [report.subject ?? '', report.bodyText ?? ''].join(' ').trim()
      if (text.length >= 20) {
        const classifier = await getClassifier()
        const isPhishing = action === 'deleted' || action === 'escalated'
        classifier.train(text, isPhishing)
        await saveClassifier(classifier, 1)
      }
    } catch (e) {
      console.error('[review] ML training failed:', e)
    }
  }

  // ── Auto-domain-list ─────────────────────────────────────────────────────
  // When an admin's verdict for a sender domain becomes consistent across
  // multiple reports, auto-promote it to the appropriate domain list.
  // Thresholds: 3 phishing verdicts → blacklist, 5 released verdicts → whitelist.
  // Skips free email providers and domains already on either list.
  const FREE_PROVIDERS = ['gmail.com','yahoo.com','hotmail.com','outlook.com','live.com','icloud.com','aol.com','protonmail.com','mail.com']
  const senderDomain = report.senderDomain?.toLowerCase().trim() || null
  let autoListed: { type: string; domain: string } | null = null

  if (senderDomain && !FREE_PROVIDERS.includes(senderDomain)) {
    try {
      const existing = await prisma.domainList.findFirst({ where: { domain: senderDomain } })
      if (!existing) {
        if (action === 'deleted' || action === 'escalated') {
          const phishCount = await prisma.emailReport.count({
            where: {
              senderDomain,
              status: { in: ['deleted', 'escalated'] },
            },
          })
          if (phishCount >= 3) {
            await prisma.domainList.create({
              data: {
                domain: senderDomain,
                listType: 'blacklist',
                source: 'auto',
                reason: `Auto-blacklisted after ${phishCount} phishing reports`,
              },
            })
            autoListed = { type: 'blacklist', domain: senderDomain }
            audit(req, { userId: user.id, userEmail: user.email, action: 'domain.auto_blacklist', resource: `domain:${senderDomain}`, detail: `${phishCount} phishing reports` })
          }
        } else if (action === 'released') {
          const releasedCount = await prisma.emailReport.count({
            where: {
              senderDomain,
              status: 'released',
            },
          })
          // Also require zero phishing verdicts to avoid whitelisting a domain with mixed verdicts
          const phishCount = await prisma.emailReport.count({
            where: {
              senderDomain,
              status: { in: ['deleted', 'escalated'] },
            },
          })
          if (releasedCount >= 5 && phishCount === 0) {
            await prisma.domainList.create({
              data: {
                domain: senderDomain,
                listType: 'whitelist',
                source: 'auto',
                reason: `Auto-whitelisted after ${releasedCount} legitimate emails`,
              },
            })
            autoListed = { type: 'whitelist', domain: senderDomain }
            audit(req, { userId: user.id, userEmail: user.email, action: 'domain.auto_whitelist', resource: `domain:${senderDomain}`, detail: `${releasedCount} released reports` })
          }
        }
      }
    } catch (e) {
      console.error('[review] auto-domain-list failed:', e)
    }
  }

  return ok({ message: `Report marked as ${action}`, report_id: id, auto_listed: autoListed })
}
