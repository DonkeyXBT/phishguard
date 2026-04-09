/**
 * Resolve shortened URLs by following redirects (HEAD requests).
 *
 * Returns the final URL after all redirects, or the original URL on error.
 */

const SHORTENER_DOMAINS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'buff.ly',
  'short.link', 'rb.gy', 'cutt.ly', 'is.gd', 'v.gd', 'shorturl.at',
  'tiny.cc', 'lnkd.in', 'soo.gd', 'rebrand.ly',
])

const MAX_REDIRECTS = 10
const TIMEOUT_MS = 5_000

export function isShortUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return SHORTENER_DOMAINS.has(host)
  } catch {
    return false
  }
}

/**
 * Follow redirects on a URL and return the final destination.
 * Uses HEAD requests to avoid downloading content.
 */
export async function resolveUrl(url: string): Promise<{ finalUrl: string; chain: string[]; error?: string }> {
  const chain: string[] = [url]
  let current = url

  for (let i = 0; i < MAX_REDIRECTS; i++) {
    try {
      const res = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'PhishGuard-URLResolver/1.0' },
      })

      const location = res.headers.get('location')
      if (!location || (res.status < 300 || res.status >= 400)) {
        // No redirect — we've arrived
        return { finalUrl: current, chain }
      }

      // Handle relative redirects
      const next = location.startsWith('http')
        ? location
        : new URL(location, current).href

      chain.push(next)
      current = next
    } catch (e) {
      return { finalUrl: current, chain, error: String(e) }
    }
  }

  return { finalUrl: current, chain, error: 'Max redirects exceeded' }
}

/**
 * Resolve multiple URLs in parallel with a concurrency limit.
 */
export async function resolveUrls(
  urls: string[],
  concurrency = 5,
): Promise<Map<string, { finalUrl: string; chain: string[]; error?: string }>> {
  const results = new Map<string, { finalUrl: string; chain: string[]; error?: string }>()
  const queue = [...urls]

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift()!
      results.set(url, await resolveUrl(url))
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker())
  await Promise.all(workers)
  return results
}
