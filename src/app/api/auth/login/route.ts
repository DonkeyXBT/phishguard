import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword, createToken } from '@/lib/auth'
import { verifyTOTP } from '@/lib/mfa'
import { ok, err } from '@/lib/response'
import { audit } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const { email, password, mfa_code } = await req.json()
  if (!email || !password) return err('Email and password required')

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || !user.isActive) return err('Invalid credentials', 401)

  const valid = await verifyPassword(password, user.hashedPassword)
  if (!valid) return err('Invalid credentials', 401)

  // If MFA is enabled, require a valid TOTP code
  if (user.mfaEnabled && user.mfaSecret) {
    if (!mfa_code) {
      return ok({ mfa_required: true, message: 'MFA code required' })
    }
    if (!verifyTOTP(user.mfaSecret, mfa_code)) {
      return err('Invalid MFA code', 401)
    }
  }

  audit(req, { userId: user.id, userEmail: user.email, action: 'auth.login', detail: 'Successful login' })

  const token = await createToken({ sub: user.id, orgId: user.orgId, isAdmin: user.isAdmin, role: user.role })
  return ok({ access_token: token, token_type: 'bearer' })
}
