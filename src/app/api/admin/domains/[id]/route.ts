import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)
  const { id } = await params

  await prisma.domainList.delete({ where: { id } })
  return ok({ message: 'Removed' })
}
