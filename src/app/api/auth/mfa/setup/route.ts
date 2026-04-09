import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { generateSecret, buildOtpAuthUri } from '@/lib/mfa'
import { ok, err } from '@/lib/response'

/**
 * POST /api/auth/mfa/setup
 * Generates a new TOTP secret and returns the otpauth URI.
 * The secret is stored but MFA is NOT enabled until verified via /mfa/verify.
 */
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return err('Unauthorized', 401)

  if (user.mfaEnabled) return err('MFA is already enabled', 400)

  const secret = generateSecret()
  await prisma.user.update({
    where: { id: user.id },
    data: { mfaSecret: secret },
  })

  const uri = buildOtpAuthUri(secret, user.email)

  return ok({ secret, otpauth_uri: uri })
}
