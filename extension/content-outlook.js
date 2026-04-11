const ANALYZED_ATTR = 'data-phishguard-analyzed';
let currentScan      = null;
let currentEmailData = null;
let analyzing        = false;
let contextValid     = true;

// Guard against extension context invalidation (happens after extension reload)
function safeSendMessage(msg, cb) {
  if (!contextValid) return;
  try {
    chrome.runtime.sendMessage(msg, response => {
      if (chrome.runtime.lastError) {
        contextValid = false;
        return;
      }
      if (cb) cb(response);
    });
  } catch {
    contextValid = false;
  }
}

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_SCAN') {
    sendResponse({ scan: currentScan, emailData: currentEmailData, analyzing });
    return true;
  }
  if (message.type === 'REPORT_CURRENT_EMAIL') {
    if (!currentEmailData) { sendResponse({ ok: false, error: 'No email data' }); return true; }
    safeSendMessage(
      { type: 'REPORT_EMAIL', data: buildReportPayload(currentEmailData) },
      r => sendResponse(r?.result ? { ok: true } : { ok: false, error: r?.error || 'Failed' })
    );
    return true;
  }
  if (message.type === 'DELETIONS_UPDATED') {
    if (currentEmailData) checkAndHandleDeletion(currentEmailData);
    return true;
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function buildReportPayload(d) {
  return {
    reporter_email:  'user@company.com',
    subject:         d.subject,
    sender:          d.sender,
    email_body_text: d.body_text,
    email_body_html: d.body_html,
    source: 'user_report',
  };
}

function matchesDeletion(emailData, d) {
  const n = s => (s || '').toLowerCase().trim();
  return n(emailData.subject) === n(d.subject) && n(emailData.sender) === n(d.sender);
}

// ── Outlook DOM helpers ───────────────────────────────────────────────────────
function findReadingPane() {
  const candidates = [
    // Standard reading pane selectors
    '[data-app-section="ReadingPane"]',
    '[data-testid="ReadingPane"]',
    '[class*="ReadingPaneContent"]',
    '[class*="readingPane"]:not([class*="List"])',
    '[class*="ReadingPane"]:not([class*="List"])',
    // Junk/Spam email view — may have different container structure
    '[class*="JunkEmail"]',
    '[class*="junkEmail"]',
    '[class*="ItemReadingPane"]',
    '[class*="itemReadingPane"]',
    // Conversation view container
    '[class*="ConversationReadingPane"]',
    // Broad fallback — main content region
    '[role="main"]',
    // Last resort — anything with a message body inside
    '[role="region"]',
  ];
  for (const sel of candidates) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.offsetHeight > 80 && el.querySelector('h1, [role="heading"], [class*="subject" i], [class*="Subject"]')) return el;
      }
      for (const el of els) {
        if (el.offsetHeight > 80) return el;
      }
    } catch {}
  }
  // Fallback: find any visible element that contains a message body
  const bodySelectors = ['[id*="UniqueMessageBody"]', '[class*="MessageBody"]', '[class*="messageBody" i]'];
  for (const sel of bodySelectors) {
    try {
      const el = document.querySelector(sel);
      if (el?.offsetHeight > 50) return el.closest('[role="main"], [role="region"], [class*="ReadingPane"], [class*="readingPane"]') || el.parentElement;
    } catch {}
  }
  return null;
}

function getSubject() {
  const selectors = [
    '[data-testid="subject"]', '[data-app-section="subject"]',
    'h1[class*="subject" i]', 'h1[class*="Subject"]',
    '[class*="SubjectLine"]', '[class*="subjectLine"]',
    '[role="heading"][aria-level="1"]', 'h1[role="heading"]',
  ];
  for (const sel of selectors) {
    try { const el = document.querySelector(sel); if (el?.textContent?.trim()) return el.textContent.trim(); } catch {}
  }
  return document.title.split(' - ')[0]?.trim() || '';
}

function getSender() {
  const selectors = [
    '[data-testid*="sender"] [data-testid*="name"]', '[data-testid="senderName"]',
    '[class*="personaName"]', '[class*="PersonaName"]',
    '[class*="senderName"]', '[class*="SenderName"]',
    '[class*="fromAddress"]', '[class*="FromAddress"]',
  ];
  for (const sel of selectors) {
    try { const el = document.querySelector(sel); if (el?.textContent?.trim()) return el.textContent.trim(); } catch {}
  }
  return '';
}

function getBodyContent(pane) {
  const iframe = pane?.querySelector('iframe') || document.querySelector('[class*="ReadingPane"] iframe');
  if (iframe) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc?.body?.innerText?.trim()) return { text: doc.body.innerText.trim(), html: doc.body.innerHTML };
    } catch {}
  }
  const bodySelectors = [
    '[data-app-section="MessageBody"]', '[data-testid="MessageBody"]',
    '[id*="UniqueMessageBody"]', '[class*="messageBody" i]',
    '[class*="MessageBody"]', '[class*="bodyContainer"]',
  ];
  for (const sel of bodySelectors) {
    try { const el = (pane || document).querySelector(sel); if (el?.innerText?.trim()) return { text: el.innerText.trim(), html: el.innerHTML }; } catch {}
  }
  return { text: pane?.innerText?.trim() || '', html: pane?.innerHTML || '' };
}

