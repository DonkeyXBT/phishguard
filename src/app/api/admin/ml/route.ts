import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { retrainFromReports, type ModelData } from '@/lib/ml-scorer'
import { ok, err } from '@/lib/response'
import { audit } from '@/lib/audit'

// GET /api/admin/ml — return current model status + training feed
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const [model, recentTraining] = await Promise.all([
    prisma.mlModel.findUnique({ where: { name: 'phishing-naive-bayes' } }),
    prisma.emailReport.findMany({
      where: {
        status: { in: ['deleted', 'escalated', 'released'] },
        reviewedAt: { not: null },
      },
      orderBy: { reviewedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        subject: true,
        sender: true,
        status: true,
        riskScore: true,
        riskLevel: true,
        reviewedAt: true,
      },
    }),
  ])

  if (!model) {
    return ok({
      exists: false,
      version: 0,
      trainedOn: 0,
      phishDocs: 0,
      hamDocs: 0,
      vocabularySize: 0,
      updatedAt: null,
      topPhishTokens: [],
      topHamTokens: [],
      recentTraining,
    })
  }

  const data = model.data as unknown as ModelData

  // Compute top discriminating tokens — words with the biggest phish/ham ratio
  const tokens = new Set([
    ...Object.keys(data.phishWordCounts || {}),
    ...Object.keys(data.hamWordCounts || {}),
  ])

  const tokenScores: Array<{ token: string; phish: number; ham: number; ratio: number }> = []
  for (const token of tokens) {
    const phish = data.phishWordCounts[token] ?? 0
    const ham = data.hamWordCounts[token] ?? 0
    if (phish + ham < 3) continue // ignore noise
    // Log-ratio of (phish freq) / (ham freq) with smoothing
    const pPhish = (phish + 1) / (data.phishTotal + 1)
    const pHam = (ham + 1) / (data.hamTotal + 1)
    const ratio = Math.log(pPhish / pHam)
    tokenScores.push({ token, phish, ham, ratio })
  }

  tokenScores.sort((a, b) => b.ratio - a.ratio)
  const topPhishTokens = tokenScores.slice(0, 15).map(t => ({ token: t.token, phish: t.phish, ham: t.ham }))
  const topHamTokens = tokenScores.slice(-15).reverse().map(t => ({ token: t.token, phish: t.phish, ham: t.ham }))

  return ok({
    exists: true,
    version: model.version,
    trainedOn: model.trainedOn,
    phishDocs: data.phishDocs ?? 0,
    hamDocs: data.hamDocs ?? 0,
    vocabularySize: tokens.size,
    updatedAt: model.updatedAt,
    topPhishTokens,
    topHamTokens,
    recentTraining,
  })
}

// POST /api/admin/ml — full retrain from all reviewed reports
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const result = await retrainFromReports()
  audit(req, { userId: user.id, userEmail: user.email, action: 'ml.retrain', detail: `Trained on ${result.trained} examples (${result.phish} phish, ${result.ham} ham)` })

  return ok({
    message: 'Model retrained successfully',
    trained: result.trained,
    phish: result.phish,
    ham: result.ham,
  })
}
