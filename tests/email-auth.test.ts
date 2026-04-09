import { describe, it, expect } from 'vitest'
import { parseEmailAuth, allAuthPass } from '@/lib/email-auth'

describe('parseEmailAuth', () => {
  it('parses Authentication-Results header with all pass', () => {
    const result = parseEmailAuth({
      'Authentication-Results': 'mx.google.com; spf=pass (google.com: sender); dkim=pass header.d=example.com; dmarc=pass',
    })
    expect(result.spf.status).toBe('pass')
    expect(result.dkim.status).toBe('pass')
    expect(result.dmarc.status).toBe('pass')
    expect(allAuthPass(result)).toBe(true)
  })

  it('parses mixed results', () => {
    const result = parseEmailAuth({
      'Authentication-Results': 'mx.example.com; spf=softfail; dkim=fail (bad sig); dmarc=none',
    })
    expect(result.spf.status).toBe('softfail')
    expect(result.dkim.status).toBe('fail')
    expect(result.dmarc.status).toBe('none')
    expect(allAuthPass(result)).toBe(false)
  })

  it('uses Received-SPF as fallback', () => {
    const result = parseEmailAuth({
      'Received-SPF': 'pass (domain of example.com designates 1.2.3.4 as permitted sender)',
    })
    expect(result.spf.status).toBe('pass')
  })

  it('detects DKIM-Signature presence as neutral', () => {
    const result = parseEmailAuth({
      'DKIM-Signature': 'v=1; a=rsa-sha256; d=example.com; ...',
    })
    expect(result.dkim.status).toBe('neutral')
  })

  it('returns unknown when no auth headers present', () => {
    const result = parseEmailAuth({
      'X-Mailer': 'Outlook 16.0',
      'Subject': 'Hello',
    })
    expect(result.spf.status).toBe('unknown')
    expect(result.dkim.status).toBe('unknown')
    expect(result.dmarc.status).toBe('unknown')
    expect(allAuthPass(result)).toBe(false)
  })

  it('parses raw header string format', () => {
    const raw = [
      'Authentication-Results: mx.example.com; spf=pass; dkim=pass; dmarc=fail (mismatch)',
      'X-Mailer: Test',
    ].join('\r\n')
    const result = parseEmailAuth(raw)
    expect(result.spf.status).toBe('pass')
    expect(result.dkim.status).toBe('pass')
    expect(result.dmarc.status).toBe('fail')
  })

  it('handles case insensitivity', () => {
    const result = parseEmailAuth({
      'AUTHENTICATION-RESULTS': 'mx.example.com; SPF=Pass; DKIM=Pass; DMARC=Pass',
    })
    expect(result.spf.status).toBe('pass')
    expect(result.dkim.status).toBe('pass')
    expect(result.dmarc.status).toBe('pass')
  })

  it('handles temperror and permerror', () => {
    const result = parseEmailAuth({
      'Authentication-Results': 'mx.example.com; spf=temperror; dkim=permerror; dmarc=none',
    })
    expect(result.spf.status).toBe('temperror')
    expect(result.dkim.status).toBe('permerror')
    expect(result.dmarc.status).toBe('none')
  })
})
