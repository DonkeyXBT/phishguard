const ANALYZED_ATTR = 'data-phishguard-analyzed';
let currentScan      = null;
let currentEmailData = null;

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_SCAN') {
    sendResponse({ scan: currentScan, emailData: currentEmailData });
    return true;
  }
  if (message.type === 'REPORT_CURRENT_EMAIL') {
    if (!currentEmailData) { sendResponse({ ok: false, error: 'No email data' }); return true; }
    chrome.runtime.sendMessage(
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
// Ordered from most to least stable. Uses multiple fallbacks because Outlook
// frequently changes its CSS class names.

function findReadingPane() {
  const candidates = [
    // Stable semantic / data attributes
    '[data-app-section="ReadingPane"]',
    '[data-testid="ReadingPane"]',
    // Fluent UI / class-name patterns
    '[class*="ReadingPaneContent"]',
    '[class*="readingPane"]:not([class*="List"])',
    '[class*="ReadingPane"]:not([class*="List"])',
    // Broad fallback — main content region that contains an email header
    '[role="main"]',
  ];
  for (const sel of candidates) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        // Must be visible and tall enough to be the reading area
        if (el.offsetHeight > 80 && el.querySelector('h1, [role="heading"], [class*="subject" i]')) {
          return el;
        }
      }
      // Looser check: just visible
      for (const el of els) {
        if (el.offsetHeight > 80) return el;
      }
    } catch {}
  }
  return null;
}

function getSubject() {
  const selectors = [
    '[data-testid="subject"]',
    '[data-app-section="subject"]',
    'h1[class*="subject" i]',
    'h1[class*="Subject"]',
    '[class*="SubjectLine"]',
    '[class*="subjectLine"]',
    '[role="heading"][aria-level="1"]',
    'h1[role="heading"]',
    '[class*="subject"][role="heading"]',
  ];
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    } catch {}
  }
  // Final fallback: title bar
  return document.title.split(' - ')[0]?.trim() || '';
}

function getSender() {
  const selectors = [
    '[data-testid*="sender"] [data-testid*="name"]',
    '[data-testid="senderName"]',
    '[class*="personaName"]',
    '[class*="PersonaName"]',
    '[class*="senderName"]',
    '[class*="SenderName"]',
    '[class*="fromAddress"]',
    '[class*="FromAddress"]',
    '[class*="sender"] [class*="name" i]',
    '[class*="from" i] [class*="name" i]',
    '[aria-label*="From"] [class*="name" i]',
  ];
  for (const sel of selectors) {
    try {
      const el = document.querySelector(sel);
      if (el?.textContent?.trim()) return el.textContent.trim();
    } catch {}
  }
  return '';
}

function getBodyContent(pane) {
  // Outlook sometimes renders the email inside a sandboxed iframe
  const iframe = pane?.querySelector('iframe') || document.querySelector('[class*="ReadingPane"] iframe, [class*="readingPane"] iframe');
  if (iframe) {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc?.body?.innerText?.trim()) {
        return { text: doc.body.innerText.trim(), html: doc.body.innerHTML };
      }
    } catch {}
  }

  const bodySelectors = [
    '[data-app-section="MessageBody"]',
    '[data-testid="MessageBody"]',
    '[id*="UniqueMessageBody"]',
    '[class*="messageBody" i]',
    '[class*="MessageBody"]',
    '[class*="bodyContainer"]',
    '[class*="readingPaneBody"]',
    '[class*="ReadingPaneContent"]',
  ];
  for (const sel of bodySelectors) {
    try {
      const el = (pane || document).querySelector(sel);
      if (el?.innerText?.trim()) return { text: el.innerText.trim(), html: el.innerHTML };
    } catch {}
  }

  // Last resort: use the pane itself
  const text = pane?.innerText?.trim() || '';
  return { text, html: pane?.innerHTML || '' };
}

function parseOutlookEmail(pane) {
  const subject = getSubject();
  const sender  = getSender();
  const body    = getBodyContent(pane);
  return { subject, sender, reply_to: '', body_text: body.text, body_html: body.html };
}

// ── Deletion handling ─────────────────────────────────────────────────────────
function checkAndHandleDeletion(emailData) {
  chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
    const match = deletedEmails.find(d => matchesDeletion(emailData, d));
    if (!match || ackedDeletions.includes(match.id)) return;
    const pane = findReadingPane();
    if (!pane) return;
    replaceBannerWithDeletion(pane);
    attemptOutlookDelete();
    chrome.storage.local.set({ ackedDeletions: [...ackedDeletions, match.id] });
  });
}

