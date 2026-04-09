import { describe, it, expect } from 'vitest'
import { checkRateLimit, rateLimitForPath } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  it('allows requests within the limit', () => {
    const result = checkRateLimit('test-allow', 'user1', { windowMs: 60_000, max: 5 })
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.limit).toBe(5)
  })

  it('blocks requests that exceed the limit', () => {
    const store = 'test-block'
    for (let i = 0; i < 3; i++) {
      checkRateLimit(store, 'user2', { windowMs: 60_000, max: 3 })
    }
    const result = checkRateLimit(store, 'user2', { windowMs: 60_000, max: 3 })
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('tracks different keys independently', () => {
    const store = 'test-independent'
    for (let i = 0; i < 2; i++) {
      checkRateLimit(store, 'userA', { windowMs: 60_000, max: 2 })
    }
    const blockedA = checkRateLimit(store, 'userA', { windowMs: 60_000, max: 2 })
    const allowedB = checkRateLimit(store, 'userB', { windowMs: 60_000, max: 2 })
    expect(blockedA.allowed).toBe(false)
    expect(allowedB.allowed).toBe(true)
  })

  it('uses default config when none provided', () => {
    const result = checkRateLimit('test-default', 'user-default')
    expect(result.allowed).toBe(true)
    expect(result.limit).toBe(60) // default max
  })
})

describe('rateLimitForPath', () => {
  it('returns specific config for exact path match', () => {
    const config = rateLimitForPath('/api/auth/login')
    expect(config.max).toBe(10)
    expect(config.windowMs).toBe(300_000) // 5 min
  })

  it('returns prefix-matched config for admin routes', () => {
    const config = rateLimitForPath('/api/admin/queue')
    expect(config.max).toBe(120)
  })

  it('returns default config for unknown paths', () => {
    const config = rateLimitForPath('/api/unknown/route')
    expect(config.max).toBe(60)
  })

  it('matches setup endpoint', () => {
    const config = rateLimitForPath('/api/auth/setup')
    expect(config.max).toBe(3)
  })
})
