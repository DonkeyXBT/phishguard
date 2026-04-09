import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { ok, err } from '@/lib/response'

// Called manually by admins or automatically by Vercel cron (daily at 02:00 UTC)
export async function POST(req: NextRequest) {
  // Accept admin JWT or Vercel cron secret
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization') ?? ''
  const isCron     = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const user = await getAuthUser(req)
    if (!user || !user.isAdmin) return err('Admin required', 403)
  }

  const results: Record<string, { added: number; error?: string }> = {}

  // ── OpenPhish community feed ──────────────────────────────────────────────
  try {
    const res = await fetch('https://openphish.com/feed.txt', {
      headers: { 'User-Agent': 'PhishGuard-ThreatIntel/1.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const text = await res.text()
    const domains = Array.from(new Set(
      text.split('\n')
        .map(line => {
          try {
            const url = new URL(line.trim())
            return url.hostname.toLowerCase().replace(/^www\./, '')
          } catch { return null }
        })
        .filter((d): d is string => !!d && d.length > 3 && d.includes('.'))
    ))

    // Bulk upsert — skip duplicates (already on list from any source)
    const data = domains.map(domain => ({
      domain,
      listType: 'blacklist' as const,
      source:   'openphish',
      reason:   'OpenPhish community threat feed',
    }))

    const { count } = await prisma.domainList.createMany({
      data,
      skipDuplicates: true,
    })
    results.openphish = { added: count }
  } catch (e) {
    results.openphish = { added: 0, error: String(e) }
  }

  // ── PhishTank (free, no-key tier via data dump) ───────────────────────────
  try {
    const res = await fetch('https://data.phishtank.com/data/online-valid.csv', {
      headers: { 'User-Agent': 'phishguard-bot/1.0' },
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const text = await res.text()
    const lines = text.split('\n').slice(1) // skip CSV header
    const domains = Array.from(new Set(
      lines.map(line => {
        const url = line.split(',')[1]?.replace(/"/g, '').trim()
        try {
          return new URL(url).hostname.toLowerCase().replace(/^www\./, '')
        } catch { return null }
      })
      .filter((d): d is string => !!d && d.length > 3 && d.includes('.'))
    ))

    const data = domains.map(domain => ({
      domain,
      listType: 'blacklist' as const,
      source:   'phishtank',
      reason:   'PhishTank verified phishing database',
    }))

    const { count } = await prisma.domainList.createMany({
      data,
      skipDuplicates: true,
    })
    results.phishtank = { added: count }
  } catch (e) {
    results.phishtank = { added: 0, error: String(e) }
  }

  // ── URLhaus (abuse.ch) ─────────────────────────────────────────────────
  try {
    const res = await fetch('https://urlhaus.abuse.ch/downloads/text_online/', {
      headers: { 'User-Agent': 'PhishGuard-ThreatIntel/1.0' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const text = await res.text()
    const domains = Array.from(new Set(
      text.split('\n')
        .filter(line => line.startsWith('http'))
        .map(line => {
          try {
            return new URL(line.trim()).hostname.toLowerCase().replace(/^www\./, '')
          } catch { return null }
        })
        .filter((d): d is string => !!d && d.length > 3 && d.includes('.'))
    ))

    const data = domains.map(domain => ({
      domain,
      listType: 'blacklist' as const,
      source:   'urlhaus',
      reason:   'URLhaus (abuse.ch) active threat feed',
    }))

    const { count } = await prisma.domainList.createMany({
      data,
      skipDuplicates: true,
    })
    results.urlhaus = { added: count }
  } catch (e) {
    results.urlhaus = { added: 0, error: String(e) }
  }

  const totalAdded = Object.values(results).reduce((s, r) => s + r.added, 0)
  return ok({ synced_at: new Date().toISOString(), total_added: totalAdded, sources: results })
}
