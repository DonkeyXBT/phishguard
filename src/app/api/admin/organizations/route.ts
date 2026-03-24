import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'
import { randomBytes } from 'crypto'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const orgs = await prisma.organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { users: true, reports: true } },
    },
  })

  return ok(orgs)
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const { name } = await req.json()
  if (!name?.trim()) return err('Organization name is required')

  const apiKey = randomBytes(20).toString('hex')
  const created = await prisma.organization.create({
    data: { name: name.trim(), apiKey },
  })
  const org = await prisma.organization.findUnique({
    where: { id: created.id },
    include: { _count: { select: { users: true, reports: true } } },
  })

  return ok(org, 201)
}
