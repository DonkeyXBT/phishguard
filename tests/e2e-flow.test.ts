/**
 * End-to-end test suite for the core PhishGuard flow.
 *
 * Tests the full pipeline: analyze → report → review using the library
 * functions directly (no HTTP server needed — unit-style E2E).
 */

import { describe, it, expect } from 'vitest'
import { analyzeEmail } from '@/lib/analyzer'
import { parseEmailAuth } from '@/lib/email-auth'
import { isShortUrl } from '@/lib/url-resolver'
import { detectEncryption } from '@/lib/encrypted-email'
import { getClassifier } from '@/lib/ml-scorer'
import { hashFile } from '@/lib/attachment-sandbox'
import { checkRateLimit } from '@/lib/rate-limit'
import { hasPermission, hasRole, effectiveRole } from '@/lib/permissions'

describe('E2E: Full phishing analysis pipeline', () => {
  it('processes a legitimate email end-to-end', () => {
    const result = analyzeEmail({
      sender: 'colleague@mycompany.com',
      subject: 'Meeting tomorrow at 3pm',
      bodyText: 'Hey, just confirming our schedule for tomorrow. See you at the meeting!',
      rawHeaders: {
        'Authentication-Results': 'mx.mycompany.com; spf=pass; dkim=pass; dmarc=pass',
      },
    })

    expect(result.riskLevel).toBe('low')
    expect(result.riskScore).toBeLessThan(25)
    expect(result.emailAuth).not.toBeNull()
    expect(result.emailAuth!.spf.status).toBe('pass')
    expect(result.mlScore).not.toBeNull()
    expect(result.signals.filter(s => s.severity === 'critical')).toHaveLength(0)
  })

  it('processes a phishing email end-to-end', () => {
    const result = analyzeEmail({
      sender: '"PayPal Security" <security@paypa1.com>',
      replyTo: 'scammer@evil.xyz',
      subject: 'Your account has been suspended - Action required immediately',
      bodyText: 'Your account will be terminated unless you verify your password immediately. Enter your password and credit card number.',
      bodyHtml: '<a href="https://bit.ly/steal123">https://paypal.com/verify</a>',
      attachments: [{ filename: 'invoice.exe', contentType: 'application/octet-stream' }],
      rawHeaders: {
        'Authentication-Results': 'mx.example.com; spf=fail; dkim=fail; dmarc=fail',
      },
    })

    expect(result.riskLevel).toBe('critical')
    expect(result.riskScore).toBe(100) // Capped at 100
    expect(result.signals.length).toBeGreaterThan(5)

    // Should detect multiple signal types
    const codes = result.signals.map(s => s.code)
    expect(codes).toContain('DISPLAY_NAME_SPOOF')
    expect(codes).toContain('REPLY_TO_MISMATCH')
    expect(codes).toContain('URGENCY_LANGUAGE')
    expect(codes).toContain('CREDENTIAL_REQUEST')
    expect(codes).toContain('SHORTENED_URL')
    expect(codes).toContain('DANGEROUS_ATTACHMENT_TYPE')
    expect(codes).toContain('SPF_FAIL')
    expect(codes).toContain('DKIM_FAIL')
    expect(codes).toContain('DMARC_FAIL')

    // Email auth should show failures
    expect(result.emailAuth!.spf.status).toBe('fail')
    expect(result.emailAuth!.dkim.status).toBe('fail')
    expect(result.emailAuth!.dmarc.status).toBe('fail')

    // Links should be flagged
    expect(result.links[0].isSuspicious).toBe(true)

    // Attachments should be flagged
    expect(result.attachments[0].isSuspicious).toBe(true)
  })

  it('handles encrypted PGP email', () => {
    const result = analyzeEmail({
      sender: 'secure@company.com',
      subject: 'Encrypted message',
      bodyText: '-----BEGIN PGP MESSAGE-----\nhQEMA...\n-----END PGP MESSAGE-----',
    })

    expect(result.signals.some(s => s.code === 'ENCRYPTED_BODY')).toBe(true)
  })

  it('handles S/MIME email via attachment', () => {
    const encryption = detectEncryption({
      attachments: [{ filename: 'smime.p7m', contentType: 'application/pkcs7-mime' }],
    })
    expect(encryption.isEncrypted).toBe(true)
    expect(encryption.type).toBe('smime')
  })
})

