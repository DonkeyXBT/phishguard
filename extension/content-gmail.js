const ANALYZED_ATTR = 'data-phishguard-analyzed';
let currentUserEmail = '';
let currentScan      = null;   // last analysis result
let currentEmailData = null;   // last parsed email data (for reporting from popup)

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_SCAN') {
    sendResponse({ scan: currentScan, emailData: currentEmailData });
    return true;
  }

  if (message.type === 'REPORT_CURRENT_EMAIL') {
    if (!currentEmailData) { sendResponse({ ok: false, error: 'No email data' }); return true; }
    chrome.runtime.sendMessage(
      {
        type: 'REPORT_EMAIL',
        data: {
          reporter_email:  currentUserEmail || 'unknown@unknown.com',
          subject:         currentEmailData.subject,
          sender:          currentEmailData.sender,
          reply_to:        currentEmailData.reply_to,
          email_body_text: currentEmailData.body_text,
          email_body_html: currentEmailData.body_html,
          source: 'user_report',
        },
      },
      response => {
        if (response?.result) sendResponse({ ok: true });
        else sendResponse({ ok: false, error: response?.error || 'Failed' });
      }
    );
    return true;
  }

  // Background broadcast when admin deletes a report
  if (message.type === 'DELETIONS_UPDATED') {
    if (currentEmailData) checkAndHandleDeletion(currentEmailData);
    return true;
  }
});

// ── Deletion handling ─────────────────────────────────────────────────────────
function emailMatchesDeletion(emailData, deletion) {
  const norm = s => (s || '').toLowerCase().trim();
  return norm(emailData.subject) === norm(deletion.subject) &&
         norm(emailData.sender)  === norm(deletion.sender);
}

function createDeletionBanner(container) {
  const existing = container.querySelector('.phishguard-banner, .phishguard-loading');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'phishguard-banner pg-deleted';
  banner.innerHTML = `
    <div class="phishguard-icon">⛔</div>
    <div class="phishguard-content">
      <div class="phishguard-header">
        <span class="phishguard-title">Removed by Security Team</span>
        <span class="phishguard-score-pill">Confirmed Phishing</span>
      </div>
      <div class="phishguard-sub">Your IT security team reviewed this email and confirmed it is phishing. It has been moved to trash.</div>
      <div class="phishguard-signals">
        <span class="phishguard-signal-tag">🛡️ Admin reviewed</span>
        <span class="phishguard-signal-tag">🗑️ Moved to trash</span>
      </div>
    </div>
  `;
  container.insertBefore(banner, container.firstChild);
}

function attemptGmailDelete() {
  // Gmail toolbar delete button (various selectors across Gmail versions)
  const selectors = [
    '[data-tooltip="Delete"]',
    '[aria-label="Delete"]',
    '[title="Delete"]',
    '.bA .ar9 [act="10"]',  // Gmail internal action code for delete
  ];
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn) { btn.click(); return true; }
  }
  // Fallback: Gmail keyboard shortcut '#' = move to trash
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '#', bubbles: true, cancelable: true }));
  return false;
}

function checkAndHandleDeletion(emailData) {
  chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
    const match = deletedEmails.find(d => emailMatchesDeletion(emailData, d));
    if (!match || ackedDeletions.includes(match.id)) return;

    // Find the email container in the DOM
    const container = document.querySelector(
      '.adn.ads[data-phishguard-analyzed], .gs[data-phishguard-analyzed]'
    );
    if (!container) return;

    createDeletionBanner(container);
    attemptGmailDelete();

    // Mark as handled so we don't repeat
    chrome.storage.local.set({ ackedDeletions: [...ackedDeletions, match.id] });
  });
}

// ── Email parsing ─────────────────────────────────────────────────────────────
function getUserEmail() {
  const el = document.querySelector('[data-email]');
  if (el) return el.getAttribute('data-email') || '';
  const title = document.querySelector('.gb_A.gb_La.gb_f');
  return title?.textContent?.trim() || '';
}

function parseGmailEmail(container) {
  const subjectEl = document.querySelector('h2[data-legacy-thread-id], [data-thread-id] h2, .hP');
  const subject = subjectEl?.textContent?.trim() || document.title.replace(' - Gmail', '').trim();

  const senderEl = container.querySelector('[email]') || container.querySelector('.gD');
  const sender = senderEl?.getAttribute('email') || senderEl?.textContent?.trim() || '';

  const replyToEl = container.querySelector('[data-hovercard-id]');
  const replyTo = replyToEl?.getAttribute('data-hovercard-id') || '';

  const bodyEl = container.querySelector('.a3s.aiL') || container.querySelector('[data-message-id] .ii.gt div');
  const bodyText = bodyEl?.innerText?.trim() || '';
  const bodyHtml = bodyEl?.innerHTML || '';

  return { subject, sender, reply_to: replyTo, body_text: bodyText, body_html: bodyHtml };
}

