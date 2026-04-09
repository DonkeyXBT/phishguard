import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { resolveOrigin } from '@/lib/response'

describe('resolveOrigin', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns null when no origins are allowed in production', () => {
    // ALLOWED_ORIGINS not set, production mode
    delete process.env.ALLOWED_ORIGINS
    expect(resolveOrigin('https://evil.com')).toBeNull()
  })

  it('returns the origin when it is in the allow list', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://myapp.com,https://admin.myapp.com')
    expect(resolveOrigin('https://myapp.com')).toBe('https://myapp.com')
    expect(resolveOrigin('https://admin.myapp.com')).toBe('https://admin.myapp.com')
  })

  it('returns null for origins not in the allow list', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://myapp.com')
    expect(resolveOrigin('https://evil.com')).toBeNull()
  })

  it('returns * in development when ALLOWED_ORIGINS is not set', () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.ALLOWED_ORIGINS
    expect(resolveOrigin('https://localhost:3000')).toBe('*')
  })

  it('returns * when ALLOWED_ORIGINS includes *', () => {
    vi.stubEnv('ALLOWED_ORIGINS', '*')
    expect(resolveOrigin('https://anything.com')).toBe('*')
  })

  it('returns null when request origin is null', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://myapp.com')
    expect(resolveOrigin(null)).toBeNull()
  })
})
