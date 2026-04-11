import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { cached } from '@/lib/cache'
import { ok, err } from '@/lib/response'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const data = await cached('stats:global', 30, async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [total, pending, releasedToday, deletedToday, highRisk, scoreAgg, byLevel] = await Promise.all([
      prisma.emailReport.count(),
      prisma.emailReport.count({ where: { status: 'pending' } }),
      prisma.emailReport.count({ where: { status: 'released', reviewedAt: { gte: today } } }),
      prisma.emailReport.count({ where: { status: 'deleted', reviewedAt: { gte: today } } }),
      prisma.emailReport.count({ where: { riskLevel: { in: ['high', 'critical'] } } }),
      prisma.emailReport.aggregate({ _avg: { riskScore: true } }),
      prisma.emailReport.groupBy({ by: ['riskLevel'], _count: true }),
    ])

    return {
      total_reports: total,
      pending_review: pending,
      released_today: releasedToday,
      deleted_today: deletedToday,
      high_risk_count: highRisk,
      avg_risk_score: Math.round((scoreAgg._avg.riskScore ?? 0) * 10) / 10,
      by_level: byLevel.reduce((acc, r) => ({ ...acc, [r.riskLevel]: r._count }), {} as Record<string, number>),
      reports_per_day: [], // moved to /api/admin/analytics to keep this fast
    }
  })

  return ok(data)
}
