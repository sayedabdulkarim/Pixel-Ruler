document.addEventListener('DOMContentLoaded', async () => {
  const modeButtons = document.querySelectorAll('.mode-btn');
  const unitSelect = document.getElementById('unitSelect');
  const showGrid = document.getElementById('showGrid');
  const gridSize = document.getElementById('gridSize');
  const gridSizeContainer = document.getElementById('gridSizeContainer');
  const rulerColor = document.getElementById('rulerColor');
  const activateBtn = document.getElementById('activateBtn');
  const clearBtn = document.getElementById('clearBtn');

  let isActive = false;
  let currentMode = 'measure';

  // Load saved settings
  const settings = await chrome.storage.local.get([
    'mode', 'unit', 'showGrid', 'gridSize', 'rulerColor', 'isActive'
  ]);

  if (settings.mode) {
    currentMode = settings.mode;
    modeButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === currentMode);
    });
  }

  if (settings.unit) {
    unitSelect.value = settings.unit;
  }

  if (settings.showGrid) {
    showGrid.checked = settings.showGrid;
    gridSizeContainer.style.display = settings.showGrid ? 'flex' : 'none';
  }

  if (settings.gridSize) {
    gridSize.value = settings.gridSize;
  }

  if (settings.rulerColor) {
    rulerColor.value = settings.rulerColor;
  }

  if (settings.isActive) {
    isActive = true;
    activateBtn.textContent = 'Deactivate Ruler';
    activateBtn.classList.add('active');
  }

  // Mode selection
  modeButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      modeButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentMode = btn.dataset.mode;

      await chrome.storage.local.set({ mode: currentMode });
      sendMessageToContent({ type: 'setMode', mode: currentMode });
    });
  });

  // Unit selection
  unitSelect.addEventListener('change', async () => {
    await chrome.storage.local.set({ unit: unitSelect.value });
    sendMessageToContent({ type: 'setUnit', unit: unitSelect.value });
  });

  // Grid toggle
  showGrid.addEventListener('change', async () => {
    gridSizeContainer.style.display = showGrid.checked ? 'flex' : 'none';
    await chrome.storage.local.set({ showGrid: showGrid.checked });
    sendMessageToContent({ type: 'toggleGrid', show: showGrid.checked, size: parseInt(gridSize.value) });
  });

  // Grid size change
  gridSize.addEventListener('change', async () => {
    await chrome.storage.local.set({ gridSize: parseInt(gridSize.value) });
    if (showGrid.checked) {
      sendMessageToContent({ type: 'toggleGrid', show: true, size: parseInt(gridSize.value) });
    }
  });

  // Color change
  rulerColor.addEventListener('change', async () => {
    await chrome.storage.local.set({ rulerColor: rulerColor.value });
    sendMessageToContent({ type: 'setColor', color: rulerColor.value });
  });

  // Activate/Deactivate
  activateBtn.addEventListener('click', async () => {
    isActive = !isActive;
    await chrome.storage.local.set({ isActive });

    if (isActive) {
      activateBtn.textContent = 'Deactivate Ruler';
      activateBtn.classList.add('active');

      // Inject content script and activate
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      try {
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content/content.css']
        });

        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });

        // Send activation message with settings
        setTimeout(() => {
          sendMessageToContent({
            type: 'activate',
            settings: {
              mode: currentMode,
              unit: unitSelect.value,
              showGrid: showGrid.checked,
              gridSize: parseInt(gridSize.value),
              color: rulerColor.value
            }
          });
        }, 100);
      } catch (error) {
        console.error('Failed to inject content script:', error);
        isActive = false;
        activateBtn.textContent = 'Activate Ruler';
        activateBtn.classList.remove('active');
      }
    } else {
      activateBtn.textContent = 'Activate Ruler';
      activateBtn.classList.remove('active');
      sendMessageToContent({ type: 'deactivate' });
    }
  });

  // Clear all
  clearBtn.addEventListener('click', () => {
    sendMessageToContent({ type: 'clear' });
  });

  // Helper function to send messages to content script
  async function sendMessageToContent(message) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      try {
        await chrome.tabs.sendMessage(tab.id, message);
      } catch (error) {
        console.log('Content script not ready');
      }
    }
  }
});