describe('E2E: ML classifier integration', () => {
  it('scores phishing text higher than legitimate text', () => {
    const classifier = getClassifier()

    const phishScore = classifier.score(
      'Your account has been suspended. Verify your password immediately to avoid termination. Click here to confirm your identity.'
    )
    const hamScore = classifier.score(
      'Hi team, just a reminder about our project meeting tomorrow at 3pm. Please review the attached document before the call.'
    )

    expect(phishScore.probability).toBeGreaterThan(hamScore.probability)
    expect(phishScore.probability).toBeGreaterThan(0.5)
    expect(hamScore.probability).toBeLessThan(0.5)
  })

  it('trains incrementally', () => {
    const classifier = getClassifier()
    const before = classifier.score('special phishguard test token xyzzy')

    classifier.train('special phishguard test token xyzzy is very dangerous', true)
    const after = classifier.score('special phishguard test token xyzzy')

    expect(after.probability).toBeGreaterThanOrEqual(before.probability)
  })
})

describe('E2E: URL resolution detection', () => {
  it('identifies shortened URLs', () => {
    expect(isShortUrl('https://bit.ly/abc123')).toBe(true)
    expect(isShortUrl('https://tinyurl.com/xyz')).toBe(true)
    expect(isShortUrl('https://google.com')).toBe(false)
    expect(isShortUrl('https://company.com/page')).toBe(false)
  })
})

describe('E2E: Attachment sandboxing', () => {
  it('hashes a buffer correctly', () => {
    const buf = Buffer.from('test content')
    const hash = hashFile(buf)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    // Same content = same hash
    expect(hashFile(Buffer.from('test content'))).toBe(hash)
  })
})

describe('E2E: Rate limiting flow', () => {
  it('allows then blocks under pressure', () => {
    const store = 'e2e-ratelimit'
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(store, 'e2e-user', { windowMs: 60_000, max: 5 }).allowed).toBe(true)
    }
    expect(checkRateLimit(store, 'e2e-user', { windowMs: 60_000, max: 5 }).allowed).toBe(false)
  })
})

describe('E2E: Permissions system', () => {
  it('super_admin has all permissions', () => {
    const user = { role: 'super_admin', isAdmin: true }
    expect(hasPermission(user, 'user.manage')).toBe(true)
    expect(hasPermission(user, 'org.manage')).toBe(true)
    expect(hasPermission(user, 'settings.manage')).toBe(true)
    expect(hasRole(user, 'super_admin')).toBe(true)
  })

  it('viewer can only view', () => {
    const user = { role: 'viewer', isAdmin: false }
    expect(hasPermission(user, 'dashboard.view')).toBe(true)
    expect(hasPermission(user, 'queue.view')).toBe(true)
    expect(hasPermission(user, 'report.review')).toBe(false)
    expect(hasPermission(user, 'domain.manage')).toBe(false)
    expect(hasPermission(user, 'org.manage')).toBe(false)
  })

  it('analyst can review but not manage', () => {
    const user = { role: 'analyst', isAdmin: false }
    expect(hasPermission(user, 'report.review')).toBe(true)
    expect(hasPermission(user, 'domain.view')).toBe(true)
    expect(hasPermission(user, 'domain.manage')).toBe(false)
    expect(hasPermission(user, 'org.manage')).toBe(false)
  })

  it('isAdmin=true bumps viewer to admin', () => {
    const user = { role: 'viewer', isAdmin: true }
    expect(effectiveRole(user)).toBe('admin')
    expect(hasPermission(user, 'domain.manage')).toBe(true)
  })
})
