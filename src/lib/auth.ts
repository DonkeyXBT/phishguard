import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'
import { prisma } from './prisma'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'phishguard-dev-secret-change-in-production'
)

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createToken(payload: { sub: string; orgId: string; isAdmin: boolean }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET)
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, SECRET)
  return payload as { sub: string; orgId: string; isAdmin: boolean }
}

export async function getAuthUser(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  try {
    const payload = await verifyToken(auth.slice(7))
    const user = await prisma.user.findUnique({ where: { id: payload.sub } })
    return user
  } catch {
    return null
  }
}

export async function getApiKeyOrg(apiKey: string) {
  return prisma.organization.findUnique({ where: { apiKey } })
}

export function apiKeyFromRequest(req: NextRequest): string | null {
  return req.headers.get('x-api-key')
}
