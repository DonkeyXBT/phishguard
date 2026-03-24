const ANALYZED_ATTR  = 'data-phishguard-analyzed';
let currentScan      = null;
let currentEmailData = null;

// ── Popup message handler ─────────────────────────────────────────────────────
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
          reporter_email:  'user@company.com',
          subject:         currentEmailData.subject,
          sender:          currentEmailData.sender,
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
});

function parseOutlookEmail(container) {
  const subjectEl = document.querySelector('[role="heading"][class*="subject"], .allowTextSelection span[dir]');
  const subject = subjectEl?.textContent?.trim() || '';

  const senderEl = document.querySelector('[class*="personaName"], [class*="sender"] [class*="email"]');
  const sender = senderEl?.textContent?.trim() || '';

  const bodyEl = container.querySelector('[class*="ReadingPaneContent"], [id*="UniqueMessageBody"]');
  const bodyText = bodyEl?.innerText?.trim() || '';
  const bodyHtml = bodyEl?.innerHTML || '';

  return { subject, sender, reply_to: '', body_text: bodyText, body_html: bodyHtml };
}

function createBanner(result, emailData, container) {
  const existing = container.querySelector('.phishguard-banner, .phishguard-loading');
  if (existing) existing.remove();

  const level  = result.risk_level;
  const icons  = { low: '✅', medium: '⚠️', high: '🔶', critical: '🚨' };
  const labels = { low: 'Low Risk', medium: 'Possible Phishing', high: 'Likely Phishing', critical: 'Phishing Detected' };
  const subs   = { low: 'No significant threats detected.', medium: 'Some suspicious signals found — review carefully.', high: 'Multiple phishing indicators detected.', critical: 'This email shows strong signs of phishing.' };

  const banner = document.createElement('div');
  banner.className = `phishguard-banner pg-${level}`;
  banner.style.margin = '10px 16px 4px';

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
  banner.querySelector('#pg-close-btn')?.addEventListener('click', () => banner.remove());

  const reportBtn = banner.querySelector('#pg-report-btn');
  reportBtn?.addEventListener('click', () => {
    reportBtn.textContent = 'Reporting...';
    reportBtn.disabled = true;
    chrome.runtime.sendMessage(
      {
        type: 'REPORT_EMAIL',
        data: {
          reporter_email: 'user@company.com',
          subject: emailData.subject,
          sender: emailData.sender,
          email_body_text: emailData.body_text,
          email_body_html: emailData.body_html,
          source: 'user_report',
        },
      },
      (response) => {
        if (response?.result) {
          reportBtn.textContent = '✅ Reported to Admin';
          reportBtn.style.background = '#16a34a';
        } else {
          reportBtn.textContent = `Error`;
          reportBtn.disabled = false;
        }
      }
    );
  });

  return banner;
}

function analyzeEmailContainer(container) {
  if (container.hasAttribute(ANALYZED_ATTR)) return;
  container.setAttribute(ANALYZED_ATTR, '1');

  const emailData = parseOutlookEmail(container);
  if (!emailData.body_text && !emailData.sender) return;

  const loading = document.createElement('div');
  loading.className = 'phishguard-loading';
  loading.style.margin = '10px 16px 4px';
  loading.innerHTML = '<div class="phishguard-loading-dot"></div> PhishGuard is analyzing this email...';
  container.insertBefore(loading, container.firstChild);

  chrome.runtime.sendMessage(
    {
      type: 'ANALYZE_EMAIL',
      data: {
        sender:    emailData.sender,
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
        const banner = createBanner(response.result, emailData, container);
        container.insertBefore(banner, container.firstChild);
      }
    }
  );
}

function scanForEmails() {
  const containers = document.querySelectorAll('[class*="ReadingPaneContent"]:not([data-phishguard-analyzed])');
  containers.forEach((el) => analyzeEmailContainer(el));
}

const observer = new MutationObserver(() => scanForEmails());
observer.observe(document.body, { childList: true, subtree: true });
scanForEmails();
