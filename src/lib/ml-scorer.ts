/**
 * Naive Bayes text classifier for phishing detection.
 *
 * This supplements the rule-based analyzer with a statistical model trained
 * on labeled email text.  No external ML libraries required.
 *
 * The model can be trained incrementally and persisted as JSON.
 * In production, the trained model is loaded from PHISH_MODEL_PATH env var
 * or falls back to a default set of phishing/ham priors.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'

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
  private model: ModelData

  constructor(model?: ModelData) {
    this.model = model ?? { ...DEFAULT_MODEL }
  }

  /** Load a persisted model from disk. */
  static load(path?: string): PhishingClassifier {
    const p = path ?? process.env.PHISH_MODEL_PATH
    if (p && existsSync(p)) {
      try {
        const data = JSON.parse(readFileSync(p, 'utf-8')) as ModelData
        return new PhishingClassifier(data)
      } catch {
        // Fall through to default
      }
    }
    return new PhishingClassifier()
  }

  /** Save the model to disk. */
  save(path?: string): void {
    const p = path ?? process.env.PHISH_MODEL_PATH
    if (p) writeFileSync(p, JSON.stringify(this.model), 'utf-8')
  }

  /**
   * Score an email body.
   * Returns a probability between 0 and 1 (higher = more likely phishing).
   */
  score(text: string): { probability: number; confidence: number; topPhishTokens: string[]; topHamTokens: string[] } {
    const tokens = tokenize(text)
    if (tokens.length === 0) return { probability: 0.5, confidence: 0, topPhishTokens: [], topHamTokens: [] }

    const vocab = this.model.phishTotal + this.model.hamTotal
    const smoothing = 1 // Laplace smoothing

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

    // Convert log-probabilities to probability using log-sum-exp
    const maxLog = Math.max(logPhish, logHam)
    const expPhish = Math.exp(logPhish - maxLog)
    const expHam = Math.exp(logHam - maxLog)
    const probability = expPhish / (expPhish + expHam)

    // Confidence: how far from 0.5 (uncertain)
    const confidence = Math.abs(probability - 0.5) * 2

    // Top contributing tokens
    tokenScores.sort((a, b) => b.phishScore - a.phishScore)
    const seen = new Set<string>()
    const topPhishTokens: string[] = []
    const topHamTokens: string[] = []
    for (const t of tokenScores) {
      if (seen.has(t.token)) continue
      seen.add(t.token)
      if (t.phishScore > 0 && topPhishTokens.length < 5) topPhishTokens.push(t.token)
    }
    tokenScores.reverse()
    const seenHam = new Set<string>()
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

/** Singleton instance — lazily loaded from persisted model or defaults. */
let _classifier: PhishingClassifier | null = null

export function getClassifier(): PhishingClassifier {
  if (!_classifier) _classifier = PhishingClassifier.load()
  return _classifier
}
