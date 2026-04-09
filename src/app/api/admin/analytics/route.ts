import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const { searchParams } = new URL(req.url)
  const days = Math.min(parseInt(searchParams.get('days') ?? '30'), 365)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [
    reportsPerDay,
    byLevel,
    bySource,
    topSenderDomains,
    topSignals,
    avgScorePerDay,
    recentCritical,
  ] = await Promise.all([
    // Reports per day
    prisma.$queryRaw<Array<{ day: string; count: bigint }>>`
      SELECT DATE_TRUNC('day', "reported_at")::text AS day, COUNT(*)::bigint AS count
      FROM email_reports WHERE reported_at >= ${since}
      GROUP BY 1 ORDER BY 1
    `,

    // By risk level
    prisma.emailReport.groupBy({
      by: ['riskLevel'],
      where: { reportedAt: { gte: since } },
      _count: true,
    }),

    // By source
    prisma.emailReport.groupBy({
      by: ['source'],
      where: { reportedAt: { gte: since } },
      _count: true,
    }),

    // Top sender domains (potential impersonated brands)
    prisma.$queryRaw<Array<{ domain: string; count: bigint }>>`
      SELECT sender_domain AS domain, COUNT(*)::bigint AS count
      FROM email_reports
      WHERE reported_at >= ${since} AND sender_domain IS NOT NULL
      GROUP BY sender_domain ORDER BY count DESC LIMIT 15
    `,

    // Top triggered signals (parse from JSON signals array)
    prisma.$queryRaw<Array<{ code: string; count: bigint }>>`
      SELECT signal->>'code' AS code, COUNT(*)::bigint AS count
      FROM email_reports, jsonb_array_elements(signals::jsonb) AS signal
      WHERE reported_at >= ${since}
      GROUP BY signal->>'code' ORDER BY count DESC LIMIT 15
    `,

    // Average risk score per day
    prisma.$queryRaw<Array<{ day: string; avg_score: number }>>`
      SELECT DATE_TRUNC('day', "reported_at")::text AS day, ROUND(AVG(risk_score)::numeric, 1) AS avg_score
      FROM email_reports WHERE reported_at >= ${since}
      GROUP BY 1 ORDER BY 1
    `,

    // Recent critical reports
    prisma.emailReport.findMany({
      where: { riskLevel: 'critical', reportedAt: { gte: since } },
      orderBy: { reportedAt: 'desc' },
      take: 10,
      select: { id: true, subject: true, sender: true, riskScore: true, reportedAt: true, status: true },
    }),
  ])

  return ok({
    period_days: days,
    reports_per_day: reportsPerDay.map(r => ({ day: r.day, count: Number(r.count) })),
    by_level: byLevel.reduce((acc, r) => ({ ...acc, [r.riskLevel]: r._count }), {} as Record<string, number>),
    by_source: bySource.reduce((acc, r) => ({ ...acc, [r.source]: r._count }), {} as Record<string, number>),
    top_sender_domains: topSenderDomains.map(r => ({ domain: r.domain, count: Number(r.count) })),
    top_signals: topSignals.map(r => ({ code: r.code, count: Number(r.count) })),
    avg_score_per_day: avgScorePerDay.map(r => ({ day: r.day, avg_score: Number(r.avg_score) })),
    recent_critical: recentCritical,
  })
}
