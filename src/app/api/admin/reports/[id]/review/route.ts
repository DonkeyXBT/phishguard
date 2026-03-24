import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

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

  return ok({ message: `Report marked as ${action}`, report_id: id })
}
