/**
 * Attachment sandboxing — static analysis and reputation checking.
 *
 * 1. File-type detection by magic bytes (not just extension)
 * 2. OLE2 / OOXML macro detection (Office documents)
 * 3. VirusTotal hash lookup (when VIRUSTOTAL_API_KEY is set)
 */

import { createHash } from 'crypto'

// ── Magic bytes for file type detection ─────────────────────────────────────

const MAGIC_SIGNATURES: Array<{ bytes: number[]; offset: number; type: string; dangerous: boolean }> = [
  { bytes: [0x4D, 0x5A],             offset: 0, type: 'PE executable (exe/dll)', dangerous: true },
  { bytes: [0x7F, 0x45, 0x4C, 0x46], offset: 0, type: 'ELF binary', dangerous: true },
  { bytes: [0x23, 0x21],             offset: 0, type: 'Script (shebang)', dangerous: true },
  { bytes: [0xD0, 0xCF, 0x11, 0xE0], offset: 0, type: 'OLE2 compound document (Office)', dangerous: false },
  { bytes: [0x50, 0x4B, 0x03, 0x04], offset: 0, type: 'ZIP/OOXML archive', dangerous: false },
  { bytes: [0x52, 0x61, 0x72, 0x21], offset: 0, type: 'RAR archive', dangerous: false },
  { bytes: [0x25, 0x50, 0x44, 0x46], offset: 0, type: 'PDF document', dangerous: false },
  { bytes: [0x1F, 0x8B],             offset: 0, type: 'Gzip archive', dangerous: false },
]

export interface SandboxResult {
  sha256: string
  detectedType: string | null
  isDangerous: boolean
  hasMacros: boolean
  vtResult: VtResult | null
  risks: string[]
}

interface VtResult {
  positives: number
  total: number
  permalink: string | null
}

/** Detect file type from first bytes. */
function detectFileType(buf: Buffer): { type: string; dangerous: boolean } | null {
  for (const sig of MAGIC_SIGNATURES) {
    if (buf.length < sig.offset + sig.bytes.length) continue
    let match = true
    for (let i = 0; i < sig.bytes.length; i++) {
      if (buf[sig.offset + i] !== sig.bytes[i]) { match = false; break }
    }
    if (match) return { type: sig.type, dangerous: sig.dangerous }
  }
  return null
}

/**
 * Detect macros in OLE2 or OOXML documents.
 *
 * OLE2 (doc/xls/ppt):  Look for "VBA" magic string or "Macros" directory entry
 * OOXML (docx/xlsx/pptx): Look for "vbaProject.bin" inside the ZIP structure
 */
function detectMacros(buf: Buffer): boolean {
  const str = buf.toString('latin1')

  // OLE2 compound document — look for VBA stream markers
  if (buf[0] === 0xD0 && buf[1] === 0xCF) {
    return str.includes('VBA') || str.includes('Macros') || str.includes('_VBA_PROJECT')
  }

  // ZIP/OOXML — look for vbaProject.bin entry name in central directory
  if (buf[0] === 0x50 && buf[1] === 0x4B) {
    return str.includes('vbaProject.bin') || str.includes('vbaProject')
  }

  return false
}

/** SHA-256 hash of a buffer. */
export function hashFile(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex')
}

/** Look up a file hash on VirusTotal. Returns null if no API key configured. */
async function vtLookup(sha256: string): Promise<VtResult | null> {
  const key = process.env.VIRUSTOTAL_API_KEY
  if (!key) return null

  try {
    const res = await fetch(`https://www.virustotal.com/api/v3/files/${sha256}`, {
      headers: { 'x-apikey': key },
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 404) return { positives: 0, total: 0, permalink: null }
    if (!res.ok) return null

    const data = await res.json()
    const stats = data?.data?.attributes?.last_analysis_stats ?? {}
    const positives = (stats.malicious ?? 0) + (stats.suspicious ?? 0)
    const total = Object.values(stats).reduce((s: number, v) => s + (v as number), 0) as number
    const permalink = data?.data?.links?.self ?? null
    return { positives, total, permalink }
  } catch {
    return null
  }
}

/**
 * Analyze an attachment buffer.
 */
export async function analyzeAttachment(
  buf: Buffer,
  filename: string,
): Promise<SandboxResult> {
  const sha256 = hashFile(buf)
  const risks: string[] = []
  let isDangerous = false
  let hasMacros = false

  // File type detection
  const detected = detectFileType(buf)
  if (detected?.dangerous) {
    isDangerous = true
    risks.push(`File content is a ${detected.type} — extension "${filename}" may be misleading`)
  }

  // Macro detection for Office documents
  if (detected?.type.includes('OLE2') || detected?.type.includes('OOXML') || detected?.type.includes('ZIP')) {
    hasMacros = detectMacros(buf)
    if (hasMacros) {
      risks.push('Document contains VBA macros — may execute malicious code')
    }
  }

  // Extension mismatch: if magic says executable but extension is innocent
  const ext = filename.split('.').pop()?.toLowerCase()
  if (detected?.dangerous && ext && !['exe', 'dll', 'elf', 'bin', 'bat', 'cmd', 'ps1', 'sh'].includes(ext)) {
    risks.push(`Extension ".${ext}" hides actual type: ${detected.type}`)
    isDangerous = true
  }

  // VirusTotal lookup
  const vtResult = await vtLookup(sha256)
  if (vtResult && vtResult.positives > 0) {
    isDangerous = true
    risks.push(`VirusTotal: ${vtResult.positives}/${vtResult.total} engines flagged this file`)
  }

  return {
    sha256,
    detectedType: detected?.type ?? null,
    isDangerous,
    hasMacros,
    vtResult,
    risks,
  }
}
