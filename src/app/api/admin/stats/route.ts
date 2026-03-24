import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [total, pending, releasedToday, deletedToday, highRisk, scoreAgg, byLevel, byDay] = await Promise.all([
    prisma.emailReport.count({ where: { orgId: user.orgId } }),
    prisma.emailReport.count({ where: { orgId: user.orgId, status: 'pending' } }),
    prisma.emailReport.count({ where: { orgId: user.orgId, status: 'released', reviewedAt: { gte: today } } }),
    prisma.emailReport.count({ where: { orgId: user.orgId, status: 'deleted', reviewedAt: { gte: today } } }),
    prisma.emailReport.count({ where: { orgId: user.orgId, riskLevel: { in: ['high', 'critical'] } } }),
    prisma.emailReport.aggregate({ where: { orgId: user.orgId }, _avg: { riskScore: true } }),
    prisma.emailReport.groupBy({ by: ['riskLevel'], where: { orgId: user.orgId }, _count: true }),
    prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT DATE_TRUNC('day', "reported_at")::text AS day, COUNT(*)::bigint AS count
      FROM email_reports
      WHERE org_id = ${user.orgId}
        AND reported_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `,
  ])

  return ok({
    total_reports: total,
    pending_review: pending,
    released_today: releasedToday,
    deleted_today: deletedToday,
    high_risk_count: highRisk,
    avg_risk_score: Math.round((scoreAgg._avg.riskScore ?? 0) * 10) / 10,
    by_level: byLevel.reduce((acc, r) => ({ ...acc, [r.riskLevel]: r._count }), {} as Record<string, number>),
    reports_per_day: byDay.map(r => ({ day: r.day, count: Number(r.count) })),
  })
}
