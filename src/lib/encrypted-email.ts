/**
 * Detect and flag S/MIME and PGP encrypted/signed emails.
 *
 * Since we can't analyze encrypted content, we flag it as a signal
 * so analysts know the email body could not be fully inspected.
 */

export interface EncryptionInfo {
  isEncrypted: boolean
  isSigned: boolean
  type: 'smime' | 'pgp' | null
  detail: string
}

const SMIME_CONTENT_TYPES = [
  'application/pkcs7-mime',
  'application/x-pkcs7-mime',
  'application/pkcs7-signature',
  'application/x-pkcs7-signature',
]

const PGP_MARKERS = [
  '-----BEGIN PGP MESSAGE-----',
  '-----BEGIN PGP SIGNED MESSAGE-----',
  '-----BEGIN PGP PUBLIC KEY BLOCK-----',
]

/**
 * Detect encryption from headers and body content.
 */
export function detectEncryption(params: {
  headers?: Record<string, string> | null
  contentType?: string | null
  bodyText?: string | null
  attachments?: Array<{ filename?: string; contentType?: string }>
}): EncryptionInfo {
  const result: EncryptionInfo = { isEncrypted: false, isSigned: false, type: null, detail: '' }

  // Check Content-Type header for S/MIME
  const ct = (params.contentType ?? params.headers?.['content-type'] ?? '').toLowerCase()
  if (SMIME_CONTENT_TYPES.some(t => ct.includes(t))) {
    result.type = 'smime'
    if (ct.includes('enveloped') || ct.includes('pkcs7-mime')) {
      result.isEncrypted = true
      result.detail = 'S/MIME encrypted message — body cannot be inspected'
    }
    if (ct.includes('signature') || ct.includes('signed')) {
      result.isSigned = true
      result.detail = result.isEncrypted
        ? 'S/MIME encrypted and signed message'
        : 'S/MIME signed message'
    }
    return result
  }

  // Check for multipart/signed with S/MIME protocol
  if (ct.includes('multipart/signed') && ct.includes('pkcs7')) {
    result.type = 'smime'
    result.isSigned = true
    result.detail = 'S/MIME signed message (multipart/signed)'
    return result
  }

  // Check body for PGP markers
  const body = params.bodyText ?? ''
  for (const marker of PGP_MARKERS) {
    if (body.includes(marker)) {
      result.type = 'pgp'
      if (marker.includes('PGP MESSAGE')) {
        result.isEncrypted = true
        result.detail = 'PGP encrypted message — body cannot be inspected'
      } else if (marker.includes('SIGNED')) {
        result.isSigned = true
        result.detail = 'PGP signed message'
      }
      return result
    }
  }

  // Check attachments for S/MIME or PGP files
  for (const att of params.attachments ?? []) {
    const fname = (att.filename ?? '').toLowerCase()
    const attCt = (att.contentType ?? '').toLowerCase()

    if (fname === 'smime.p7m' || fname === 'smime.p7s' || SMIME_CONTENT_TYPES.some(t => attCt.includes(t))) {
      result.type = 'smime'
      result.isEncrypted = fname.endsWith('.p7m')
      result.isSigned = fname.endsWith('.p7s') || !result.isEncrypted
      result.detail = `S/MIME attachment: ${fname}`
      return result
    }

    if (fname.endsWith('.asc') || fname.endsWith('.gpg') || fname.endsWith('.pgp') || attCt.includes('pgp')) {
      result.type = 'pgp'
      result.isEncrypted = true
      result.detail = `PGP encrypted attachment: ${fname}`
      return result
    }
  }

  return result
}
