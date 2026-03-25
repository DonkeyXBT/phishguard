export type AuthResult = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'unknown'

export interface HeaderAnalysis {
  spf:   AuthResult
  dkim:  AuthResult
  dmarc: AuthResult
  spfDetails:   string
  dkimDetails:  string
  dmarcDetails: string
  receivedHops: string[]
  raw: string
}

const RESULT_RE = /\b(pass|fail|softfail|neutral|none|permerror|temperror)\b/i

function extractResult(text: string): AuthResult {
  const m = text.match(RESULT_RE)
  if (!m) return 'unknown'
  const v = m[1].toLowerCase()
  if (v === 'pass') return 'pass'
  if (v === 'fail') return 'fail'
  if (v === 'softfail') return 'softfail'
  if (v === 'neutral') return 'neutral'
  if (v === 'none') return 'none'
  return 'unknown'
}

export function parseHeaders(raw: string): HeaderAnalysis {
  const result: HeaderAnalysis = {
    spf: 'unknown', dkim: 'unknown', dmarc: 'unknown',
    spfDetails: '', dkimDetails: '', dmarcDetails: '',
    receivedHops: [], raw,
  }

  if (!raw) return result

  // Unfold multi-line headers (RFC 2822 header folding)
  const unfolded = raw.replace(/\r?\n[ \t]+/g, ' ')
  const lines = unfolded.split(/\r?\n/)

  for (const line of lines) {
    const lower = line.toLowerCase()

    // Authentication-Results: contains dkim=, spf=, dmarc= results
    if (lower.startsWith('authentication-results:')) {
      const body = line.slice(line.indexOf(':') + 1)

      const dkimMatch = body.match(/dkim=(\S+)/i)
      if (dkimMatch) {
        result.dkim        = extractResult(dkimMatch[1])
        result.dkimDetails = dkimMatch[0]
      }

      const spfMatch = body.match(/spf=(\S+)/i)
      if (spfMatch) {
        result.spf        = extractResult(spfMatch[1])
        result.spfDetails = spfMatch[0]
      }

      const dmarcMatch = body.match(/dmarc=(\S+)/i)
      if (dmarcMatch) {
        result.dmarc        = extractResult(dmarcMatch[1])
        result.dmarcDetails = dmarcMatch[0]
      }
    }

    // Received-SPF: fallback for SPF when Authentication-Results is absent
    if (lower.startsWith('received-spf:') && result.spf === 'unknown') {
      const body = line.slice(line.indexOf(':') + 1).trim()
      result.spf        = extractResult(body)
      result.spfDetails = body.slice(0, 120)
    }

    // Received: headers — extract IP hops for chain display
    if (lower.startsWith('received:')) {
      const ipMatch = line.match(/\[(\d{1,3}(?:\.\d{1,3}){3})\]/)
      const byMatch = line.match(/by\s+([\w.-]+)/i)
      if (ipMatch || byMatch) {
        result.receivedHops.push(
          [ipMatch?.[1], byMatch?.[1]].filter(Boolean).join(' via ')
        )
      }
    }
  }

  return result
}

export function authLabel(r: AuthResult): string {
  return { pass: '✅ Pass', fail: '❌ Fail', softfail: '⚠️ Softfail', neutral: '➖ Neutral', none: '➖ None', unknown: '— Unknown' }[r] ?? '— Unknown'
}

export function authColor(r: AuthResult): string {
  return { pass: 'text-emerald-400', fail: 'text-red-400', softfail: 'text-amber-400', neutral: 'text-gray-400', none: 'text-gray-500', unknown: 'text-gray-600' }[r] ?? 'text-gray-600'
}
