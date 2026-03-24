const DEFAULT_API_URL = 'https://phishing-detector-orpin-ten.vercel.app';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_EMAIL') { handleAnalyze(message.data, sendResponse); return true }
  if (message.type === 'REPORT_EMAIL')  { handleReport(message.data, sendResponse);  return true }
  if (message.type === 'GET_SETTINGS') {
    chrome.storage.sync.get(['apiUrl', 'apiKey'], result => {
      sendResponse({ apiUrl: result.apiUrl || DEFAULT_API_URL, apiKey: result.apiKey || '' })
    }); return true
  }
})

async function getSettings() {
  return new Promise(resolve => {
    chrome.storage.sync.get(['apiUrl', 'apiKey'], result => {
      resolve({ apiUrl: result.apiUrl || DEFAULT_API_URL, apiKey: result.apiKey || '' })
    })
  })
}

async function post(path, data) {
  const { apiUrl, apiKey } = await getSettings()
  if (!apiKey) return { error: 'No API key — open PhishGuard extension settings.' }
  try {
    const res = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(data),
    })
    if (!res.ok) { const e = await res.json(); return { error: e.error || 'Request failed' } }
    return { result: await res.json() }
  } catch {
    return { error: 'Cannot connect to PhishGuard server.' }
  }
}

async function handleAnalyze(data, sendResponse) { sendResponse(await post('/api/emails/analyze', data)) }
async function handleReport(data, sendResponse)  { sendResponse(await post('/api/emails/report', data)) }
