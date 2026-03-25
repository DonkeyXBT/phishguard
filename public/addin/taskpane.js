/* global Office */

'use strict';

// Derive the server origin robustly — window.location.origin can be
// unreliable in Outlook desktop's embedded WebView (returns undefined/null).
const DEFAULT_URL = (function () {
  try {
    const o = window.location.origin;
    if (o && o.startsWith('https://')) return o;
  } catch (_) {}
  // Fallback: parse from the full href
  try {
    const m = window.location.href.match(/^(https:\/\/[^/]+)/);
    if (m) return m[1];
  } catch (_) {}
  return 'https://phishing-detector-orpin-ten.vercel.app';
}());

let apiBase        = DEFAULT_URL;
let currentEmail   = null;
let reported       = false;
let officeReady    = false;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

// ── Office initialisation ─────────────────────────────────────────────────────
Office.onReady(info => {
  officeReady = true;
  if (info.host !== Office.HostType.Outlook) {
    showError('PhishGuard requires Microsoft Outlook.');
    return;
  }
  loadSettingsAndAnalyze();
});

// ── Settings ──────────────────────────────────────────────────────────────────
function getSettings() {
  const r = Office.context.roamingSettings;
  return {
    apiUrl: r.get('apiUrl') || DEFAULT_URL,
    apiKey: r.get('apiKey') || '',
  };
}

function loadSettingsAndAnalyze() {
  const { apiUrl, apiKey } = getSettings();
  apiBase = apiUrl;
  $('apiUrl').value = apiUrl;
  $('apiKey').value = apiKey;

  if (!apiKey) {
    setState('needs-key');
    openSettings();
    return;
  }

  analyzeCurrentEmail();
}

