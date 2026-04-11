import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'
import { retrainFromReports } from '@/lib/ml-scorer'
import { ok, err } from '@/lib/response'
import { audit } from '@/lib/audit'

// GET /api/admin/ml — return current model status
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user || !user.isAdmin) return err('Admin required', 403)

  const model = await prisma.mlModel.findUnique({ where: { name: 'phishing-naive-bayes' } })
  if (!model) {
    return ok({
      exists: false,
      version: 0,
      trainedOn: 0,
      updatedAt: null,
    })
  }

  return ok({
    exists: true,
    version: model.version,
    trainedOn: model.trainedOn,
    updatedAt: model.updatedAt,
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
