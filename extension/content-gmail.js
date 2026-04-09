const ANALYZED_ATTR = 'data-phishguard-analyzed';
let currentUserEmail = '';
let currentScan      = null;
let currentEmailData = null;
let analyzing = false;
let contextValid = true;

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

// ── Deletion handling — full-screen phishing cover ───────────────────────────
function checkAndHandleDeletion(emailData) {
  chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
    const match = deletedEmails.find(d => matchesDeletion(emailData, d));
    if (!match || ackedDeletions.includes(match.id)) return;
    const container = document.querySelector(
      '.adn.ads[data-phishguard-analyzed], .gs[data-phishguard-analyzed], [data-message-id][data-phishguard-analyzed], .nH.hx[data-phishguard-analyzed]'
    );
    if (!container) return;
    showPhishingCover(container);
    chrome.storage.local.set({ ackedDeletions: [...ackedDeletions, match.id] });
  });
}

function showPhishingCover(container) {
  // Remove any existing PhishGuard elements
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
        <span class="phishguard-cover-tag">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Admin Reviewed
        </span>
        <span class="phishguard-cover-tag">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Marked for Deletion
        </span>
      </div>
      <div class="phishguard-cover-warning">Do not interact with this email. Do not click any links or download attachments.</div>
      <button class="phishguard-cover-delete-btn" id="pgCoverDeleteBtn">Delete This Email</button>
    </div>`;

  // Cover the email body — position over it
  const bodyEl = container.querySelector('.a3s.aiL') || container.querySelector('.a3s') || container.querySelector('.ii.gt');
  if (bodyEl) {
    bodyEl.style.position = 'relative';
    bodyEl.innerHTML = '';
    bodyEl.appendChild(cover);
  } else {
    container.insertBefore(cover, container.firstChild);
  }

  cover.querySelector('#pgCoverDeleteBtn')?.addEventListener('click', () => {
    attemptGmailDelete();
  });
}

function attemptGmailDelete() {
  const selectors = ['[data-tooltip="Delete"]', '[aria-label="Delete"]', '[title="Delete"]', 'button[aria-label*="Delete"]'];
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
  const level = result.risk_level || 'low';
  const score = result.risk_score ?? 0;
  const isSafe = level === 'low';

  const wrap = document.createElement('div');
  wrap.className = 'phishguard-wrap';

  const topSignals = (result.signals || []).slice(0, 5).map(s => s.label);
  const signalHtml = topSignals.length
    ? topSignals.map(s => `<span class="phishguard-signal-tag">${s}</span>`).join('')
    : '';

  const authHtml = buildAuthHtml(result.email_auth);

  const toggleHtml = !isSafe ? `<span class="phishguard-bar-toggle">▼</span>` : '';
  const closeHtml  = `<button class="phishguard-bar-close" title="Dismiss">×</button>`;

  const levelIcons = {
    low: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
    medium: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    high: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    critical: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
  };

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

  const safeAuthHtml = isSafe && authHtml ? `<div style="margin-top:4px">${authHtml}</div>` : '';

  wrap.innerHTML = `
    <div class="phishguard-bar pg-${level}">
      <span class="phishguard-bar-icon">${levelIcons[level] || ''}</span>
      <span class="phishguard-bar-label">PhishGuard: ${LABELS[level] || level}</span>
      <span class="phishguard-bar-score">· ${score}/100</span>
      ${toggleHtml}
      ${closeHtml}
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
      (response) => {
        if (response?.result) {
          this.textContent = 'Reported';
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

  analyzing = true;
  currentEmailData = emailData;

  const loading = document.createElement('div');
  loading.className = 'phishguard-loading';
  loading.innerHTML = '<div class="phishguard-loading-dot"></div> PhishGuard analyzing...';
  container.insertBefore(loading, container.firstChild);

  safeSendMessage(
    { type: 'ANALYZE_EMAIL', data: { sender: emailData.sender, reply_to: emailData.reply_to, subject: emailData.subject, body_text: emailData.body_text, body_html: emailData.body_html } },
    (response) => {
      loading.remove();
      analyzing = false;
      if (response?.result) {
        currentScan = response.result;

        chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
          const match = deletedEmails.find(d => matchesDeletion(emailData, d));
          if (match && !ackedDeletions.includes(match.id)) {
            showPhishingCover(container);
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

  // If we already have a PhishGuard banner visible on this page, skip
  if (document.querySelector('.phishguard-wrap, .phishguard-loading, .phishguard-cover')) return;

  // Find the last (most recent) message container in the thread — only analyze that one
  const selectors = [
    '.adn.ads:not([data-phishguard-analyzed])',
    '.gs:not([data-phishguard-analyzed])',
    '[data-message-id]:not([data-phishguard-analyzed])',
    '.nH.hx:not([data-phishguard-analyzed])',
  ];
  const allContainers = document.querySelectorAll(selectors.join(', '));
  // Pick only the last container (most recent message in the thread)
  const containers = Array.from(allContainers).filter(el =>
    el.querySelector('.a3s') || el.querySelector('.a3s.aiL') || el.querySelector('[data-message-id] .ii.gt div') || el.querySelector('.ii.gt')
  );
  const target = containers[containers.length - 1];
  if (target) {
    // Mark all containers as analyzed so we don't process them again
    containers.forEach(el => el.setAttribute(ANALYZED_ATTR, '1'));
    analyzeEmailContainer(target);
  }
}

// ── Track email switches (Gmail SPA navigation) ──────────────────────────────
let lastSubject = '';
let lastSender  = '';

function detectEmailSwitch() {
  const subjectEl = document.querySelector('h2[data-legacy-thread-id], [data-thread-id] h2, .hP');
  const subject = subjectEl?.textContent?.trim() || '';
  const senderEl = document.querySelector('.adn.ads [email], .gs [email], .gD');
  const sender = senderEl?.getAttribute('email') || senderEl?.textContent?.trim() || '';

  if (subject && sender && (subject !== lastSubject || sender !== lastSender)) {
    lastSubject = subject;
    lastSender  = sender;
    // Clear analyzed flags so the email gets re-scanned
    document.querySelectorAll(`[${ANALYZED_ATTR}]`).forEach(el => {
      el.removeAttribute(ANALYZED_ATTR);
      el.querySelectorAll('.phishguard-wrap, .phishguard-loading, .phishguard-cover').forEach(pg => pg.remove());
    });
    currentScan = null;
    currentEmailData = null;
    analyzing = false;
    scanForEmails();
  }
}

let scanTimeout = null;
const observer = new MutationObserver(() => {
  if (!contextValid) { observer.disconnect(); return; }
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => {
    if (!contextValid) return;
    detectEmailSwitch();
    scanForEmails();
  }, 500);
});
observer.observe(document.body, { childList: true, subtree: true });
scanForEmails();
