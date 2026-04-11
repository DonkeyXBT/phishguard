/**
 * Naive Bayes text classifier for phishing detection.
 *
 * Trains incrementally from admin-reviewed reports. Model is persisted in
 * the database (MlModel table) so it survives serverless function restarts.
 */

import { prisma } from './prisma'

const MODEL_NAME = 'phishing-naive-bayes'

export interface ModelData {
  phishWordCounts: Record<string, number>
  hamWordCounts: Record<string, number>
  phishTotal: number
  hamTotal: number
  phishDocs: number
  hamDocs: number
}

const DEFAULT_MODEL: ModelData = {
  phishWordCounts: {
    'verify': 80, 'account': 90, 'suspended': 70, 'password': 85, 'click': 75,
    'immediately': 65, 'urgent': 70, 'confirm': 60, 'security': 55, 'alert': 50,
    'unauthorized': 60, 'gift': 45, 'card': 40, 'wire': 50, 'transfer': 45,
    'bitcoin': 40, 'login': 55, 'expire': 50, 'locked': 55, 'update': 45,
    'bank': 50, 'ssn': 40, 'credential': 45, 'terminate': 40, 'legal': 35,
    'invoice': 45, 'payment': 50, 'overdue': 35, 'action': 55, 'required': 50,
    'warning': 45, 'final': 35, 'notice': 40, 'reset': 40, 'victim': 25,
  },
  hamWordCounts: {
    'meeting': 80, 'schedule': 70, 'project': 75, 'update': 60, 'team': 70,
    'thanks': 65, 'please': 55, 'review': 50, 'document': 45, 'report': 50,
    'quarterly': 40, 'agenda': 35, 'call': 45, 'tomorrow': 50, 'hi': 60,
    'hello': 55, 'attached': 40, 'summary': 35, 'question': 40, 'available': 35,
    'discuss': 40, 'feedback': 35, 'lunch': 30, 'coffee': 25, 'welcome': 30,
    'congratulations': 25, 'deadline': 35, 'reminder': 40, 'follow': 30, 'draft': 30,
  },
  phishTotal: 1500,
  hamTotal: 1500,
  phishDocs: 100,
  hamDocs: 100,
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && w.length <= 25)
}

export class PhishingClassifier {
  public model: ModelData

  constructor(model?: ModelData) {
    this.model = model ?? structuredClone(DEFAULT_MODEL)
  }

  score(text: string): { probability: number; confidence: number; topPhishTokens: string[]; topHamTokens: string[] } {
    const tokens = tokenize(text)
    if (tokens.length === 0) return { probability: 0.5, confidence: 0, topPhishTokens: [], topHamTokens: [] }

    const vocab = this.model.phishTotal + this.model.hamTotal
    const smoothing = 1

    let logPhish = Math.log(this.model.phishDocs / (this.model.phishDocs + this.model.hamDocs))
    let logHam = Math.log(this.model.hamDocs / (this.model.phishDocs + this.model.hamDocs))

    const tokenScores: Array<{ token: string; phishScore: number }> = []

    for (const token of tokens) {
      const pPhish = ((this.model.phishWordCounts[token] ?? 0) + smoothing) / (this.model.phishTotal + vocab * smoothing)
      const pHam = ((this.model.hamWordCounts[token] ?? 0) + smoothing) / (this.model.hamTotal + vocab * smoothing)
      logPhish += Math.log(pPhish)
      logHam += Math.log(pHam)
      tokenScores.push({ token, phishScore: Math.log(pPhish) - Math.log(pHam) })
    }

    const maxLog = Math.max(logPhish, logHam)
    const expPhish = Math.exp(logPhish - maxLog)
    const expHam = Math.exp(logHam - maxLog)
    const probability = expPhish / (expPhish + expHam)
    const confidence = Math.abs(probability - 0.5) * 2

    tokenScores.sort((a, b) => b.phishScore - a.phishScore)
    const seen = new Set<string>()
    const topPhishTokens: string[] = []
    for (const t of tokenScores) {
      if (seen.has(t.token)) continue
      seen.add(t.token)
      if (t.phishScore > 0 && topPhishTokens.length < 5) topPhishTokens.push(t.token)
    }
    tokenScores.reverse()
    const seenHam = new Set<string>()
    const topHamTokens: string[] = []
    for (const t of tokenScores) {
      if (seenHam.has(t.token)) continue
      seenHam.add(t.token)
      if (t.phishScore < 0 && topHamTokens.length < 5) topHamTokens.push(t.token)
    }

    return { probability, confidence, topPhishTokens, topHamTokens }
  }