function replaceBannerWithDeletion(pane) {
  pane.querySelector('.phishguard-wrap, .phishguard-loading')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'phishguard-wrap open';
  wrap.style.cssText = 'margin: 8px 16px 10px;';
  wrap.innerHTML = `
    <div class="phishguard-bar pg-deleted">
      <span class="phishguard-bar-icon">⛔</span>
      <span class="phishguard-bar-label">Removed by Security Team</span>
      <span class="phishguard-bar-score">· Confirmed Phishing</span>
    </div>
    <div class="phishguard-details pg-deleted">
      <div class="phishguard-desc">Your IT security team reviewed and confirmed this email is phishing. It has been moved to trash.</div>
      <div class="phishguard-signals">
        <span class="phishguard-signal-tag">🛡️ Admin reviewed</span>
        <span class="phishguard-signal-tag">🗑️ Moved to trash</span>
      </div>
    </div>`;
  pane.insertBefore(wrap, pane.firstChild);
}

function attemptOutlookDelete() {
  const selectors = ['[title="Delete"]', '[aria-label="Delete"]', '[data-icon-name="Delete"]'];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn) { btn.click(); return; }
  }
}

// ── Banner creation ───────────────────────────────────────────────────────────
const ICONS  = { low: '✅', medium: '⚠️', high: '🔶', critical: '🚨' };
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
  const signalHtml = topSignals.map(s => `<span class="phishguard-signal-tag">⚑ ${s}</span>`).join('');

  const toggleHtml  = !isSafe ? `<span class="phishguard-bar-toggle">▼</span>` : '';
  const detailsHtml = !isSafe ? `
    <div class="phishguard-details pg-${level}">
      <div class="phishguard-desc">${DESCS[level] || ''}</div>
      ${signalHtml ? `<div class="phishguard-signals">${signalHtml}</div>` : ''}
      <div class="phishguard-actions">
        <button class="phishguard-btn phishguard-btn-report">🚩 Report as Phishing</button>
        <button class="phishguard-btn phishguard-btn-dismiss">Dismiss</button>
      </div>
    </div>` : '';

  wrap.innerHTML = `
    <div class="phishguard-bar pg-${level}">
      <span class="phishguard-bar-icon">${ICONS[level] || '🔍'}</span>
      <span class="phishguard-bar-label">PhishGuard: ${LABELS[level] || level}</span>
      <span class="phishguard-bar-score">· ${score}/100</span>
      ${toggleHtml}
      <button class="phishguard-bar-close" title="Dismiss">×</button>
    </div>
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
    chrome.runtime.sendMessage(
      { type: 'REPORT_EMAIL', data: buildReportPayload(emailData) },
      response => {
        if (response?.result) {
          this.textContent = '✅ Reported to Admin';
          this.style.background = '#16a34a';
        } else {
          this.textContent = 'Error — try again';
          this.disabled = false;
        }
      }
    );
  });

  return wrap;
}

// ── Analysis ──────────────────────────────────────────────────────────────────
// Track last analyzed pane key to detect email switches
let lastAnalyzedKey = '';

function analyzePane(pane) {
  const emailData = parseOutlookEmail(pane);
  if (!emailData.body_text && !emailData.sender) return;

  const key = emailData.subject + '|' + emailData.sender;
  if (lastAnalyzedKey === key) return; // same email, skip
  lastAnalyzedKey = key;

  // Reset analyzed attr so switching back to a pane triggers re-analysis
  pane.removeAttribute(ANALYZED_ATTR);
  if (pane.hasAttribute(ANALYZED_ATTR)) return;
  pane.setAttribute(ANALYZED_ATTR, '1');

  pane.querySelector('.phishguard-wrap, .phishguard-loading')?.remove();

  const loading = document.createElement('div');
  loading.className = 'phishguard-loading';
  loading.style.cssText = 'margin: 8px 16px;';
  loading.innerHTML = '<div class="phishguard-loading-dot"></div> PhishGuard analyzing...';
  pane.insertBefore(loading, pane.firstChild);

  chrome.runtime.sendMessage(
    { type: 'ANALYZE_EMAIL', data: { sender: emailData.sender, subject: emailData.subject, body_text: emailData.body_text, body_html: emailData.body_html } },
    (response) => {
      loading.remove();
      if (response?.result) {
        currentScan      = response.result;
        currentEmailData = emailData;

        chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
          const match = deletedEmails.find(d => matchesDeletion(emailData, d));
          if (match && !ackedDeletions.includes(match.id)) {
            replaceBannerWithDeletion(pane);
            attemptOutlookDelete();
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

function scheduleScan() {
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    const pane = findReadingPane();
    if (pane) analyzePane(pane);
  }, 600); // debounce — Outlook's DOM settles ~500ms after navigation
}

const observer = new MutationObserver(scheduleScan);
observer.observe(document.body, { childList: true, subtree: true });
scheduleScan();
