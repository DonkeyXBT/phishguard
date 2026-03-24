import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const domains = await prisma.domainList.findMany({
    orderBy: { createdAt: 'asc' },
  })

  return ok({
    whitelist: domains.filter(d => d.listType === 'whitelist'),
    blacklist: domains.filter(d => d.listType === 'blacklist'),
  })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const { domain, listType, reason } = await req.json()

  if (!domain?.trim()) return err('Domain is required')
  if (!['whitelist', 'blacklist'].includes(listType)) return err('listType must be whitelist or blacklist')

  // Normalise: strip protocol, www, trailing slashes, lowercase
  const clean = domain.trim().toLowerCase()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')

  try {
    const entry = await prisma.domainList.create({
      data: { domain: clean, listType, reason: reason?.trim() || null },
    })
    return ok(entry, 201)
  } catch {
    return err(`${clean} is already on the ${listType}`)
  }
}
