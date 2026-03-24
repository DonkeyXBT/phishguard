import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || undefined
  const riskLevel = searchParams.get('risk_level') || undefined
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const reports = await prisma.emailReport.findMany({
    where: { ...(status ? { status } : {}), ...(riskLevel ? { riskLevel } : {}) },
    orderBy: { reportedAt: 'desc' },
    take: limit,
    skip: offset,
    select: {
      id: true, reporterEmail: true, subject: true, sender: true,
      riskScore: true, riskLevel: true, status: true, reportedAt: true, source: true,
    },
  })

  return ok(reports)
}
