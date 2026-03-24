import { NextRequest, NextResponse } from 'next/server'

// Handle CORS preflight for all /api/* routes.
// Actual responses include CORS headers via response.ts ok()/err() helpers.
export function middleware(req: NextRequest) {
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
      },
    })
  }
}

export const config = { matcher: '/api/:path*' }