$('gearBtn').addEventListener('click', () => {
  const panel = $('settingsPanel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

$('saveBtn').addEventListener('click', () => {
  const url = $('apiUrl').value.trim().replace(/\/$/, '') || DEFAULT_URL;
  const key = $('apiKey').value.trim();
  const r   = Office.context.roamingSettings;
  r.set('apiUrl', url);
  r.set('apiKey', key);
  r.saveAsync(result => {
    if (result.status === Office.AsyncResultStatus.Succeeded) {
      apiBase = url;
      $('savedMsg').style.display = 'block';
      setTimeout(() => { $('savedMsg').style.display = 'none'; }, 3000);
      reported = false;
      analyzeCurrentEmail();
    }
  });
});

$('retryBtn').addEventListener('click', () => analyzeCurrentEmail());

function openSettings() {
  $('settingsPanel').style.display = 'block';
}

// ── States ────────────────────────────────────────────────────────────────────
function setState(name) {
  ['init', 'scanning', 'needs-key', 'error', 'result'].forEach(s => {
    $(`state-${s}`).classList.toggle('active', s === name);
  });
}

function showError(msg) {
  $('error-text').textContent = msg;
  setState('error');
  setConn('err', 'Connection failed');
}

// ── Connection indicator ──────────────────────────────────────────────────────
function setConn(state, text) {
  $('connDot').className = 'conn-dot ' + state;
  $('connText').textContent = text;
}

async function checkConnection() {
  setConn('loading', 'Checking connection...');
  try {
    const res = await fetch(`${apiBase}/api/health`);
    if (res.ok) setConn('ok', 'Connected to PhishGuard');
    else setConn('err', `Server error (${res.status})`);
  } catch {
    setConn('err', 'Cannot reach server');
  }
}

// ── Email analysis ────────────────────────────────────────────────────────────
function analyzeCurrentEmail() {
  if (!officeReady) return;
  const { apiKey, apiUrl } = getSettings();
  apiBase = apiUrl;

  if (!apiKey) {
    setState('needs-key');
    openSettings();
    return;
  }

  const item = Office.context.mailbox.item;
  if (!item) {
    showError('No email is currently open. Click an email to analyze it.');
    return;
  }

  setState('scanning');
  setConn('loading', 'Analyzing...');

  // Collect synchronous fields
  const subject     = item.subject || '(no subject)';
  const senderEmail = item.from?.emailAddress || '';
  const senderName  = item.from?.displayName  || '';
  const sender      = senderName ? `${senderName} <${senderEmail}>` : senderEmail;

  // Get HTML body (async)
  item.body.getAsync(Office.CoercionType.Html, async result => {
    if (result.status !== Office.AsyncResultStatus.Succeeded) {
      showError('Could not read the email body. Please try again.');
      return;
    }

    const bodyHtml = result.value || '';
    // Derive plain text from HTML
    const tmp = document.createElement('div');
    tmp.innerHTML = bodyHtml;
    const bodyText = tmp.innerText || tmp.textContent || '';

    // Capture internet headers for SPF/DKIM/DMARC analysis (Outlook only)
    let rawHeaders = '';
    if (item.getAllInternetHeadersAsync) {
      await new Promise(resolve => {
        item.getAllInternetHeadersAsync(r => {
          if (r.status === Office.AsyncResultStatus.Succeeded) rawHeaders = r.value || '';
          resolve(null);
        });
      });
    }

    currentEmail = { subject, sender, senderEmail, bodyText, bodyHtml, rawHeaders };

    // Update meta display
    $('meta-sender').textContent  = sender  || '—';
    $('meta-subject').textContent = subject || '—';

    try {
      checkConnection(); // fire-and-forget for the indicator

      const res = await fetch(`${apiBase}/api/emails/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify({ sender, subject, body_text: bodyText, body_html: bodyHtml }),
      });

      if (!res.ok) {
        let msg = 'Analysis failed. Check your API key.';
        try { const d = await res.json(); msg = d.error || msg; } catch (_) {}
        showError(msg + ` (HTTP ${res.status})`);
        return;
      }

      const data = await res.json();
      showResult(data);
    } catch (e) {
      const detail = (e && e.message) ? ` (${e.message})` : '';
      showError('Cannot reach PhishGuard server. Check the Server URL in settings.' + detail);
    }
  });
}

// ── Display result ────────────────────────────────────────────────────────────
const ICONS  = { low: '✅', medium: '⚠️', high: '🔶', critical: '🚨' };
const LABELS = { low: 'Safe Email', medium: 'Possible Phishing', high: 'Likely Phishing', critical: 'Phishing Detected' };
const DESCS  = {
  low:      'No significant threats detected in this email.',
  medium:   'Some suspicious signals found — review carefully before clicking any links.',
  high:     'Multiple phishing indicators detected. Do not click links or enter credentials.',
  critical: 'This email shows strong signs of phishing. Do not interact with it.',
};

function showResult(data) {
  const level = data.risk_level || 'low';
  const score = data.risk_score ?? 0;
  const LEVELS = ['low', 'medium', 'high', 'critical'];

  // Risk card
  const card = $('risk-card');
  LEVELS.forEach(l => card.classList.remove(l));
  card.classList.add(level);

  // Label + badge
  const label = $('risk-label');
  LEVELS.forEach(l => label.classList.remove(l));
  label.classList.add(level);
  label.textContent = LABELS[level] || level;

  const badge = $('risk-badge');
  LEVELS.forEach(l => badge.classList.remove(l));
  badge.classList.add(level);

  const bar = $('risk-bar');
  LEVELS.forEach(l => bar.classList.remove(l));
  bar.classList.add(level);

  $('risk-icon').textContent  = ICONS[level] || '🔍';
  $('risk-score').textContent = score;
  bar.style.width             = score + '%';
  $('risk-desc').textContent  = DESCS[level] || '';

  // Signal chips
  const signalsEl = $('signals');
  signalsEl.innerHTML = '';
  (data.signals || []).slice(0, 6).forEach(s => {
    const chip = document.createElement('span');
    chip.className   = 'signal-chip';
    chip.textContent = '⚑ ' + s.label;
    signalsEl.appendChild(chip);
  });

  // Report button state
  const btn = $('reportBtn');
  reported = false;
  btn.disabled  = false;
  btn.className = 'btn-report';
  btn.textContent = '🚩 Report as Phishing';
  // Hide report button for safe emails
  btn.style.display = level === 'low' ? 'none' : 'flex';

  setState('result');
  setConn('ok', 'Analysis complete');
}

// ── Report ────────────────────────────────────────────────────────────────────
$('reportBtn').addEventListener('click', async () => {
  if (reported || !currentEmail) return;
  const { apiKey } = getSettings();

  const btn = $('reportBtn');
  btn.disabled     = true;
  btn.textContent  = 'Reporting...';

  const reporterEmail = Office.context.mailbox.userProfile?.emailAddress || 'unknown@company.com';

  try {
    const res = await fetch(`${apiBase}/api/emails/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify({
        reporter_email:  reporterEmail,
        subject:         currentEmail.subject,
        sender:          currentEmail.sender,
        email_body_text: currentEmail.bodyText,
        email_body_html: currentEmail.bodyHtml,
        raw_headers:     currentEmail.rawHeaders,
        source:          'outlook_addin',
      }),
    });

    if (res.ok) {
      reported         = true;
      btn.className    = 'btn-report reported';
      btn.textContent  = '✅ Reported to Security Team';
      btn.disabled     = false;
    } else {
      const d = await res.json();
      btn.textContent  = '⚠️ ' + (d.error || 'Report failed');
      btn.disabled     = false;
      setTimeout(() => { btn.textContent = '🚩 Report as Phishing'; }, 3000);
    }
  } catch {
    btn.textContent = '⚠️ Cannot reach server';
    btn.disabled    = false;
    setTimeout(() => { btn.textContent = '🚩 Report as Phishing'; }, 3000);
  }
});
