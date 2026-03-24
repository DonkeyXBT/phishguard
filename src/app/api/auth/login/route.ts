import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createToken } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return err('Email and password required')

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) return err('Invalid credentials', 401)

  const valid = await verifyPassword(password, user.hashedPassword)
  if (!valid) return err('Invalid credentials', 401)

  const token = await createToken({ sub: user.id, orgId: user.orgId, isAdmin: user.isAdmin })
  return ok({ access_token: token, token_type: 'bearer' })
}
