import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'
import { randomBytes } from 'crypto'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)
  const { id } = await params

  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true, reports: true } },
      users: { select: { id: true, email: true, fullName: true, isAdmin: true, createdAt: true } },
    },
  })

  if (!org) return err('Not found', 404)
  return ok(org)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)
  const { id } = await params

  // Prevent deleting your own org
  if (user.orgId === id) return err('Cannot delete your own organization')

  await prisma.organization.delete({ where: { id } })
  return ok({ message: 'Organization deleted' })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)
  const { id } = await params
  const { action } = await req.json()

  if (action === 'rotate_key') {
    const org = await prisma.organization.update({
      where: { id },
      data: { apiKey: randomBytes(20).toString('hex') },
    })
    return ok({ message: 'API key rotated', api_key: org.apiKey })
  }

  return err('Unknown action')
}
