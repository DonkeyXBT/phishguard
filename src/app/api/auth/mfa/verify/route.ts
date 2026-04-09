import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { verifyTOTP } from '@/lib/mfa'
import { ok, err } from '@/lib/response'

/**
 * POST /api/auth/mfa/verify
 * Verifies a TOTP code against the stored secret and enables MFA.
 * Must be called after /mfa/setup to confirm the user has configured their app.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return err('Unauthorized', 401)

  if (user.mfaEnabled) return err('MFA is already enabled', 400)
  if (!user.mfaSecret) return err('Call /api/auth/mfa/setup first', 400)

  const { code } = await req.json()
  if (!code || typeof code !== 'string') return err('MFA code required')

  if (!verifyTOTP(user.mfaSecret, code)) {
    return err('Invalid MFA code. Check your authenticator app and try again.', 400)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mfaEnabled: true },
  })

  return ok({ message: 'MFA enabled successfully' })
}
