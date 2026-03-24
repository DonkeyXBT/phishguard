import { NextResponse } from 'next/server'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status, headers: CORS })
}

export function err(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: CORS })
}
