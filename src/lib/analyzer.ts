import { parseEmailAuth, type EmailAuthResult } from './email-auth'
import { getClassifierSync } from './ml-scorer'
import { detectEncryption } from './encrypted-email'

const KNOWN_BRANDS = [
  'paypal','microsoft','apple','amazon','google','facebook','instagram',
  'netflix','spotify','bank','chase','wellsfargo','citibank','hsbc',
  'dropbox','docusign','linkedin','twitter','dhl','fedex','ups',
  'irs','gov','support','security','account','service','helpdesk',
]

const URGENT_PHRASES = [
  'urgent','immediately','action required','your account will be','within 24 hours',
  'account suspended','verify now','click now','limited time','expires today',
  'final notice','act now','respond immediately','time sensitive','last warning',
  'account locked','security alert','unusual activity','verify your account',
  'confirm your identity','we detected','suspicious login','unauthorized access',
]

const THREAT_PHRASES = [
  'will be terminated','legal action','permanently deleted','suspended immediately',
  'face consequences','law enforcement','criminal charges','account will be closed',
  'service will be discontinued','lose access','account banned',
]

const CREDENTIAL_PHRASES = [
  'enter your password','confirm your password','verify your password',
  'update your password','your pin','social security','credit card number',
  'bank account','routing number','cvv','security code','mother\'s maiden name',
  'date of birth','confirm your details','verify your identity',
]

const FINANCIAL_PHRASES = [
  'wire transfer','gift card','western union','bitcoin','cryptocurrency',
  'send money','transfer funds','purchase gift cards','itunes card','google play card',
  'amazon gift card','payment required','outstanding invoice','unpaid balance',
]

const FREE_EMAIL_DOMAINS = [
  'gmail.com','yahoo.com','hotmail.com','outlook.com','protonmail.com',
  'icloud.com','aol.com','yandex.com','mail.com','zoho.com',
]

const DANGEROUS_EXTENSIONS = ['.exe','.bat','.cmd','.vbs','.js','.jar','.ps1','.scr','.pif','.com','.hta']
const OFFICE_MACRO_EXTENSIONS = ['.xlsm','.xlsb','.docm','.pptm','.xlam','.dotm']
const ARCHIVE_EXTENSIONS = ['.zip','.rar','.7z','.tar','.gz','.iso','.img']
const SUSPICIOUS_TLDS = ['.xyz','.top','.club','.online','.site','.info','.biz','.ru','.cn','.tk','.ml','.ga','.cf']
const URL_SHORTENERS = ['bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','buff.ly','short.link','rb.gy','cutt.ly']
const EXECUTIVE_TITLES = ['ceo','cfo','coo','president','director','vp ','vice president']

function levenshtein(s1: string, s2: string): number {
  if (s1.length < s2.length) return levenshtein(s2, s1)
  if (s2.length === 0) return s1.length
  let prevRow = Array.from({ length: s2.length + 1 }, (_, i) => i)
  for (const c1 of s1) {
    const currRow = [prevRow[0] + 1]
    for (let i = 0; i < s2.length; i++) {
      currRow.push(Math.min(prevRow[i + 1] + 1, currRow[i] + 1, prevRow[i] + (c1 !== s2[i] ? 1 : 0)))
    }
    prevRow = currRow
  }
  return prevRow[prevRow.length - 1]
}

