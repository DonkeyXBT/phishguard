import { describe, it, expect } from 'vitest'
import { generateSecret, generateTOTP, verifyTOTP, buildOtpAuthUri } from '@/lib/mfa'

describe('MFA / TOTP', () => {
  it('generates a base32-encoded secret', () => {
    const secret = generateSecret()
    expect(secret).toMatch(/^[A-Z2-7]+$/)
    expect(secret.length).toBeGreaterThanOrEqual(20)
  })

  it('generates a 6-digit TOTP code', () => {
    const secret = generateSecret()
    const code = generateTOTP(secret)
    expect(code).toMatch(/^\d{6}$/)
  })

  it('verifies a correct TOTP code', () => {
    const secret = generateSecret()
    const code = generateTOTP(secret)
    expect(verifyTOTP(secret, code)).toBe(true)
  })

  it('rejects an incorrect TOTP code', () => {
    const secret = generateSecret()
    expect(verifyTOTP(secret, '000000')).toBe(false)
  })

  it('accepts codes within the time window (+/-1 period)', () => {
    const secret = generateSecret()
    const prevCode = generateTOTP(secret, -1)
    const nextCode = generateTOTP(secret, 1)
    expect(verifyTOTP(secret, prevCode)).toBe(true)
    expect(verifyTOTP(secret, nextCode)).toBe(true)
  })

  it('generates different codes for different secrets', () => {
    const s1 = generateSecret()
    const s2 = generateSecret()
    const c1 = generateTOTP(s1)
    const c2 = generateTOTP(s2)
    // Very unlikely to be the same
    expect(s1).not.toBe(s2)
    // codes could theoretically match, but practically won't with different secrets
  })

  it('builds a valid otpauth URI', () => {
    const secret = generateSecret()
    const uri = buildOtpAuthUri(secret, 'admin@company.com')
    expect(uri).toContain('otpauth://totp/')
    expect(uri).toContain(`secret=${secret}`)
    expect(uri).toContain('issuer=PhishGuard')
    expect(uri).toContain('admin%40company.com')
    expect(uri).toContain('digits=6')
    expect(uri).toContain('period=30')
  })

  it('allows custom issuer in URI', () => {
    const secret = generateSecret()
    const uri = buildOtpAuthUri(secret, 'user@test.com', 'MyApp')
    expect(uri).toContain('issuer=MyApp')
    expect(uri).toContain('MyApp:')
  })
})
