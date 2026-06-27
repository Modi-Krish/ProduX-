// popup.js — ProduX Focus Guard popup controller

const statusEl = document.getElementById('status');
const setupSection = document.getElementById('setup-section');
const activeSection = document.getElementById('active-section');
const settingsSection = document.getElementById('settings-section');

const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');

const focusUrlInput = document.getElementById('focusUrl');
const durationSelect = document.getElementById('duration');
const apiUrlInput = document.getElementById('apiUrl');
const apiTokenInput = document.getElementById('apiToken');

const timeLeftEl = document.getElementById('timeLeft');
const focusScoreEl = document.getElementById('focusScore');
const distractionsEl = document.getElementById('distractions');

let updateInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Load settings
  chrome.storage.local.get(['apiUrl', 'apiToken'], (data) => {
    if (data.apiUrl) apiUrlInput.value = data.apiUrl;
    if (data.apiToken) apiTokenInput.value = data.apiToken;
  });
  loadState();
});

// Load current state
function loadState() {
  chrome.storage.local.get(
    ['focusActive', 'focusUrl', 'focusEndTime', 'distractionCount', 'totalChecks', 'focusChecks'],
    (data) => {
      if (data.focusActive && data.focusEndTime > Date.now()) {
        showActiveState(data);
      } else if (data.focusActive) {
        // Time expired
        chrome.storage.local.set({ focusActive: false });
        showIdleState();
      } else {
        showIdleState();
      }
    }
  );
}

function showIdleState() {
  statusEl.className = 'status-bar idle';
  statusEl.textContent = 'Not monitoring';
  setupSection.style.display = 'block';
  activeSection.style.display = 'none';
  settingsSection.style.display = 'none';
  clearInterval(updateInterval);
}

function showActiveState(data) {
  statusEl.className = 'status-bar active';
  statusEl.textContent = `🟢 Monitoring: ${data.focusUrl}`;
  setupSection.style.display = 'none';
  activeSection.style.display = 'block';
  settingsSection.style.display = 'none';

  updateStats(data);

  clearInterval(updateInterval);
  updateInterval = setInterval(() => {
    chrome.storage.local.get(
      ['focusEndTime', 'distractionCount', 'totalChecks', 'focusChecks', 'focusActive', 'focusUrl'],
      (d) => {
        if (!d.focusActive || d.focusEndTime <= Date.now()) {
          showIdleState();
          return;
        }
        updateStats(d);

        // Check if current tab matches the warning state
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            const currentUrl = tabs[0].url || '';
            const isFocused = currentUrl.includes(d.focusUrl);
            if (!isFocused) {
              statusEl.className = 'status-bar warning';
              statusEl.textContent = `⚠️ OFF FOCUS! Go back to ${d.focusUrl}`;
            } else {
              statusEl.className = 'status-bar active';
              statusEl.textContent = `🟢 Monitoring: ${d.focusUrl}`;
            }
          }
        });
      }
    );
  }, 2000);
}

function updateStats(data) {
  const minutesLeft = Math.max(0, Math.ceil((data.focusEndTime - Date.now()) / 60000));
  timeLeftEl.textContent = minutesLeft;
  distractionsEl.textContent = data.distractionCount || 0;

  const total = data.totalChecks || 1;
  const focused = data.focusChecks || 0;
  const score = Math.round((focused / total) * 100);
  focusScoreEl.textContent = `${score}%`;
}

// Start monitoring
startBtn.addEventListener('click', () => {
  const focusUrl = focusUrlInput.value.trim();
  const minutes = parseInt(durationSelect.value, 10);

  if (!focusUrl) {
    statusEl.className = 'status-bar warning';
    statusEl.textContent = 'Enter a website URL!';
    return;
  }

  // Ensure they have API config if they want AI coach
  chrome.storage.local.get(['apiToken'], (data) => {
    if (!data.apiToken) {
      statusEl.className = 'status-bar warning';
      statusEl.textContent = 'Configure API token in Settings first!';
      return;
    }

    const state = {
      focusActive: true,
      focusUrl,
      focusEndTime: Date.now() + minutes * 60000,
      distractionCount: 0,
      totalChecks: 0,
      focusChecks: 0,
    };
  
    chrome.storage.local.set(state, () => {
      chrome.alarms.create('focusCheck', { periodInMinutes: 0.5 }); // Check every 30s
      showActiveState(state);
    });
  });
});

// Stop monitoring
stopBtn.addEventListener('click', () => {
  chrome.storage.local.set({ focusActive: false });
  chrome.alarms.clear('focusCheck');
  showIdleState();
});

// Toggle Settings
toggleSettingsBtn.addEventListener('click', () => {
  if (settingsSection.style.display === 'none') {
    settingsSection.style.display = 'block';
    setupSection.style.display = 'none';
  } else {
    settingsSection.style.display = 'none';
    setupSection.style.display = 'block';
  }
});

// Save Settings
saveSettingsBtn.addEventListener('click', () => {
  const apiUrl = apiUrlInput.value.trim();
  const apiToken = apiTokenInput.value.trim();
  
  chrome.storage.local.set({ apiUrl, apiToken }, () => {
    statusEl.className = 'status-bar active';
    statusEl.textContent = 'Settings saved!';
    setTimeout(() => {
      settingsSection.style.display = 'none';
      setupSection.style.display = 'block';
      statusEl.className = 'status-bar idle';
      statusEl.textContent = 'Not monitoring';
    }, 1500);
  });
});