  /** Train on a single labeled example. */
  train(text: string, isPhishing: boolean): void {
    const tokens = tokenize(text)
    if (tokens.length === 0) return
    const counts = isPhishing ? this.model.phishWordCounts : this.model.hamWordCounts
    for (const token of tokens) {
      counts[token] = (counts[token] ?? 0) + 1
    }
    if (isPhishing) {
      this.model.phishTotal += tokens.length
      this.model.phishDocs++
    } else {
      this.model.hamTotal += tokens.length
      this.model.hamDocs++
    }
  }
}

// ── Database persistence ─────────────────────────────────────────────────────
let _cached: { classifier: PhishingClassifier; loadedAt: number } | null = null
const CACHE_TTL_MS = 60_000 // refetch from DB at most once per minute

export async function getClassifier(): Promise<PhishingClassifier> {
  const now = Date.now()
  if (_cached && now - _cached.loadedAt < CACHE_TTL_MS) {
    return _cached.classifier
  }

  try {
    const row = await prisma.mlModel.findUnique({ where: { name: MODEL_NAME } })
    if (row?.data) {
      const classifier = new PhishingClassifier(row.data as unknown as ModelData)
      _cached = { classifier, loadedAt: now }
      return classifier
    }
  } catch {
    // table may not exist yet — fall back to default
  }

  const classifier = new PhishingClassifier()
  _cached = { classifier, loadedAt: now }
  return classifier
}

/** Synchronous fallback for code paths that can't await — uses cache or defaults. */
export function getClassifierSync(): PhishingClassifier {
  if (_cached) return _cached.classifier
  return new PhishingClassifier()
}

/** Save the classifier model back to the database. */
export async function saveClassifier(classifier: PhishingClassifier, examplesAdded: number): Promise<void> {
  try {
    await prisma.mlModel.upsert({
      where: { name: MODEL_NAME },
      create: {
        name: MODEL_NAME,
        data: classifier.model as unknown as object,
        trainedOn: examplesAdded,
        version: 1,
      },
      update: {
        data: classifier.model as unknown as object,
        trainedOn: { increment: examplesAdded },
        version: { increment: 1 },
      },
    })
    _cached = { classifier, loadedAt: Date.now() }
  } catch (e) {
    console.error('[ml-scorer] failed to save model:', e)
  }
}

/**
 * Retrain the model from all admin-reviewed reports in the database.
 * Phishing label: status in [deleted, escalated]
 * Ham label: status = released
 */
export async function retrainFromReports(): Promise<{ trained: number; phish: number; ham: number }> {
  const reports = await prisma.emailReport.findMany({
    where: {
      status: { in: ['deleted', 'escalated', 'released'] },
      reviewedAt: { not: null },
    },
    select: { subject: true, bodyText: true, status: true },
    take: 5000,
    orderBy: { reviewedAt: 'desc' },
  })

  // Start from a fresh default model so we don't double-count old training
  const classifier = new PhishingClassifier()
  let phish = 0, ham = 0
  for (const r of reports) {
    const text = [r.subject ?? '', r.bodyText ?? ''].join(' ').trim()
    if (text.length < 20) continue
    const isPhishing = r.status === 'deleted' || r.status === 'escalated'
    classifier.train(text, isPhishing)
    if (isPhishing) phish++
    else ham++
  }

  await saveClassifier(classifier, phish + ham)
  return { trained: phish + ham, phish, ham }
}
