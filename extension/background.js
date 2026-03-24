const DEFAULT_API_URL = 'https://phishing-detector-orpin-ten.vercel.app';

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_EMAIL') { handleAnalyze(message.data, sendResponse); return true }
  if (message.type === 'REPORT_EMAIL')  { handleReport(message.data, sendResponse);  return true }
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['apiUrl', 'apiKey'], result => {
      sendResponse({ apiUrl: result.apiUrl || DEFAULT_API_URL, apiKey: result.apiKey || '' })
    }); return true
  }
})

// ── Settings helper ───────────────────────────────────────────────────────────
async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['apiUrl', 'apiKey'], result => {
      resolve({ apiUrl: result.apiUrl || DEFAULT_API_URL, apiKey: result.apiKey || '' })
    })
  })
}

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const { apiUrl, apiKey } = await getSettings()
  if (!apiKey) return { error: 'No API key — open PhishGuard extension settings.' }
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        ...(options.headers ?? {}),
      },
    })
    if (!res.ok) { const e = await res.json(); return { error: e.error || 'Request failed' } }
    return { result: await res.json() }
  } catch {
    return { error: 'Cannot connect to PhishGuard server.' }
  }
}

async function post(path, data) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(data) })
}

async function handleAnalyze(data, sendResponse) { sendResponse(await post('/api/emails/analyze', data)) }
async function handleReport(data, sendResponse)  { sendResponse(await post('/api/emails/report', data)) }

// ── Deletion polling ──────────────────────────────────────────────────────────
const EMAIL_TAB_URLS = [
  '*://mail.google.com/*',
  '*://outlook.live.com/*',
  '*://outlook.office.com/*',
  '*://outlook.office365.com/*',
]

async function fetchAndBroadcastDeletions() {
  const resp = await apiFetch('/api/emails/deleted')
  if (!resp.result) return

  const deletions = resp.result
  // Cache in local storage so content scripts can read on load
  await chrome.storage.local.set({ deletedEmails: deletions, deletedEmailsAt: Date.now() })

  // Notify any open email tabs immediately
  const tabs = await chrome.tabs.query({ url: EMAIL_TAB_URLS })
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: 'DELETIONS_UPDATED', deletions })
      .catch(() => { /* tab may not have content script yet */ })
  }
}

// Poll every 2 minutes
chrome.alarms.create('poll-deletions', { periodInMinutes: 2 })
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'poll-deletions') fetchAndBroadcastDeletions()
})

// Also fetch on install / browser startup
chrome.runtime.onInstalled.addListener(() => fetchAndBroadcastDeletions())
chrome.runtime.onStartup.addListener(()   => fetchAndBroadcastDeletions())
