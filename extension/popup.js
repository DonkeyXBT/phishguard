const DEFAULT_API_URL = 'https://phishing-detector-orpin-ten.vercel.app';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const notEmailMsg   = document.getElementById('not-email-msg');
const scanResult    = document.getElementById('scan-result');
const scanningMsg   = document.getElementById('scanning-msg');
const riskCard      = document.getElementById('risk-card');
const riskIcon      = document.getElementById('risk-icon');
const riskLabel     = document.getElementById('risk-label');
const riskBadge     = document.getElementById('risk-badge');
const riskScore     = document.getElementById('risk-score');
const riskBar       = document.getElementById('risk-bar');
const signalsDiv    = document.getElementById('signals-preview');
const summaryText   = document.getElementById('summary-text');
const reportBtn     = document.getElementById('reportBtn');
const connDot       = document.getElementById('connDot');
const connText      = document.getElementById('connText');
const gearBtn       = document.getElementById('gearBtn');
const settingsPanel = document.getElementById('settings-section');
const apiUrlInput   = document.getElementById('apiUrl');
const apiKeyInput   = document.getElementById('apiKey');
const saveBtn       = document.getElementById('saveBtn');
const savedMsg      = document.getElementById('savedMsg');

// ── SVG icons (inline Lucide) ─────────────────────────────────────────────────
const SVG_ICONS = {
  low: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#16a34a" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  medium: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#d97706" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  high: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ea580c" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
  critical: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#dc2626" stroke-width="2"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

// ── Settings panel ────────────────────────────────────────────────────────────
function loadSettings(cb) {
  chrome.storage.sync.get(['apiUrl', 'apiKey'], result => {
    cb(result.apiUrl || DEFAULT_API_URL, result.apiKey || '');
  });
}

gearBtn.addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
  if (settingsPanel.classList.contains('open')) {
    loadSettings((url, key) => {
      apiUrlInput.value = url;
      apiKeyInput.value = key;
    });
  }
});

saveBtn.addEventListener('click', () => {
  const url = apiUrlInput.value.trim().replace(/\/$/, '');
  const key = apiKeyInput.value.trim();
  chrome.storage.sync.set({ apiUrl: url || DEFAULT_API_URL, apiKey: key }, () => {
    savedMsg.style.display = 'block';
    setTimeout(() => { savedMsg.style.display = 'none'; }, 2000);
    checkConnection(url || DEFAULT_API_URL);
  });
});

// ── Connection indicator ──────────────────────────────────────────────────────
function setConn(state, text) {
  connDot.className = 'conn-dot ' + state;
  connText.textContent = text;
}

function checkConnection(apiUrl) {
  setConn('loading', 'Checking connection...');
  fetch(`${apiUrl}/api/health`)
    .then(r => {
      if (r.ok) setConn('ok', 'Connected to PhishGuard');
      else setConn('err', 'Server error (' + r.status + ')');
    })
    .catch(() => setConn('err', 'Cannot reach server'));
}

// ── Risk card display ─────────────────────────────────────────────────────────
const LEVELS = ['low', 'medium', 'high', 'critical', 'scanning'];

function clearLevelClasses(...els) {
  els.forEach(el => LEVELS.forEach(l => el.classList.remove(l)));
}

function showScanning() {
  notEmailMsg.style.display = 'none';
  scanResult.style.display  = 'none';
  scanningMsg.style.display = 'block';
}

function showNotEmail() {
  scanResult.style.display   = 'none';
  scanningMsg.style.display  = 'none';
  notEmailMsg.style.display  = 'block';
}

