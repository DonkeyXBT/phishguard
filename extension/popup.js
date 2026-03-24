const DEFAULT_API_URL = 'https://phishing-detector-orpin-ten.vercel.app';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const notEmailMsg   = document.getElementById('not-email-msg');
const scanResult    = document.getElementById('scan-result');
const scanningMsg   = document.getElementById('scanning-msg');
const riskCard      = document.getElementById('risk-card');
const riskLabel     = document.getElementById('risk-label');
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
  scanResult.style.display  = 'none';
  scanningMsg.style.display = 'none';
  notEmailMsg.style.display = 'block';
}

function showResult(scan) {
  notEmailMsg.style.display = 'none';
  scanningMsg.style.display = 'none';
  scanResult.style.display  = 'block';

  const level = scan.risk_level || 'low';
  const score = scan.risk_score ?? 0;

  clearLevelClasses(riskCard, riskLabel, riskScore, riskBar);
  riskCard.classList.add(level);
  riskLabel.classList.add(level);
  riskScore.classList.add(level);
  riskBar.classList.add(level);

  const labels = { low: 'Low Risk', medium: 'Possible Phishing', high: 'Likely Phishing', critical: 'Phishing Detected' };
  riskLabel.textContent = labels[level] || level;
  riskScore.textContent = score;
  riskBar.style.width   = score + '%';

  signalsDiv.innerHTML = '';
  (scan.signals || []).slice(0, 6).forEach(s => {
    const chip = document.createElement('span');
    chip.className   = 'signal-chip';
    chip.textContent = s.label;
    signalsDiv.appendChild(chip);
  });

  summaryText.textContent = scan.summary || '';

  // Reset report button
  reportBtn.disabled   = false;
  reportBtn.className  = 'btn-report';
  reportBtn.innerHTML  = '🚩 Report as Phishing';
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
      reportBtn.innerHTML = '🚩 Report as Phishing';
      return;
    }
    if (response.ok) {
      reportBtn.classList.add('reported');
      reportBtn.innerHTML = '✅ Reported to Security Team';
    } else {
      reportBtn.disabled  = false;
      reportBtn.innerHTML = '⚠️ ' + (response.error || 'Failed — try again');
      setTimeout(() => { reportBtn.innerHTML = '🚩 Report as Phishing'; }, 3000);
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

  chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_SCAN' }, response => {
    if (chrome.runtime.lastError) {
      showNotEmail();
      return;
    }
    if (response && response.scan) {
      showResult(response.scan);
    } else {
      // Still analyzing — poll once after short delay
      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, { type: 'GET_CURRENT_SCAN' }, r => {
          if (r && r.scan) showResult(r.scan);
          else showNotEmail();
        });
      }, 1500);
    }
  });
});
