/**
 * Tiny in-memory TTL cache for expensive aggregation queries.
 *
 * On Vercel, function instances are reused while warm, so this avoids
 * re-running heavy SQL on every dashboard refresh. Cache is cleared
 * automatically when the function cold-starts.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const hit = store.get(key) as CacheEntry<T> | undefined
  if (hit && hit.expiresAt > now) {
    return hit.value
  }
  const value = await loader()
  store.set(key, { value, expiresAt: now + ttlSeconds * 1000 })
  return value
}

export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}
