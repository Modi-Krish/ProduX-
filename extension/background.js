// background.js — ProduX Focus Guard background service worker

// Listen for the periodic alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'focusCheck') return;

  chrome.storage.local.get(
    ['focusActive', 'focusUrl', 'focusEndTime', 'distractionCount', 'totalChecks', 'focusChecks'],
    (data) => {
      if (!data.focusActive) {
        chrome.alarms.clear('focusCheck');
        return;
      }

      // Check if time expired
      if (Date.now() >= data.focusEndTime) {
        chrome.storage.local.set({ focusActive: false });
        chrome.alarms.clear('focusCheck');
        chrome.notifications.create('focus-done', {
          type: 'basic',
          iconUrl: 'icon.png',
          title: '✅ Focus Session Complete!',
          message: `Great work! Your focus session on ${data.focusUrl} is done. Distractions: ${data.distractionCount || 0}`,
          priority: 2,
        });
        return;
      }

      // Check current active tab
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (!tabs || tabs.length === 0) return;

        const currentUrl = tabs[0].url || '';
        const isFocused = currentUrl.includes(data.focusUrl);

        const newTotal = (data.totalChecks || 0) + 1;
        const newFocused = (data.focusChecks || 0) + (isFocused ? 1 : 0);
        const newDistractions = (data.distractionCount || 0) + (isFocused ? 0 : 1);

        chrome.storage.local.set({
          totalChecks: newTotal,
          focusChecks: newFocused,
          distractionCount: newDistractions,
        });

        if (!isFocused) {
          // User is off-focus! Send a notification
          chrome.notifications.create('focus-warning-' + Date.now(), {
            type: 'basic',
            iconUrl: 'icon.png',
            title: '⚠️ You\'re Off Focus!',
            message: `Get back to ${data.focusUrl}! You were supposed to be working there.`,
            priority: 2,
          });
        }
      });
    }
  );
});

// When extension is installed, clear any stale state
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    focusActive: false,
    focusUrl: '',
    focusEndTime: 0,
    distractionCount: 0,
    totalChecks: 0,
    focusChecks: 0,
  });
});
