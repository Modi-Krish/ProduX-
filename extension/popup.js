// popup.js — ProduX Focus Guard popup controller

const statusEl = document.getElementById('status');
const setupSection = document.getElementById('setup-section');
const activeSection = document.getElementById('active-section');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const focusUrlInput = document.getElementById('focusUrl');
const durationSelect = document.getElementById('duration');
const timeLeftEl = document.getElementById('timeLeft');
const focusScoreEl = document.getElementById('focusScore');
const distractionsEl = document.getElementById('distractions');

let updateInterval = null;

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
  clearInterval(updateInterval);
}

function showActiveState(data) {
  statusEl.className = 'status-bar active';
  statusEl.textContent = `🟢 Monitoring: ${data.focusUrl}`;
  setupSection.style.display = 'none';
  activeSection.style.display = 'block';

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

  const endTime = Date.now() + minutes * 60 * 1000;

  chrome.storage.local.set({
    focusActive: true,
    focusUrl: focusUrl,
    focusEndTime: endTime,
    focusDuration: minutes,
    distractionCount: 0,
    totalChecks: 0,
    focusChecks: 0,
  });

  // Start the background alarm to check every 15 seconds
  chrome.alarms.create('focusCheck', { periodInMinutes: 0.25 });

  loadState();
});

// Stop monitoring
stopBtn.addEventListener('click', () => {
  chrome.storage.local.set({ focusActive: false });
  chrome.alarms.clear('focusCheck');
  showIdleState();
});

// Initialize
loadState();
