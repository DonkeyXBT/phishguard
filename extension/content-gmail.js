const ANALYZED_ATTR = 'data-phishguard-analyzed';
let currentUserEmail = '';
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
    reporter_email:  currentUserEmail || 'unknown@unknown.com',
    subject:         d.subject,
    sender:          d.sender,
    reply_to:        d.reply_to,
    email_body_text: d.body_text,
    email_body_html: d.body_html,
    source: 'user_report',
  };
}

function matchesDeletion(emailData, d) {
  const n = s => (s || '').toLowerCase().trim();
  return n(emailData.subject) === n(d.subject) && n(emailData.sender) === n(d.sender);
}

// ── Deletion handling ─────────────────────────────────────────────────────────
function checkAndHandleDeletion(emailData) {
  chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
    const match = deletedEmails.find(d => matchesDeletion(emailData, d));
    if (!match || ackedDeletions.includes(match.id)) return;
    const container = document.querySelector('.adn.ads[data-phishguard-analyzed], .gs[data-phishguard-analyzed]');
    if (!container) return;
    replaceBannerWithDeletion(container);
    attemptGmailDelete();
    chrome.storage.local.set({ ackedDeletions: [...ackedDeletions, match.id] });
  });
}

function replaceBannerWithDeletion(container) {
  const existing = container.querySelector('.phishguard-wrap, .phishguard-loading');
  if (existing) existing.remove();
  const wrap = document.createElement('div');
  wrap.className = 'phishguard-wrap open';
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
  container.insertBefore(wrap, container.firstChild);
}

function attemptGmailDelete() {
  const selectors = ['[data-tooltip="Delete"]', '[aria-label="Delete"]', '[title="Delete"]'];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn) { btn.click(); return; }
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '#', bubbles: true, cancelable: true }));
}

// ── Email parsing ─────────────────────────────────────────────────────────────
function getUserEmail() {
  const el = document.querySelector('[data-email]');
  if (el) return el.getAttribute('data-email') || '';
  return document.querySelector('.gb_A.gb_La.gb_f')?.textContent?.trim() || '';
}

function parseGmailEmail(container) {
  const subjectEl = document.querySelector('h2[data-legacy-thread-id], [data-thread-id] h2, .hP');
  const subject   = subjectEl?.textContent?.trim() || document.title.replace(' - Gmail', '').trim();
  const senderEl  = container.querySelector('[email]') || container.querySelector('.gD');
  const sender    = senderEl?.getAttribute('email') || senderEl?.textContent?.trim() || '';
  const replyTo   = container.querySelector('[data-hovercard-id]')?.getAttribute('data-hovercard-id') || '';
  const bodyEl    = container.querySelector('.a3s.aiL') || container.querySelector('[data-message-id] .ii.gt div');
  return { subject, sender, reply_to: replyTo, body_text: bodyEl?.innerText?.trim() || '', body_html: bodyEl?.innerHTML || '' };
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
  const level = result.risk_level || 'low';
  const score = result.risk_score ?? 0;
  const isSafe = level === 'low';

  const wrap = document.createElement('div');
  wrap.className = 'phishguard-wrap';

  const topSignals = (result.signals || []).slice(0, 5).map(s => s.label);
  const signalHtml = topSignals.length
    ? topSignals.map(s => `<span class="phishguard-signal-tag">⚑ ${s}</span>`).join('')
    : '';

  const toggleHtml = !isSafe ? `<span class="phishguard-bar-toggle">▼</span>` : '';
  const closeHtml  = `<button class="phishguard-bar-close" title="Dismiss">×</button>`;
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
      ${closeHtml}
    </div>
    ${detailsHtml}`;

  // Toggle expand/collapse on bar click (for non-safe levels)
  if (!isSafe) {
    wrap.querySelector('.phishguard-bar').addEventListener('click', e => {
      if (e.target.closest('.phishguard-bar-close')) return;
      wrap.classList.toggle('open');
    });
  }

  // Close/dismiss
  wrap.querySelector('.phishguard-bar-close')?.addEventListener('click', () => wrap.remove());
  wrap.querySelector('.phishguard-btn-dismiss')?.addEventListener('click', () => wrap.remove());

  // Report button
  wrap.querySelector('.phishguard-btn-report')?.addEventListener('click', function () {
    this.textContent = 'Reporting...';
    this.disabled = true;
    chrome.runtime.sendMessage(
      { type: 'REPORT_EMAIL', data: buildReportPayload(emailData) },
      (response) => {
        if (response?.result) {
          this.textContent = '✅ Reported';
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
function analyzeEmailContainer(container) {
  if (container.hasAttribute(ANALYZED_ATTR)) return;
  container.setAttribute(ANALYZED_ATTR, '1');

  const emailData = parseGmailEmail(container);
  if (!emailData.sender && !emailData.body_text) return;

  const loading = document.createElement('div');
  loading.className = 'phishguard-loading';
  loading.innerHTML = '<div class="phishguard-loading-dot"></div> PhishGuard analyzing...';
  container.insertBefore(loading, container.firstChild);

  chrome.runtime.sendMessage(
    { type: 'ANALYZE_EMAIL', data: { sender: emailData.sender, reply_to: emailData.reply_to, subject: emailData.subject, body_text: emailData.body_text, body_html: emailData.body_html } },
    (response) => {
      loading.remove();
      if (response?.result) {
        currentScan      = response.result;
        currentEmailData = emailData;

        chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
          const match = deletedEmails.find(d => matchesDeletion(emailData, d));
          if (match && !ackedDeletions.includes(match.id)) {
            replaceBannerWithDeletion(container);
            attemptGmailDelete();
            chrome.storage.local.set({ ackedDeletions: [...ackedDeletions, match.id] });
          } else {
            const banner = createBanner(response.result, emailData);
            container.insertBefore(banner, container.firstChild);
          }
        });
      } else if (response?.error) {
        console.warn('[PhishGuard]', response.error);
      }
    }
  );
}

function scanForEmails() {
  currentUserEmail = getUserEmail();
  document.querySelectorAll('.adn.ads:not([data-phishguard-analyzed]), .gs:not([data-phishguard-analyzed])')
    .forEach(el => { if (el.querySelector('.a3s')) analyzeEmailContainer(el); });
}

const observer = new MutationObserver(() => scanForEmails());
observer.observe(document.body, { childList: true, subtree: true });
scanForEmails();
