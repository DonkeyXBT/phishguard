const ANALYZED_ATTR = 'data-phishguard-analyzed';
let currentUserEmail = '';

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

function createBanner(result, emailData, container) {
  const existing = container.querySelector('.phishguard-banner, .phishguard-loading');
  if (existing) existing.remove();

  const level = result.risk_level;
  const icons = { low: '✅', medium: '⚠️', high: '🔶', critical: '🚨' };
  const labels = { low: 'Low Risk', medium: 'Possible Phishing', high: 'Likely Phishing', critical: 'Phishing Detected' };

  const banner = document.createElement('div');
  banner.className = `phishguard-banner pg-${level}`;

  const topSignals = (result.signals || []).slice(0, 3).map(s => s.label);

  banner.innerHTML = `
    <div class="phishguard-icon">${icons[level] || '🔍'}</div>
    <div class="phishguard-content">
      <div class="phishguard-title">PhishGuard: ${labels[level] || level}</div>
      <div class="phishguard-score">Risk Score: ${result.risk_score}/100 · ${result.signals?.length || 0} signal(s)</div>
      ${topSignals.length > 0 ? `<div class="phishguard-signals">${topSignals.map(s => `<span class="phishguard-signal-tag">${s}</span>`).join('')}</div>` : ''}
      <div class="phishguard-actions">
        ${level !== 'low' ? `<button class="phishguard-btn phishguard-btn-report" id="pg-report-btn">Report as Phishing</button>` : ''}
        <button class="phishguard-btn phishguard-btn-dismiss" id="pg-dismiss-btn">Dismiss</button>
      </div>
    </div>
    <button class="phishguard-close" id="pg-close-btn">×</button>
  `;

  const reportBtn = banner.querySelector('#pg-report-btn');
  const dismissBtn = banner.querySelector('#pg-dismiss-btn');
  const closeBtn = banner.querySelector('#pg-close-btn');

  dismissBtn?.addEventListener('click', () => banner.remove());
  closeBtn?.addEventListener('click', () => banner.remove());

  reportBtn?.addEventListener('click', () => {
    reportBtn.textContent = 'Reporting...';
    reportBtn.disabled = true;
    chrome.runtime.sendMessage(
      {
        type: 'REPORT_EMAIL',
        data: {
          reporter_email: currentUserEmail || 'unknown@unknown.com',
          subject: emailData.subject,
          sender: emailData.sender,
          reply_to: emailData.reply_to,
          email_body_text: emailData.body_text,
          email_body_html: emailData.body_html,
          source: 'user_report',
        },
      },
      (response) => {
        if (response?.result) {
          reportBtn.textContent = '✅ Reported';
          reportBtn.style.background = '#16a34a';
        } else {
          reportBtn.textContent = `Error: ${response?.error || 'failed'}`;
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

  const loading = document.createElement('div');
  loading.className = 'phishguard-loading';
  loading.innerHTML = '<span>🔍</span> PhishGuard is analyzing this email...';
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
        sender: emailData.sender,
        reply_to: emailData.reply_to,
        subject: emailData.subject,
        body_text: emailData.body_text,
        body_html: emailData.body_html,
      },
    },
    (response) => {
      loading.remove();
      if (response?.result) {
        const banner = createBanner(response.result, emailData, container);
        container.insertBefore(banner, container.firstChild);
      } else if (response?.error) {
        console.warn('[PhishGuard]', response.error);
      }
    }
  );
}

function scanForEmails() {
  currentUserEmail = getUserEmail();
  // Gmail message containers
  const containers = document.querySelectorAll('.adn.ads:not([data-phishguard-analyzed]), .gs:not([data-phishguard-analyzed])');
  containers.forEach((el) => {
    if (el.querySelector('.a3s')) {
      analyzeEmailContainer(el);
    }
  });
}

// Watch for Gmail loading new emails dynamically
const observer = new MutationObserver(() => {
  scanForEmails();
});

observer.observe(document.body, { childList: true, subtree: true });
scanForEmails();
