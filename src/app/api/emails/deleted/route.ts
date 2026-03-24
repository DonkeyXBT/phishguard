import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getApiKeyOrg, apiKeyFromRequest } from '@/lib/auth'
import { ok, err } from '@/lib/response'

// Returns reports marked as deleted by an admin in the last 30 days.
// Called by the extension to know which emails to remove from the user's inbox.
export async function GET(req: NextRequest) {
  const apiKey = apiKeyFromRequest(req)
  if (!apiKey) return err('API key required', 401)
  const org = await getApiKeyOrg(apiKey)
  if (!org) return err('Invalid API key', 401)

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const deletions = await prisma.emailReport.findMany({
    where: {
      orgId: org.id,
      status: 'deleted',
      reviewedAt: { gte: since },
    },
    select: { id: true, subject: true, sender: true, reviewedAt: true },
    orderBy: { reviewedAt: 'desc' },
    take: 100,
  })

  return ok(deletions)
}
