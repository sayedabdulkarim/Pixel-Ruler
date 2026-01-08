// Background service worker for Page Ruler extension

// Track active tabs
const activeTabs = new Set();

// Listen for tab updates to clean up state
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

// Listen for tab updates (navigation)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' && activeTabs.has(tabId)) {
    activeTabs.delete(tabId);
    chrome.storage.local.set({ isActive: false });
  }
});

// Handle keyboard shortcut (optional - can be configured in manifest)
chrome.commands?.onCommand?.addListener(async (command) => {
  if (command === 'toggle-ruler') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      toggleRuler(tab.id);
    }
  }
});

async function toggleRuler(tabId) {
  const isActive = activeTabs.has(tabId);

  if (isActive) {
    activeTabs.delete(tabId);
    chrome.tabs.sendMessage(tabId, { type: 'deactivate' });
  } else {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ['content/content.css']
      });

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/content.js']
      });

      activeTabs.add(tabId);

      const settings = await chrome.storage.local.get(['mode', 'unit', 'showGrid', 'gridSize', 'rulerColor']);

      setTimeout(() => {
        chrome.tabs.sendMessage(tabId, {
          type: 'activate',
          settings: {
            mode: settings.mode || 'measure',
            unit: settings.unit || 'px',
            showGrid: settings.showGrid || false,
            gridSize: settings.gridSize || 10,
            color: settings.rulerColor || '#3498db'
          }
        });
      }, 100);
    } catch (error) {
      console.error('Failed to toggle ruler:', error);
    }
  }
}
