import { NextRequest } from 'next/server'
import { prisma } from './prisma'

export interface AuditEntry {
  userId?: string | null
  userEmail?: string | null
  action: string
  resource?: string | null
  detail?: string | null
}

/**
 * Write an audit log entry.
 * Fire-and-forget — never throws, never blocks the response.
 */
export function audit(req: NextRequest, entry: AuditEntry): void {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null
  const userAgent = req.headers.get('user-agent') ?? null

  // Non-blocking — intentionally not awaited
  prisma.auditLog
    .create({
      data: {
        userId: entry.userId ?? null,
        userEmail: entry.userEmail ?? null,
        action: entry.action,
        resource: entry.resource ?? null,
        detail: entry.detail ?? null,
        ip,
        userAgent,
      },
    })
    .catch(() => {
      // Swallow — audit failures must not break the main flow
    })
}
