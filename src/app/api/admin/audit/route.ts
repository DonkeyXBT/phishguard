import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action') || undefined
  const userId = searchParams.get('user_id') || undefined
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50'), 1), 200)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0)

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(userId ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({
      where: {
        ...(action ? { action: { contains: action } } : {}),
        ...(userId ? { userId } : {}),
      },
    }),
  ])

  return ok({ logs, total, limit, offset })
}
