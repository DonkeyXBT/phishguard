/**
 * In-memory sliding-window rate limiter.
 *
 * Each key (IP or API-key) gets a window of `windowMs` milliseconds
 * and is allowed up to `max` requests within that window.
 */

interface RateLimitEntry {
  timestamps: number[]
}

interface RateLimitConfig {
  /** Window size in milliseconds (default 60 000 = 1 min) */
  windowMs?: number
  /** Max requests per window (default 60) */
  max?: number
}

const stores = new Map<string, Map<string, RateLimitEntry>>()

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) stores.set(name, new Map())
  return stores.get(name)!
}

/** Periodically purge expired entries to prevent memory leak */
setInterval(() => {
  const now = Date.now()
  stores.forEach(store => {
    store.forEach((entry, key) => {
      entry.timestamps = entry.timestamps.filter((t: number) => now - t < 120_000)
      if (entry.timestamps.length === 0) store.delete(key)
    })
  })
}, 60_000)

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  retryAfterMs: number
}

export function checkRateLimit(
  storeName: string,
  key: string,
  config: RateLimitConfig = {},
): RateLimitResult {
  const windowMs = config.windowMs ?? 60_000
  const max = config.max ?? 60
  const now = Date.now()
  const store = getStore(storeName)

  let entry = store.get(key)
  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Remove timestamps outside the current window
  entry.timestamps = entry.timestamps.filter(t => now - t < windowMs)

  if (entry.timestamps.length >= max) {
    const oldest = entry.timestamps[0]
    const retryAfterMs = windowMs - (now - oldest)
    return { allowed: false, remaining: 0, limit: max, retryAfterMs }
  }

  entry.timestamps.push(now)
  return { allowed: true, remaining: max - entry.timestamps.length, limit: max, retryAfterMs: 0 }
}

/**
 * Pre-configured rate limit tiers.
 * Use the route path prefix to pick the right tier.
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Auth endpoints — strict to prevent brute-force
  '/api/auth/login':  { windowMs: 60_000 * 5, max: 10 },
  '/api/auth/setup':  { windowMs: 60_000 * 60, max: 3 },
  '/api/auth/mfa':    { windowMs: 60_000, max: 10 },

  // Public analysis / report endpoints
  '/api/emails/analyze': { windowMs: 60_000, max: 30 },
  '/api/emails/report':  { windowMs: 60_000, max: 20 },

  // Admin endpoints — moderate limits
  '/api/admin': { windowMs: 60_000, max: 120 },

  // Fallback for everything else
  default: { windowMs: 60_000, max: 60 },
}

/** Pick the most-specific rate limit config for a given pathname. */
export function rateLimitForPath(pathname: string): RateLimitConfig {
  // Check exact matches first, then prefix matches
  if (RATE_LIMITS[pathname]) return RATE_LIMITS[pathname]
  for (const prefix of Object.keys(RATE_LIMITS)) {
    if (prefix !== 'default' && pathname.startsWith(prefix)) return RATE_LIMITS[prefix]
  }
  return RATE_LIMITS.default
}
