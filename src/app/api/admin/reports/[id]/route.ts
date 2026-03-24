import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)
  const { id } = await params

  const report = await prisma.emailReport.findFirst({
    where: { id, orgId: user.orgId },
    include: { links: true, attachments: true, actions: { orderBy: { createdAt: 'asc' } } },
  })

  if (!report) return err('Not found', 404)
  return ok(report)
}
