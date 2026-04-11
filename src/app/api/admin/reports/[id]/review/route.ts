import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getClassifier, saveClassifier } from '@/lib/ml-scorer'
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

  // ── Incremental ML training ──────────────────────────────────────────────
  // Train the classifier on this email so future analyses learn from the admin's decision.
  // false_positive is excluded — it's a label correction, not a clear ham example.
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

  return ok({ message: `Report marked as ${action}`, report_id: id })
}