function parseOutlookEmail(pane) {
  const subject = getSubject();
  const sender  = getSender();
  const body    = getBodyContent(pane);
  return { subject, sender, reply_to: '', body_text: body.text, body_html: body.html };
}

// ── Deletion handling — full phishing cover ──────────────────────────────────
function checkAndHandleDeletion(emailData) {
  chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
    const match = deletedEmails.find(d => matchesDeletion(emailData, d));
    if (!match || ackedDeletions.includes(match.id)) return;
    const pane = findReadingPane();
    if (!pane) return;
    showPhishingCover(pane);
    chrome.storage.local.set({ ackedDeletions: [...ackedDeletions, match.id] });
  });
}

function showPhishingCover(container) {
  container.querySelectorAll('.phishguard-wrap, .phishguard-loading, .phishguard-cover').forEach(el => el.remove());

  const cover = document.createElement('div');
  cover.className = 'phishguard-cover';
  cover.innerHTML = `
    <div class="phishguard-cover-inner">
      <div class="phishguard-cover-icon">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="#dc2626" stroke-width="1.5">
          <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/>
          <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div class="phishguard-cover-title">Phishing Email Detected</div>
      <div class="phishguard-cover-subtitle">Your security team has reviewed this email and confirmed it is a phishing attempt.</div>
      <div class="phishguard-cover-tags">
        <span class="phishguard-cover-tag">Admin Reviewed</span>
        <span class="phishguard-cover-tag">Marked for Deletion</span>
      </div>
      <div class="phishguard-cover-warning">Do not interact with this email. Do not click any links or download attachments.</div>
      <button class="phishguard-cover-delete-btn" id="pgCoverDeleteBtn">Delete This Email</button>
    </div>`;

  // Find the message body and cover it
  const bodySelectors = [
    '[data-app-section="MessageBody"]', '[data-testid="MessageBody"]',
    '[id*="UniqueMessageBody"]', '[class*="messageBody" i]', '[class*="MessageBody"]',
  ];
  let bodyEl = null;
  for (const sel of bodySelectors) {
    try { bodyEl = container.querySelector(sel); if (bodyEl) break; } catch {}
  }

  if (bodyEl) {
    bodyEl.style.position = 'relative';
    bodyEl.innerHTML = '';
    bodyEl.appendChild(cover);
  } else {
    container.insertBefore(cover, container.firstChild);
  }

  cover.querySelector('#pgCoverDeleteBtn')?.addEventListener('click', attemptOutlookDelete);
}

function attemptOutlookDelete() {
  const selectors = ['[title="Delete"]', '[aria-label="Delete"]', '[data-icon-name="Delete"]', 'button[aria-label*="Delete"]'];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn) { btn.click(); return; }
  }
}

// ── Email auth badge builder ─────────────────────────────────────────────────
function buildAuthHtml(emailAuth) {
  if (!emailAuth) return '';
  const checks = [
    { label: 'SPF', status: emailAuth.spf?.status },
    { label: 'DKIM', status: emailAuth.dkim?.status },
    { label: 'DMARC', status: emailAuth.dmarc?.status },
  ].filter(c => c.status && c.status !== 'unknown');
  if (checks.length === 0) return '';

  const badges = checks.map(c => {
    const pass = c.status === 'pass';
    const cls = pass ? 'phishguard-auth-pass' : 'phishguard-auth-fail';
    const icon = pass
      ? '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
      : '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    return `<span class="phishguard-auth-badge ${cls}">${icon} ${c.label}</span>`;
  }).join('');
  return `<div class="phishguard-auth-row">${badges}</div>`;
}

// ── Banner creation ───────────────────────────────────────────────────────────
const LABELS = { low: 'Safe Email', medium: 'Possible Phishing', high: 'Likely Phishing', critical: 'Phishing Detected' };
const DESCS  = {
  low:      'No significant threats detected in this email.',
  medium:   'Some suspicious signals found — review carefully before clicking any links.',
  high:     'Multiple phishing indicators detected. Do not click links or provide credentials.',
  critical: 'This email shows strong signs of phishing. Do not interact with it.',
};