// ── Banner creation ───────────────────────────────────────────────────────────
function createBanner(result, emailData, container) {
  const existing = container.querySelector('.phishguard-banner, .phishguard-loading');
  if (existing) existing.remove();

  const level  = result.risk_level;
  const icons  = { low: '✅', medium: '⚠️', high: '🔶', critical: '🚨' };
  const labels = { low: 'Low Risk', medium: 'Possible Phishing', high: 'Likely Phishing', critical: 'Phishing Detected' };
  const subs   = { low: 'No significant threats detected.', medium: 'Some suspicious signals found — review carefully.', high: 'Multiple phishing indicators detected.', critical: 'This email shows strong signs of phishing.' };

  const banner = document.createElement('div');
  banner.className = `phishguard-banner pg-${level}`;

  const topSignals = (result.signals || []).slice(0, 4).map(s => s.label);
  const signalHtml = topSignals.length
    ? `<div class="phishguard-signals">${topSignals.map(s => `<span class="phishguard-signal-tag">⚑ ${s}</span>`).join('')}</div>`
    : '';
  const reportHtml = level !== 'low'
    ? `<button class="phishguard-btn phishguard-btn-report" id="pg-report-btn">🚩 Report as Phishing</button>`
    : '';

  banner.innerHTML = `
    <div class="phishguard-icon">${icons[level] || '🔍'}</div>
    <div class="phishguard-content">
      <div class="phishguard-header">
        <span class="phishguard-title">PhishGuard — ${labels[level] || level}</span>
        <span class="phishguard-score-pill">Score ${result.risk_score}/100</span>
      </div>
      <div class="phishguard-sub">${subs[level] || ''}</div>
      ${signalHtml}
      <div class="phishguard-actions">
        ${reportHtml}
        <button class="phishguard-btn phishguard-btn-dismiss" id="pg-dismiss-btn">Dismiss</button>
      </div>
    </div>
    <button class="phishguard-close" id="pg-close-btn" title="Close">×</button>
  `;

  banner.querySelector('#pg-dismiss-btn')?.addEventListener('click', () => banner.remove());
  banner.querySelector('#pg-close-btn')?.addEventListener('click',   () => banner.remove());

  banner.querySelector('#pg-report-btn')?.addEventListener('click', function () {
    this.textContent = 'Reporting...';
    this.disabled = true;
    chrome.runtime.sendMessage(
      {
        type: 'REPORT_EMAIL',
        data: {
          reporter_email:  currentUserEmail || 'unknown@unknown.com',
          subject:         emailData.subject,
          sender:          emailData.sender,
          reply_to:        emailData.reply_to,
          email_body_text: emailData.body_text,
          email_body_html: emailData.body_html,
          source: 'user_report',
        },
      },
      (response) => {
        if (response?.result) {
          this.textContent = '✅ Reported';
          this.style.background = '#16a34a';
        } else {
          this.textContent = `Error: ${response?.error || 'failed'}`;
          this.disabled = false;
        }
      }
    );
  });

  return banner;
}

// ── Analysis ──────────────────────────────────────────────────────────────────
function analyzeEmailContainer(container) {
  if (container.hasAttribute(ANALYZED_ATTR)) return;
  container.setAttribute(ANALYZED_ATTR, '1');

  const loading = document.createElement('div');
  loading.className = 'phishguard-loading';
  loading.innerHTML = '<div class="phishguard-loading-dot"></div> PhishGuard is analyzing this email...';
  container.insertBefore(loading, container.firstChild);

  const emailData = parseGmailEmail(container);
  if (!emailData.sender && !emailData.body_text) {
    loading.remove();
    return;
  }

  chrome.runtime.sendMessage(
    {
      type: 'ANALYZE_EMAIL',
      data: {
        sender:    emailData.sender,
        reply_to:  emailData.reply_to,
        subject:   emailData.subject,
        body_text: emailData.body_text,
        body_html: emailData.body_html,
      },
    },
    (response) => {
      loading.remove();
      if (response?.result) {
        currentScan      = response.result;
        currentEmailData = emailData;

        // Check if admin already deleted this email before showing the normal banner
        chrome.storage.local.get(['deletedEmails', 'ackedDeletions'], ({ deletedEmails = [], ackedDeletions = [] }) => {
          const match = deletedEmails.find(d => emailMatchesDeletion(emailData, d));
          if (match && !ackedDeletions.includes(match.id)) {
            createDeletionBanner(container);
            attemptGmailDelete();
            chrome.storage.local.set({ ackedDeletions: [...ackedDeletions, match.id] });
          } else {
            const banner = createBanner(response.result, emailData, container);
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
  const containers = document.querySelectorAll('.adn.ads:not([data-phishguard-analyzed]), .gs:not([data-phishguard-analyzed])');
  containers.forEach((el) => {
    if (el.querySelector('.a3s')) analyzeEmailContainer(el);
  });
}

const observer = new MutationObserver(() => scanForEmails());
observer.observe(document.body, { childList: true, subtree: true });
scanForEmails();
