import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser, verifyPassword } from '@/lib/auth'
import { ok, err } from '@/lib/response'

/**
 * POST /api/auth/mfa/disable
 * Disables MFA. Requires the user's password for confirmation.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return err('Unauthorized', 401)

  if (!user.mfaEnabled) return err('MFA is not enabled', 400)

  const { password } = await req.json()
  if (!password) return err('Password required for MFA disable')

  const valid = await verifyPassword(password, user.hashedPassword)
  if (!valid) return err('Invalid password', 401)

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: false, mfaSecret: null },
  })

  return ok({ message: 'MFA disabled' })
}