function createBanner(result, emailData) {
  const level  = result.risk_level || 'low';
  const score  = result.risk_score ?? 0;
  const isSafe = level === 'low';

  const wrap = document.createElement('div');
  wrap.className = 'phishguard-wrap';
  wrap.style.cssText = 'margin: 8px 16px 10px;';

  const topSignals = (result.signals || []).slice(0, 5).map(s => s.label);
  const signalHtml = topSignals.map(s => `<span class="phishguard-signal-tag">${s}</span>`).join('');
  const authHtml = buildAuthHtml(result.email_auth);

  const levelIcons = {
    low: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    medium: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    high: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    critical: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };

  const toggleHtml  = !isSafe ? `<span class="phishguard-bar-toggle">▼</span>` : '';
  const detailsHtml = !isSafe ? `
    <div class="phishguard-details pg-${level}">
      <div class="phishguard-desc">${DESCS[level] || ''}</div>
      ${authHtml}
      ${signalHtml ? `<div class="phishguard-signals">${signalHtml}</div>` : ''}
      <div class="phishguard-actions">
        <button class="phishguard-btn phishguard-btn-report">Report as Phishing</button>
        <button class="phishguard-btn phishguard-btn-dismiss">Dismiss</button>
      </div>
    </div>` : '';

  const safeAuthHtml = isSafe && authHtml ? `<div style="margin:4px 16px 0">${authHtml}</div>` : '';

  wrap.innerHTML = `
    <div class="phishguard-bar pg-${level}">
      <span class="phishguard-bar-icon">${levelIcons[level] || ''}</span>
      <span class="phishguard-bar-label">PhishGuard: ${LABELS[level] || level}</span>
      <span class="phishguard-bar-score">· ${score}/100</span>
      ${toggleHtml}
      <button class="phishguard-bar-close" title="Dismiss">×</button>
    </div>
    ${safeAuthHtml}
    ${detailsHtml}`;

  if (!isSafe) {
    wrap.querySelector('.phishguard-bar').addEventListener('click', e => {
      if (e.target.closest('.phishguard-bar-close')) return;
      wrap.classList.toggle('open');
    });
  }

  wrap.querySelector('.phishguard-bar-close')?.addEventListener('click', () => wrap.remove());
  wrap.querySelector('.phishguard-btn-dismiss')?.addEventListener('click', () => wrap.remove());
  wrap.querySelector('.phishguard-btn-report')?.addEventListener('click', function () {
    this.textContent = 'Reporting...';
    this.disabled = true;
    safeSendMessage(
      { type: 'REPORT_EMAIL', data: buildReportPayload(emailData) },
      response => {
        if (response?.result) { this.textContent = 'Reported'; this.style.background = '#16a34a'; }
        else { this.textContent = 'Error — try again'; this.disabled = false; }
      }
    );
  });

  return wrap;
}

// ── Analysis ──────────────────────────────────────────────────────────────────
let lastAnalyzedKey = '';

function analyzePane(pane) {
  const emailData = parseOutlookEmail(pane);
  if (!emailData.body_text && !emailData.sender) return;

  const key = emailData.subject + '|' + emailData.sender;
  if (lastAnalyzedKey === key) return;

  // New email detected — clear ALL previous PhishGuard elements anywhere in the document
  document.querySelectorAll('.phishguard-wrap, .phishguard-loading, .phishguard-cover').forEach(el => el.remove());
  document.querySelectorAll(`[${ANALYZED_ATTR}]`).forEach(el => el.removeAttribute(ANALYZED_ATTR));

  lastAnalyzedKey = key;
  currentScan = null;
  currentEmailData = null;
  pane.setAttribute(ANALYZED_ATTR, '1');

  analyzing = true;
  currentEmailData = emailData;

  const loading = document.createElement('div');
  loading.className = 'phishguard-loading';
  loading.style.cssText = 'margin: 8px 16px;';
  loading.innerHTML = '<div class="phishguard-loading-dot"></div> PhishGuard analyzing...';
  pane.insertBefore(loading, pane.firstChild);

  safeSendMessage(
    { type: 'ANALYZE_EMAIL', data: { sender: emailData.sender, subject: emailData.subject, body_text: emailData.body_text, body_html: emailData.body_html } },
    (response) => {
      loading.remove();
      analyzing = false;
      if (response?.result) {
        currentScan = response.result;

        if (response.result.admin_reviewed) {
          showPhishingCover(pane);
          return;
        }

        chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
          const match = deletedEmails.find(d => matchesDeletion(emailData, d));
          if (match && !ackedDeletions.includes(match.id)) {
            showPhishingCover(pane);
            chrome.storage.local.set({ ackedDeletions: [...ackedDeletions, match.id] });
          } else {
            const banner = createBanner(response.result, emailData);
            pane.insertBefore(banner, pane.firstChild);
          }
        });
      }
    }
  );
}

// ── Scan trigger ──────────────────────────────────────────────────────────────
let scanTimer = null;
let lastUrl = location.href;

const observer = new MutationObserver(() => {
  if (!contextValid) { observer.disconnect(); return; }

  // Detect URL change (folder navigation)
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    lastAnalyzedKey = '';
    currentScan = null;
    currentEmailData = null;
  }

  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    if (!contextValid) return;
    const pane = findReadingPane();
    if (pane) analyzePane(pane); // analyzePane decides if it's the same email or new
  }, 400);
});
observer.observe(document.body, { childList: true, subtree: true });
setTimeout(() => { const pane = findReadingPane(); if (pane) analyzePane(pane); }, 600);
