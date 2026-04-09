import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return err('Unauthorized', 401)
  return ok({ id: user.id, email: user.email, fullName: user.fullName, isAdmin: user.isAdmin, role: user.role, orgId: user.orgId, mfaEnabled: user.mfaEnabled })
}