function extractDomain(emailOrUrl: string): string | null {
  if (!emailOrUrl) return null
  if (emailOrUrl.includes('@')) return emailOrUrl.split('@').pop()!.toLowerCase().replace(/[>]/g, '').trim()
  try {
    return new URL(emailOrUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

function extractUrlsFromHtml(html: string): Array<{ url: string; display: string }> {
  const links: Array<{ url: string; display: string }> = []
  const pattern = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi
  let match
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1].trim()
    const display = match[2].replace(/<[^>]+>/g, '').trim()
    links.push({ url, display })
  }
  return links
}

function isIpAddress(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
}

export interface AnalysisSignal {
  code: string
  label: string
  description: string
  detail: string
  score: number
  severity: 'info' | 'warning' | 'danger' | 'critical'
}

export interface AnalyzedLink {
  displayText: string
  url: string
  domain: string | null
  isSuspicious: boolean
  riskReason: string | null
}

export interface AnalyzedAttachment {
  filename: string
  contentType: string
  isSuspicious: boolean
  riskReason: string | null
}

export interface AnalysisResult {
  riskScore: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  signals: AnalysisSignal[]
  links: AnalyzedLink[]
  attachments: AnalyzedAttachment[]
  summary: string
  emailAuth: EmailAuthResult | null
  mlScore: { probability: number; confidence: number } | null
}

const SIGNAL_DEFS: Record<string, { label: string; description: string; score: number; severity: AnalysisSignal['severity'] }> = {
  REPLY_TO_MISMATCH:          { label: 'Reply-To Mismatch', description: 'Reply-To differs from sender domain', score: 20, severity: 'warning' },
  DISPLAY_NAME_SPOOF:         { label: 'Display Name Spoofing', description: 'Display name impersonates a known brand', score: 25, severity: 'danger' },
  LOOKALIKE_DOMAIN:           { label: 'Lookalike Domain', description: 'Sender domain is visually similar to a known legitimate domain', score: 35, severity: 'danger' },
  FREE_EMAIL_IMPERSONATION:   { label: 'Free Email Impersonation', description: 'Free email service used to impersonate a company', score: 20, severity: 'warning' },
  URL_DISPLAY_MISMATCH:       { label: 'Link Text/URL Mismatch', description: 'Hyperlink display text does not match the actual URL', score: 30, severity: 'danger' },
  SHORTENED_URL:              { label: 'URL Shortener Used', description: 'Email contains shortened URLs that hide the real destination', score: 20, severity: 'warning' },
  SUSPICIOUS_TLD:             { label: 'Suspicious TLD', description: 'Link uses a domain extension commonly abused in phishing', score: 15, severity: 'warning' },
  IP_ADDRESS_URL:             { label: 'IP Address in URL', description: 'Link uses a raw IP address instead of a domain name', score: 25, severity: 'danger' },
  URGENCY_LANGUAGE:           { label: 'Urgency Language', description: 'Email pressures the reader to act immediately', score: 20, severity: 'warning' },
  THREAT_LANGUAGE:            { label: 'Threat Language', description: 'Email threatens account termination or legal action', score: 30, severity: 'danger' },
  CREDENTIAL_REQUEST:         { label: 'Credential Request', description: 'Email asks for password or sensitive credentials', score: 35, severity: 'critical' },
  FINANCIAL_REQUEST:          { label: 'Financial Request', description: 'Email requests wire transfers or financial information', score: 35, severity: 'critical' },
  IMPERSONATION_BRAND:        { label: 'Brand Impersonation', description: 'Email claims to be a known brand but is not sent from their domain', score: 30, severity: 'danger' },
  IMPERSONATION_EXECUTIVE:    { label: 'Executive Impersonation', description: 'Email impersonates a company executive from a free email provider', score: 30, severity: 'danger' },
  DANGEROUS_ATTACHMENT_TYPE:  { label: 'Dangerous Attachment', description: 'Email contains an attachment type used to deliver malware', score: 40, severity: 'critical' },
  OFFICE_WITH_MACROS:         { label: 'Macro-Enabled Document', description: 'Attachment may contain malicious macros', score: 25, severity: 'danger' },
  ARCHIVE_WITH_EXECUTABLE:    { label: 'Archive Attachment', description: 'Archive attachment may contain executables', score: 30, severity: 'danger' },
  SPF_FAIL:                   { label: 'SPF Failed', description: 'Sender IP not authorized by domain\'s SPF record', score: 25, severity: 'danger' },
  DKIM_FAIL:                  { label: 'DKIM Failed', description: 'Email DKIM signature verification failed', score: 25, severity: 'danger' },
  DMARC_FAIL:                 { label: 'DMARC Failed', description: 'Email failed DMARC alignment checks', score: 30, severity: 'danger' },
  MISSING_AUTH:               { label: 'No Email Authentication', description: 'Email lacks SPF/DKIM/DMARC authentication data', score: 15, severity: 'warning' },
  ML_HIGH_PHISH:              { label: 'ML Phishing Score', description: 'Machine learning model rates this email as likely phishing', score: 20, severity: 'warning' },
  ENCRYPTED_BODY:             { label: 'Encrypted Email', description: 'Email body is encrypted and cannot be fully inspected', score: 10, severity: 'info' },
}

export function analyzeEmail(params: {
  sender?: string | null
  replyTo?: string | null
  subject?: string | null
  bodyText?: string | null
  bodyHtml?: string | null
  attachments?: Array<{ filename?: string; contentType?: string }>
  rawHeaders?: Record<string, string> | string | null
}): AnalysisResult {
  const signals: AnalysisSignal[] = []
  let score = 0

  function addSignal(code: string, detail?: string) {
    const def = SIGNAL_DEFS[code]
    if (!def) return
    signals.push({ code, label: def.label, description: def.description, detail: detail ?? def.description, score: def.score, severity: def.severity })
    score += def.score
  }

  const bodyLower = [
    params.bodyText ?? '',
    params.bodyHtml ? params.bodyHtml.replace(/<[^>]+>/g, ' ') : '',
  ].join(' ').toLowerCase()
  const subjectLower = (params.subject ?? '').toLowerCase()
  const senderDomain = params.sender ? extractDomain(params.sender) : null

  // --- Header checks ---
  if (params.replyTo && senderDomain) {
    const replyDomain = extractDomain(params.replyTo)
    if (replyDomain && replyDomain !== senderDomain) {
      addSignal('REPLY_TO_MISMATCH', `From: ${senderDomain}, Reply-To: ${replyDomain}`)
    }
  }

  if (params.sender && senderDomain) {
    const displayName = params.sender.includes('<') ? params.sender.split('<')[0].replace(/"/g, '').toLowerCase().trim() : ''
    for (const brand of KNOWN_BRANDS) {
      if (displayName.includes(brand) && !senderDomain.includes(brand)) {
        addSignal('DISPLAY_NAME_SPOOF', `Display name contains '${brand}' but domain is '${senderDomain}'`)
        break
      }
    }
    const coreDomain = senderDomain.split('.')[0]
    for (const brand of KNOWN_BRANDS) {
      if (brand !== coreDomain && brand.length > 3 && levenshtein(coreDomain, brand) <= 2 && levenshtein(coreDomain, brand) >= 1) {
        addSignal('LOOKALIKE_DOMAIN', `'${senderDomain}' is visually similar to '${brand}.com'`)
        break
      }
    }
    if (FREE_EMAIL_DOMAINS.includes(senderDomain)) {
      for (const brand of KNOWN_BRANDS) {
        if (subjectLower.includes(brand) || bodyLower.substring(0, 500).includes(brand)) {
          addSignal('FREE_EMAIL_IMPERSONATION', `Free email (${senderDomain}) used to impersonate a company`)
          break
        }
      }
    }
  }

  // --- SPF / DKIM / DMARC checks ---
  let emailAuth: EmailAuthResult | null = null
  if (params.rawHeaders) {
    emailAuth = parseEmailAuth(params.rawHeaders)

    const allUnknown =
      emailAuth.spf.status === 'unknown' &&
      emailAuth.dkim.status === 'unknown' &&
      emailAuth.dmarc.status === 'unknown'

    if (allUnknown) {
      addSignal('MISSING_AUTH', 'No SPF/DKIM/DMARC results found in headers')
    } else {
      if (emailAuth.spf.status === 'fail' || emailAuth.spf.status === 'softfail') {
        addSignal('SPF_FAIL', emailAuth.spf.detail)
      }
      if (emailAuth.dkim.status === 'fail') {
        addSignal('DKIM_FAIL', emailAuth.dkim.detail)
      }
      if (emailAuth.dmarc.status === 'fail') {
        addSignal('DMARC_FAIL', emailAuth.dmarc.detail)
      }
    }
  }

  // --- Content checks ---
  const urgencyHits = URGENT_PHRASES.filter(p => bodyLower.includes(p) || subjectLower.includes(p))
  if (urgencyHits.length > 0) addSignal('URGENCY_LANGUAGE', `Found: ${urgencyHits.slice(0, 3).join(', ')}`)

  const threatHits = THREAT_PHRASES.filter(p => bodyLower.includes(p) || subjectLower.includes(p))
  if (threatHits.length > 0) addSignal('THREAT_LANGUAGE', `Found: ${threatHits.slice(0, 3).join(', ')}`)

  const credHits = CREDENTIAL_PHRASES.filter(p => bodyLower.includes(p))
  if (credHits.length > 0) addSignal('CREDENTIAL_REQUEST', `Found: ${credHits.slice(0, 3).join(', ')}`)

  const finHits = FINANCIAL_PHRASES.filter(p => bodyLower.includes(p) || subjectLower.includes(p))
  if (finHits.length > 0) addSignal('FINANCIAL_REQUEST', `Found: ${finHits.slice(0, 3).join(', ')}`)

  for (const brand of ['paypal','microsoft','apple','amazon','google','netflix','facebook','bank','chase','linkedin']) {
    if ((bodyLower.includes(brand) || subjectLower.includes(brand)) && senderDomain && !senderDomain.includes(brand)) {
      addSignal('IMPERSONATION_BRAND', `Claims to be '${brand}' but sent from '${senderDomain}'`)
      break
    }
  }

  for (const title of EXECUTIVE_TITLES) {
    if ((bodyLower.substring(0, 300).includes(title) || subjectLower.includes(title)) && senderDomain && FREE_EMAIL_DOMAINS.includes(senderDomain)) {
      addSignal('IMPERSONATION_EXECUTIVE', `Executive title '${title.trim()}' from free email provider`)
      break
    }
  }

  // --- URL checks ---
  const analyzedLinks: AnalyzedLink[] = []
  if (params.bodyHtml) {
    for (const { url, display } of extractUrlsFromHtml(params.bodyHtml)) {
      const domain = extractDomain(url)
      const entry: AnalyzedLink = { displayText: display, url, domain, isSuspicious: false, riskReason: null }

      if (display.startsWith('http') && domain) {
        const displayDomain = extractDomain(display)
        if (displayDomain && displayDomain !== domain) {
          addSignal('URL_DISPLAY_MISMATCH', `Shows '${displayDomain}' but links to '${domain}'`)
          entry.isSuspicious = true; entry.riskReason = 'display/url domain mismatch'
        }
      }
      if (domain) {
        if (URL_SHORTENERS.some(s => domain.includes(s))) {
          addSignal('SHORTENED_URL', `Shortened via ${domain}`)
          entry.isSuspicious = true; entry.riskReason = 'URL shortener'
        } else if (isIpAddress(domain)) {
          addSignal('IP_ADDRESS_URL', `Raw IP: ${domain}`)
          entry.isSuspicious = true; entry.riskReason = 'IP address URL'
        } else {
          // Extract the actual TLD (last dot-segment) to avoid false matches
          const domainParts = domain.split('.')
          const actualTld = domainParts.length >= 2 ? '.' + domainParts[domainParts.length - 1] : ''
          if (SUSPICIOUS_TLDS.includes(actualTld)) {
            addSignal('SUSPICIOUS_TLD', `Domain uses '${actualTld}' TLD`)
            entry.isSuspicious = true; entry.riskReason = `suspicious TLD ${actualTld}`
          }
        }
      }
      analyzedLinks.push(entry)
    }
  }

  // --- Attachment checks ---
  const analyzedAttachments: AnalyzedAttachment[] = []
  for (const att of params.attachments ?? []) {
    const fname = (att.filename ?? '').toLowerCase()
    const entry: AnalyzedAttachment = { filename: att.filename ?? '', contentType: att.contentType ?? '', isSuspicious: false, riskReason: null }
    if (DANGEROUS_EXTENSIONS.some(e => fname.endsWith(e))) {
      addSignal('DANGEROUS_ATTACHMENT_TYPE', `File '${fname}' is a dangerous type`)
      entry.isSuspicious = true; entry.riskReason = 'dangerous file type'
    } else if (OFFICE_MACRO_EXTENSIONS.some(e => fname.endsWith(e))) {
      addSignal('OFFICE_WITH_MACROS', `File '${fname}' may contain macros`)
      entry.isSuspicious = true; entry.riskReason = 'possible macro document'
    } else if (ARCHIVE_EXTENSIONS.some(e => fname.endsWith(e))) {
      addSignal('ARCHIVE_WITH_EXECUTABLE', `Archive '${fname}' may contain executables`)
      entry.isSuspicious = true; entry.riskReason = 'archive file'
    }
    analyzedAttachments.push(entry)
  }

  // --- Encryption detection ---
  const encryption = detectEncryption({
    headers: typeof params.rawHeaders === 'object' && params.rawHeaders !== null
      ? params.rawHeaders as Record<string, string>
      : null,
    bodyText: params.bodyText,
    attachments: params.attachments,
  })
  if (encryption.isEncrypted) {
    addSignal('ENCRYPTED_BODY', encryption.detail)
  }

  // --- ML scoring ---
  let mlScore: { probability: number; confidence: number } | null = null
  const combinedText = [params.subject ?? '', params.bodyText ?? ''].join(' ').trim()
  if (combinedText.length > 20) {
    try {
      const classifier = getClassifierSync()
      const ml = classifier.score(combinedText)
      mlScore = { probability: ml.probability, confidence: ml.confidence }
      if (ml.probability >= 0.75 && ml.confidence >= 0.3) {
        addSignal('ML_HIGH_PHISH', `ML probability: ${(ml.probability * 100).toFixed(0)}% (confidence: ${(ml.confidence * 100).toFixed(0)}%)`)
      }
    } catch {
      // ML scoring is best-effort
    }
  }

  // --- Finalize ---
  const finalScore = Math.min(score, 100)
  const riskLevel: AnalysisResult['riskLevel'] =
    finalScore >= 75 ? 'critical' : finalScore >= 50 ? 'high' : finalScore >= 25 ? 'medium' : 'low'

  const summary = signals.length === 0
    ? 'No significant phishing indicators detected.'
    : riskLevel === 'critical' || riskLevel === 'high'
    ? `High confidence phishing attempt. ${signals.length} suspicious signals detected.`
    : `Some indicators found. ${signals.length} signal(s) detected — review carefully.`

  return { riskScore: finalScore, riskLevel, signals, links: analyzedLinks, attachments: analyzedAttachments, summary, emailAuth, mlScore }
}