function showResult(scan) {
  notEmailMsg.style.display = 'none';
  scanningMsg.style.display = 'none';
  scanResult.style.display  = 'block';

  const level = scan.risk_level || 'low';
  const score = scan.risk_score ?? 0;

  clearLevelClasses(riskCard, riskLabel, riskBadge, riskBar);
  riskCard.classList.add(level);
  riskLabel.classList.add(level);
  riskBadge.classList.add(level);
  riskBar.classList.add(level);

  const labels = { low: 'Low Risk', medium: 'Possible Phishing', high: 'Likely Phishing', critical: 'Phishing Detected' };
  riskIcon.innerHTML = SVG_ICONS[level] || '';
  riskLabel.textContent = labels[level] || level;
  riskScore.textContent = score;
  // Delay bar fill for animation effect
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { riskBar.style.width = score + '%'; });
  });

  signalsDiv.innerHTML = '';

  // Show email auth badges if available
  const auth = scan.email_auth;
  if (auth) {
    const checks = [
      { label: 'SPF', status: auth.spf?.status },
      { label: 'DKIM', status: auth.dkim?.status },
      { label: 'DMARC', status: auth.dmarc?.status },
    ].filter(c => c.status && c.status !== 'unknown');

    checks.forEach(c => {
      const badge = document.createElement('span');
      const pass = c.status === 'pass';
      badge.className = 'signal-chip';
      badge.style.cssText = pass
        ? 'background: #f0fdf4; border-color: #bbf7d0; color: #15803d;'
        : 'background: #fef2f2; border-color: #fecaca; color: #991b1b;';
      badge.textContent = `${c.label}: ${c.status}`;
      signalsDiv.appendChild(badge);
    });
  }

  (scan.signals || []).slice(0, 6).forEach(s => {
    const chip = document.createElement('span');
    chip.className   = 'signal-chip';
    chip.textContent = s.label;
    signalsDiv.appendChild(chip);
  });

  summaryText.textContent = scan.summary || '';

  reportBtn.disabled   = false;
  reportBtn.className  = 'btn-report';
  reportBtn.innerHTML  = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg> Report as Phishing';
}

// ── Report button ─────────────────────────────────────────────────────────────
let currentTabId = null;

reportBtn.addEventListener('click', () => {
  if (reportBtn.classList.contains('reported')) return;
  reportBtn.disabled  = true;
  reportBtn.innerHTML = 'Reporting...';

  chrome.tabs.sendMessage(currentTabId, { type: 'REPORT_CURRENT_EMAIL' }, response => {
    if (chrome.runtime.lastError || !response) {
      reportBtn.disabled  = false;
      reportBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg> Report as Phishing';
      return;
    }
    if (response.ok) {
      reportBtn.classList.add('reported');
      reportBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Reported to Security Team';
    } else {
      reportBtn.disabled  = false;
      reportBtn.innerHTML = (response.error || 'Failed — try again');
      setTimeout(() => {
        reportBtn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg> Report as Phishing';
      }, 3000);
    }
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
function isEmailPage(url) {
  return url && (
    url.includes('mail.google.com') ||
    url.includes('outlook.live.com') ||
    url.includes('outlook.office.com') ||
    url.includes('outlook.office365.com')
  );
}

chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  const tab = tabs[0];
  if (!tab) { showNotEmail(); return; }
  currentTabId = tab.id;

  loadSettings((apiUrl) => checkConnection(apiUrl));

  if (!isEmailPage(tab.url)) {
    showNotEmail();
    return;
  }

  showScanning();

  let pollCount = 0;
  const maxPolls = 10;

  function pollForResult() {
    chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_SCAN' }, response => {
      if (chrome.runtime.lastError) {
        showNotEmail();
        return;
      }
      if (response && response.scan) {
        showResult(response.scan);
      } else if (response && response.analyzing && pollCount < maxPolls) {
        // Still analyzing — keep polling
        pollCount++;
        setTimeout(pollForResult, 1500);
      } else if (pollCount < 3) {
        // No scan yet and not analyzing — give it a few more tries in case content script is still loading
        pollCount++;
        setTimeout(pollForResult, 1500);
      } else {
        showNotEmail();
      }
    });
  }

  pollForResult();
});
