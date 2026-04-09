import { describe, it, expect } from 'vitest'
import { analyzeEmail } from '@/lib/analyzer'

describe('analyzeEmail', () => {
  it('returns low risk for a clean email', () => {
    const result = analyzeEmail({
      sender: 'colleague@mycompany.com',
      subject: 'Meeting tomorrow',
      bodyText: 'Hey, just wanted to confirm our meeting for tomorrow at 3pm.',
    })
    expect(result.riskScore).toBe(0)
    expect(result.riskLevel).toBe('low')
    expect(result.signals).toHaveLength(0)
    expect(result.emailAuth).toBeNull()
  })

  it('detects urgency language', () => {
    const result = analyzeEmail({
      sender: 'alerts@randomsite.xyz',
      subject: 'Action required immediately',
      bodyText: 'Your account will be suspended immediately if you do not verify now.',
    })
    expect(result.signals.some(s => s.code === 'URGENCY_LANGUAGE')).toBe(true)
    expect(result.riskScore).toBeGreaterThan(0)
  })

  it('detects credential requests', () => {
    const result = analyzeEmail({
      sender: 'support@example.com',
      subject: 'Security update',
      bodyText: 'Please enter your password to confirm your identity.',
    })
    expect(result.signals.some(s => s.code === 'CREDENTIAL_REQUEST')).toBe(true)
  })

  it('detects threat language', () => {
    const result = analyzeEmail({
      sender: 'legal@fakecompany.com',
      subject: 'Final notice',
      bodyText: 'Your account will be terminated and we will take legal action.',
    })
    expect(result.signals.some(s => s.code === 'THREAT_LANGUAGE')).toBe(true)
  })

  it('detects financial requests', () => {
    const result = analyzeEmail({
      sender: 'boss@gmail.com',
      subject: 'Urgent request',
      bodyText: 'Please purchase gift cards and send me the codes via wire transfer.',
    })
    expect(result.signals.some(s => s.code === 'FINANCIAL_REQUEST')).toBe(true)
  })

  it('detects display name spoofing', () => {
    const result = analyzeEmail({
      sender: '"PayPal Support" <scammer@evil.com>',
      subject: 'Verify your account',
      bodyText: 'Click here to verify.',
    })
    expect(result.signals.some(s => s.code === 'DISPLAY_NAME_SPOOF')).toBe(true)
  })

  it('detects reply-to mismatch', () => {
    const result = analyzeEmail({
      sender: 'noreply@company.com',
      replyTo: 'attacker@evil.com',
      subject: 'Invoice',
      bodyText: 'See attached.',
    })
    expect(result.signals.some(s => s.code === 'REPLY_TO_MISMATCH')).toBe(true)
  })

  it('detects lookalike domains', () => {
    const result = analyzeEmail({
      sender: 'support@paypa1.com',
      subject: 'Account issue',
      bodyText: 'Your account needs attention.',
    })
    expect(result.signals.some(s => s.code === 'LOOKALIKE_DOMAIN')).toBe(true)
  })

  it('detects URL display mismatch in HTML', () => {
    const result = analyzeEmail({
      sender: 'info@example.com',
      subject: 'Click here',
      bodyHtml: '<a href="https://evil.com/steal">https://paypal.com/login</a>',
    })
    expect(result.signals.some(s => s.code === 'URL_DISPLAY_MISMATCH')).toBe(true)
    expect(result.links.length).toBeGreaterThan(0)
    expect(result.links[0].isSuspicious).toBe(true)
  })

  it('detects shortened URLs', () => {
    const result = analyzeEmail({
      sender: 'info@example.com',
      subject: 'Check this',
      bodyHtml: '<a href="https://bit.ly/abc123">Click here</a>',
    })
    expect(result.signals.some(s => s.code === 'SHORTENED_URL')).toBe(true)
  })

  it('detects IP address URLs', () => {
    const result = analyzeEmail({
      sender: 'info@example.com',
      subject: 'Link',
      bodyHtml: '<a href="http://192.168.1.1/login">Login</a>',
    })
    expect(result.signals.some(s => s.code === 'IP_ADDRESS_URL')).toBe(true)
  })

  it('detects suspicious TLDs', () => {
    const result = analyzeEmail({
      sender: 'info@example.com',
      subject: 'Offer',
      bodyHtml: '<a href="https://cheap-deals.xyz/buy">Buy now</a>',
    })
    expect(result.signals.some(s => s.code === 'SUSPICIOUS_TLD')).toBe(true)
  })

  it('detects dangerous attachments', () => {
    const result = analyzeEmail({
      sender: 'info@example.com',
      subject: 'Document',
      bodyText: 'See attached file.',
      attachments: [{ filename: 'invoice.exe', contentType: 'application/octet-stream' }],
    })
    expect(result.signals.some(s => s.code === 'DANGEROUS_ATTACHMENT_TYPE')).toBe(true)
    expect(result.attachments[0].isSuspicious).toBe(true)
  })

  it('detects macro-enabled documents', () => {
    const result = analyzeEmail({
      sender: 'info@example.com',
      subject: 'Spreadsheet',
      bodyText: 'Please enable macros.',
      attachments: [{ filename: 'report.xlsm', contentType: 'application/vnd.ms-excel' }],
    })
    expect(result.signals.some(s => s.code === 'OFFICE_WITH_MACROS')).toBe(true)
  })

  it('detects brand impersonation from free email', () => {
    const result = analyzeEmail({
      sender: 'support@gmail.com',
      subject: 'Your Microsoft account',
      bodyText: 'Microsoft needs you to verify your account.',
    })
    expect(result.signals.some(s => s.code === 'FREE_EMAIL_IMPERSONATION' || s.code === 'IMPERSONATION_BRAND')).toBe(true)
  })

  it('detects executive impersonation', () => {
    const result = analyzeEmail({
      sender: 'john@gmail.com',
      subject: 'From the CEO',
      bodyText: 'This is the CEO speaking, please handle this urgently.',
    })
    expect(result.signals.some(s => s.code === 'IMPERSONATION_EXECUTIVE')).toBe(true)
  })

  it('caps risk score at 100', () => {
    const result = analyzeEmail({
      sender: '"PayPal" <scam@evil.xyz>',
      replyTo: 'different@hacker.com',
      subject: 'Account suspended immediately - action required',
      bodyText: 'Your account will be terminated. Enter your password and credit card number. Purchase gift cards via wire transfer.',
      bodyHtml: '<a href="https://bit.ly/hack">https://paypal.com</a><a href="http://192.168.1.1/login">Login</a>',
      attachments: [{ filename: 'malware.exe' }],
    })
    expect(result.riskScore).toBeLessThanOrEqual(100)
    expect(result.riskLevel).toBe('critical')
  })

  it('returns risk level medium for moderate signals', () => {
    const result = analyzeEmail({
      sender: 'info@example.com',
      subject: 'Check this out',
      bodyHtml: '<a href="https://bit.ly/abc">Click</a>',
      bodyText: 'Your account needs verify now.',
    })
    expect(result.riskScore).toBeGreaterThanOrEqual(25)
  })

  // SPF/DKIM/DMARC integration
  it('detects SPF failure from raw headers', () => {
    const result = analyzeEmail({
      sender: 'test@example.com',
      subject: 'Hello',
      bodyText: 'Normal email.',
      rawHeaders: {
        'Authentication-Results': 'mx.example.com; spf=fail (sender not authorized); dkim=pass; dmarc=pass',
      },
    })
    expect(result.signals.some(s => s.code === 'SPF_FAIL')).toBe(true)
    expect(result.emailAuth).not.toBeNull()
    expect(result.emailAuth!.spf.status).toBe('fail')
  })

  it('detects DKIM failure', () => {
    const result = analyzeEmail({
      sender: 'test@example.com',
      subject: 'Test',
      bodyText: 'Test email.',
      rawHeaders: {
        'Authentication-Results': 'mx.example.com; spf=pass; dkim=fail (bad signature); dmarc=pass',
      },
    })
    expect(result.signals.some(s => s.code === 'DKIM_FAIL')).toBe(true)
    expect(result.emailAuth!.dkim.status).toBe('fail')
  })

  it('detects DMARC failure', () => {
    const result = analyzeEmail({
      sender: 'test@example.com',
      subject: 'Test',
      bodyText: 'Test email.',
      rawHeaders: {
        'Authentication-Results': 'mx.example.com; spf=pass; dkim=pass; dmarc=fail (alignment mismatch)',
      },
    })
    expect(result.signals.some(s => s.code === 'DMARC_FAIL')).toBe(true)
    expect(result.emailAuth!.dmarc.status).toBe('fail')
  })

  it('detects missing email auth when headers have no auth results', () => {
    const result = analyzeEmail({
      sender: 'test@example.com',
      subject: 'Test',
      bodyText: 'Test email.',
      rawHeaders: { 'X-Mailer': 'Outlook' },
    })
    expect(result.signals.some(s => s.code === 'MISSING_AUTH')).toBe(true)
  })

  it('does not add auth signals when all pass', () => {
    const result = analyzeEmail({
      sender: 'test@example.com',
      subject: 'Test',
      bodyText: 'Normal email content.',
      rawHeaders: {
        'Authentication-Results': 'mx.example.com; spf=pass; dkim=pass; dmarc=pass',
      },
    })
    expect(result.signals.some(s => ['SPF_FAIL', 'DKIM_FAIL', 'DMARC_FAIL', 'MISSING_AUTH'].includes(s.code))).toBe(false)
    expect(result.emailAuth!.spf.status).toBe('pass')
    expect(result.emailAuth!.dkim.status).toBe('pass')
    expect(result.emailAuth!.dmarc.status).toBe('pass')
  })
})
