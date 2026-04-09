import { NextResponse } from 'next/server'

/**
 * Allowed origins read from ALLOWED_ORIGINS env var (comma-separated).
 * Falls back to '*' only in development when the var is not set.
 */
function getAllowedOrigins(): string[] {
  const raw = process.env.ALLOWED_ORIGINS
  if (raw) return raw.split(',').map(o => o.trim()).filter(Boolean)
  if (process.env.NODE_ENV !== 'production') return ['*']
  return []
}

/** Resolve whether a given request origin is allowed. Returns the origin or null. */
export function resolveOrigin(requestOrigin: string | null): string | null {
  const allowed = getAllowedOrigins()
  if (allowed.includes('*')) return '*'
  if (!requestOrigin) return null
  if (allowed.includes(requestOrigin)) return requestOrigin
  return null
}

/**
 * CORS headers are set by middleware (src/middleware.ts) for all /api/* routes,
 * so ok() / err() only need to produce the JSON response.
 */
export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}
