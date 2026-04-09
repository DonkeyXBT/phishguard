import { NextRequest, NextResponse } from 'next/server'
import { resolveOrigin } from '@/lib/response'
import { checkRateLimit, rateLimitForPath } from '@/lib/rate-limit'

/** Maximum request body size in bytes (1 MB). */
const MAX_BODY_BYTES = 1_048_576

export function middleware(req: NextRequest) {
  const origin = resolveOrigin(req.headers.get('origin'))

  // ── CORS preflight ────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    }
    if (origin) headers['Access-Control-Allow-Origin'] = origin
    return new NextResponse(null, { status: 204, headers })
  }

  // ── Body size limit (POST / PUT / PATCH) ──────────────────────────────────
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: `Request body too large. Maximum is ${MAX_BODY_BYTES} bytes.` },
      { status: 413 },
    )
  }

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  const apiKey = req.headers.get('x-api-key')
  const key = apiKey ?? ip

  const pathname = req.nextUrl.pathname
  const config = rateLimitForPath(pathname)
  const result = checkRateLimit(pathname, key, config)

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)),
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  // ── Continue with rate limit headers ──────────────────────────────────────
  const response = NextResponse.next()
  response.headers.set('X-RateLimit-Limit', String(result.limit))
  response.headers.set('X-RateLimit-Remaining', String(result.remaining))
  if (origin) response.headers.set('Access-Control-Allow-Origin', origin)
  return response
}

export const config = { matcher: '/api/:path*' }
