/**
 * TOTP (Time-based One-Time Password) implementation for MFA.
 *
 * Uses Node.js built-in crypto — no external dependencies.
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 */

import { createHmac, randomBytes } from 'crypto'

const DIGITS = 6
const PERIOD = 30 // seconds
const ALGORITHM = 'sha1'

/** Generate a random base32-encoded secret (160 bits). */
export function generateSecret(): string {
  const bytes = randomBytes(20)
  return base32Encode(bytes)
}

/** Generate a TOTP code for the given secret at the current time. */
export function generateTOTP(secret: string, timeOffset = 0): string {
  const time = Math.floor(Date.now() / 1000 / PERIOD) + timeOffset
  const buffer = Buffer.alloc(8)
  buffer.writeBigUInt64BE(BigInt(time))

  const key = base32Decode(secret)
  const hmac = createHmac(ALGORITHM, key).update(buffer).digest()

  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)

  return (code % 10 ** DIGITS).toString().padStart(DIGITS, '0')
}

/**
 * Verify a TOTP code.
 * Allows a window of +/- 1 period to account for clock drift.
 */
export function verifyTOTP(secret: string, token: string): boolean {
  for (const offset of [-1, 0, 1]) {
    if (generateTOTP(secret, offset) === token) return true
  }
  return false
}

/**
 * Build an otpauth:// URI for use in QR codes.
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 */
export function buildOtpAuthUri(secret: string, email: string, issuer = 'PhishGuard'): string {
  const encodedIssuer = encodeURIComponent(issuer)
  const encodedEmail = encodeURIComponent(email)
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`
}

// ── Base32 helpers ──────────────────────────────────────────────────────────

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let result = ''
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8
    while (bits >= 5) {
      bits -= 5
      result += BASE32_CHARS[(value >>> bits) & 0x1f]
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 0x1f]
  }
  return result
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of cleaned) {
    const idx = BASE32_CHARS.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 0xff)
    }
  }
  return Buffer.from(bytes)
}
