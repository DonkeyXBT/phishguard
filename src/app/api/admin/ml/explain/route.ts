import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { getClassifier, type ModelData } from '@/lib/ml-scorer'
import { ok, err } from '@/lib/response'

interface TokenContribution {
  token: string
  phishScore: number
  count: number
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && w.length <= 25)
}

// POST /api/admin/ml/explain
// Body: { text: string }   OR   { reportId: string }
// Returns: { probability, confidence, topPhishTokens, topHamTokens }
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const body = await req.json()
  let text: string = body.text ?? ''

  if (body.reportId && !text) {
    const report = await prisma.emailReport.findFirst({
      where: { id: body.reportId },
      select: { subject: true, bodyText: true },
    })
    if (!report) return err('Report not found', 404)
    text = [report.subject ?? '', report.bodyText ?? ''].join(' ').trim()
  }

  if (!text || text.length < 10) return err('Text required (min 10 chars)')

  const classifier = await getClassifier()
  const model = classifier.model as ModelData
  const tokens = tokenize(text)

  // Compute per-token contribution to the phishing log-odds
  const vocab = model.phishTotal + model.hamTotal
  const smoothing = 1
  const tokenContribs = new Map<string, TokenContribution>()

  for (const token of tokens) {
    const phishCount = model.phishWordCounts[token] ?? 0
    const hamCount = model.hamWordCounts[token] ?? 0
    const pPhish = (phishCount + smoothing) / (model.phishTotal + vocab * smoothing)
    const pHam = (hamCount + smoothing) / (model.hamTotal + vocab * smoothing)
    const phishScore = Math.log(pPhish) - Math.log(pHam)

    const existing = tokenContribs.get(token)
    if (existing) {
      existing.count++
    } else {
      tokenContribs.set(token, { token, phishScore, count: 1 })
    }
  }

  const all = Array.from(tokenContribs.values())
  // Weight contribution by frequency in the email
  for (const t of all) {
    t.phishScore = t.phishScore * t.count
  }

  all.sort((a, b) => b.phishScore - a.phishScore)
  const topPhishTokens = all.filter(t => t.phishScore > 0).slice(0, 12)
  const topHamTokens = all.filter(t => t.phishScore < 0).reverse().slice(0, 12)

  const result = classifier.score(text)

  return ok({
    text_length: text.length,
    token_count: tokens.length,
    probability: result.probability,
    confidence: result.confidence,
    verdict: result.probability >= 0.7 ? 'phishing' : result.probability <= 0.3 ? 'legitimate' : 'uncertain',
    topPhishTokens,
    topHamTokens,
    model_phish_docs: model.phishDocs,
    model_ham_docs: model.hamDocs,
  })
}
