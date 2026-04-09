/**
 * Parse SPF, DKIM, and DMARC results from email headers.
 *
 * Most email providers include an "Authentication-Results" header that
 * aggregates all three checks.  We also look at "Received-SPF" and the
 * presence of "DKIM-Signature" as fallback signals.
 */

export type AuthStatus = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'temperror' | 'permerror' | 'unknown'

export interface EmailAuthResult {
  spf:   { status: AuthStatus; detail: string }
  dkim:  { status: AuthStatus; detail: string }
  dmarc: { status: AuthStatus; detail: string }
}

const STATUS_VALUES: AuthStatus[] = ['pass', 'fail', 'softfail', 'neutral', 'none', 'temperror', 'permerror']

function toStatus(raw: string | undefined): AuthStatus {
  if (!raw) return 'unknown'
  const lower = raw.toLowerCase().trim()
  return (STATUS_VALUES.find(s => s === lower) ?? 'unknown') as AuthStatus
}

/**
 * Extract a status for a given method from the Authentication-Results header.
 * The header format is roughly: `<server>; spf=pass (...); dkim=pass (...); dmarc=pass (...)`
 */
function parseAuthResultsField(authResults: string, method: string): { status: AuthStatus; detail: string } {
  // Match patterns like "spf=pass", "dkim=fail (reason)", "dmarc=none"
  const regex = new RegExp(`${method}\\s*=\\s*(\\w+)(?:\\s*\\(([^)]+)\\))?`, 'i')
  const match = authResults.match(regex)
  if (match) {
    return { status: toStatus(match[1]), detail: match[2]?.trim() || `${method}=${match[1]}` }
  }
  return { status: 'unknown', detail: `${method} not found in Authentication-Results` }
}

/**
 * Parse the Received-SPF header (fallback when Authentication-Results is absent).
 * Format: `pass (domain of example.com designates 1.2.3.4 as permitted sender) ...`
 */
function parseReceivedSpf(header: string): { status: AuthStatus; detail: string } {
  const match = header.match(/^(\w+)\s*(?:\(([^)]+)\))?/i)
  if (match) {
    return { status: toStatus(match[1]), detail: match[2]?.trim() || `SPF ${match[1]}` }
  }
  return { status: 'unknown', detail: 'Could not parse Received-SPF' }
}

/**
 * Analyse raw email headers (as a flat string or pre-parsed object) and return
 * SPF / DKIM / DMARC authentication results.
 */
export function parseEmailAuth(headers: Record<string, string> | string): EmailAuthResult {
  // Normalise to a flat lowercase-keyed map
  let headerMap: Record<string, string>

  if (typeof headers === 'string') {
    headerMap = {}
    // RFC 2822-style headers: "Key: value\r\n"
    const lines = headers.replace(/\r\n\s+/g, ' ').split(/\r?\n/)
    for (const line of lines) {
      const idx = line.indexOf(':')
      if (idx < 1) continue
      const key = line.slice(0, idx).trim().toLowerCase()
      const val = line.slice(idx + 1).trim()
      // Concatenate if multiple values (e.g. multiple Authentication-Results)
      headerMap[key] = headerMap[key] ? `${headerMap[key]}; ${val}` : val
    }
  } else {
    headerMap = {}
    for (const [k, v] of Object.entries(headers)) {
      headerMap[k.toLowerCase()] = v
    }
  }

  const result: EmailAuthResult = {
    spf:   { status: 'unknown', detail: 'No SPF data in headers' },
    dkim:  { status: 'unknown', detail: 'No DKIM data in headers' },
    dmarc: { status: 'unknown', detail: 'No DMARC data in headers' },
  }

  // --- Authentication-Results (primary source) ---
  const authResults = headerMap['authentication-results']
  if (authResults) {
    result.spf = parseAuthResultsField(authResults, 'spf')
    result.dkim = parseAuthResultsField(authResults, 'dkim')
    result.dmarc = parseAuthResultsField(authResults, 'dmarc')
  }

  // --- Fallback: Received-SPF header ---
  if (result.spf.status === 'unknown' && headerMap['received-spf']) {
    result.spf = parseReceivedSpf(headerMap['received-spf'])
  }

  // --- Fallback: DKIM-Signature presence ---
  if (result.dkim.status === 'unknown' && headerMap['dkim-signature']) {
    result.dkim = { status: 'neutral', detail: 'DKIM-Signature header present but not verified' }
  }

  return result
}

/** Quick check — did all three mechanisms pass? */
export function allAuthPass(r: EmailAuthResult): boolean {
  return r.spf.status === 'pass' && r.dkim.status === 'pass' && r.dmarc.status === 'pass'
}
