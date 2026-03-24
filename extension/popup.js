document.addEventListener('DOMContentLoaded', () => {
  const apiUrlInput = document.getElementById('apiUrl');
  const apiKeyInput = document.getElementById('apiKey');
  const saveBtn = document.getElementById('saveBtn');
  const savedStatus = document.getElementById('savedStatus');
  const adminLink = document.getElementById('adminLink');

  // Load saved settings
  chrome.storage.sync.get(['apiUrl', 'apiKey'], (result) => {
    if (result.apiUrl) apiUrlInput.value = result.apiUrl;
    if (result.apiKey) apiKeyInput.value = result.apiKey;
    updateAdminLink(result.apiUrl || 'http://localhost:3000');
  });

  function updateAdminLink(url) {
    const adminUrl = url.replace(':8000', ':5173').replace(':8000', ':80');
    adminLink.onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: adminUrl.replace(':8000', '') + '' });
    };
  }

  saveBtn.addEventListener('click', () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/$/, '');
    const apiKey = apiKeyInput.value.trim();
    chrome.storage.sync.set({ apiUrl, apiKey }, () => {
      savedStatus.style.display = 'block';
      updateAdminLink(apiUrl);
      setTimeout(() => { savedStatus.style.display = 'none'; }, 2000);
    });
  });
});
