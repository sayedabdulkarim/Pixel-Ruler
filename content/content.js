(() => {
  // Prevent multiple injections
  if (window.pageRulerInitialized) return;
  window.pageRulerInitialized = true;

  // State
  let state = {
    active: false,
    mode: 'measure', // measure, element, guides
    unit: 'px',
    color: '#3498db',
    showGrid: false,
    gridSize: 10,
    isDragging: false,
    startX: 0,
    startY: 0,
    measurements: [],
    guides: { horizontal: [], vertical: [] },
    hoveredElement: null
  };

  // DOM Elements
  let overlay, tooltip, rulerH, rulerV, gridOverlay;
  let currentMeasurement = null;

  // Initialize
  function init() {
    createOverlay();
    createTooltip();
    createRulers();
    createGridOverlay();
    attachListeners();
  }

  // Create main overlay
  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'page-ruler-overlay';
    overlay.innerHTML = `
      <svg id="page-ruler-svg" width="100%" height="100%">
        <defs>
          <pattern id="page-ruler-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(0,0,0,0.1)" stroke-width="0.5"/>
          </pattern>
        </defs>
      </svg>
    `;
    document.body.appendChild(overlay);
  }

  // Create tooltip
  function createTooltip() {
    tooltip = document.createElement('div');
    tooltip.id = 'page-ruler-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);
  }

  // Create ruler bars
  function createRulers() {
    rulerH = document.createElement('div');
    rulerH.id = 'page-ruler-h';
    rulerH.className = 'page-ruler-bar';

    rulerV = document.createElement('div');
    rulerV.id = 'page-ruler-v';
    rulerV.className = 'page-ruler-bar';

    // Create tick marks
    const createTicks = (ruler, isHorizontal) => {
      const size = isHorizontal ? window.innerWidth : window.innerHeight;
      for (let i = 0; i <= size; i += 10) {
        const tick = document.createElement('div');
        tick.className = 'ruler-tick' + (i % 50 === 0 ? ' major' : '');
        if (isHorizontal) {
          tick.style.left = i + 'px';
        } else {
          tick.style.top = i + 'px';
        }
        if (i % 100 === 0 && i > 0) {
          const label = document.createElement('span');
          label.className = 'ruler-label';
          label.textContent = i;
          tick.appendChild(label);
        }
        ruler.appendChild(tick);
      }
    };

    createTicks(rulerH, true);
    createTicks(rulerV, false);

    document.body.appendChild(rulerH);
    document.body.appendChild(rulerV);
  }

  // Create grid overlay
  function createGridOverlay() {
    gridOverlay = document.createElement('div');
    gridOverlay.id = 'page-ruler-grid-overlay';
    gridOverlay.style.display = 'none';
    document.body.appendChild(gridOverlay);
  }

  // Attach event listeners
  function attachListeners() {
    overlay.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);

    // Ruler drag for guides
    rulerH.addEventListener('mousedown', (e) => createGuide('horizontal', e));
    rulerV.addEventListener('mousedown', (e) => createGuide('vertical', e));
  }

  // Mouse down handler
  function handleMouseDown(e) {
    if (!state.active) return;

    if (state.mode === 'measure') {
      state.isDragging = true;
      state.startX = e.clientX + window.scrollX;
      state.startY = e.clientY + window.scrollY;

      currentMeasurement = createMeasurementRect();
    } else if (state.mode === 'element') {
      lockElementMeasurement(e);
    }
  }

  // Mouse move handler
  function handleMouseMove(e) {
    if (!state.active) return;

    const x = e.clientX + window.scrollX;
    const y = e.clientY + window.scrollY;

    if (state.mode === 'measure' && state.isDragging && currentMeasurement) {
      updateMeasurementRect(currentMeasurement, state.startX, state.startY, x, y);
    } else if (state.mode === 'element') {
      highlightElement(e);
    }

    // Update tooltip position
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';
  }

  // Mouse up handler
  function handleMouseUp(e) {
    if (!state.active) return;

    if (state.mode === 'measure' && state.isDragging) {
      state.isDragging = false;
      if (currentMeasurement) {
        state.measurements.push(currentMeasurement);
        currentMeasurement = null;
      }
    }
  }

  // Keyboard handler
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      if (state.isDragging) {
        cancelCurrentMeasurement();
      } else {
        deactivate();
      }
    } else if (e.key === 'c' || e.key === 'C') {
      clearAll();
    } else if (e.key === 'g' || e.key === 'G') {
      toggleGrid(!state.showGrid);
    } else if (e.key >= '1' && e.key <= '5') {
      const units = ['px', 'rem', 'percent', 'vw', 'vh'];
      setUnit(units[parseInt(e.key) - 1]);
    }
  }

  // Create measurement rectangle
  function createMeasurementRect() {
    const svg = document.getElementById('page-ruler-svg');
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('measurement-group');

    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.classList.add('measurement-rect');
    rect.setAttribute('fill', hexToRgba(state.color, 0.2));
    rect.setAttribute('stroke', state.color);
    rect.setAttribute('stroke-width', '2');

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.classList.add('measurement-text');
    text.setAttribute('fill', '#fff');

    const textBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    textBg.classList.add('measurement-text-bg');
    textBg.setAttribute('fill', 'rgba(0,0,0,0.8)');
    textBg.setAttribute('rx', '4');

    group.appendChild(rect);
    group.appendChild(textBg);
    group.appendChild(text);
    svg.appendChild(group);

    return { group, rect, text, textBg };
  }

  // Update measurement rectangle
  function updateMeasurementRect(measurement, x1, y1, x2, y2) {
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);

    measurement.rect.setAttribute('x', left);
    measurement.rect.setAttribute('y', top);
    measurement.rect.setAttribute('width', width);
    measurement.rect.setAttribute('height', height);

    // Update dimensions text
    const dims = formatDimensions(width, height);
    measurement.text.textContent = dims;

    // Position text
    const textX = left + width / 2;
    const textY = top + height / 2;
    measurement.text.setAttribute('x', textX);
    measurement.text.setAttribute('y', textY);
    measurement.text.setAttribute('text-anchor', 'middle');
    measurement.text.setAttribute('dominant-baseline', 'middle');

    // Update text background
    const bbox = measurement.text.getBBox();
    measurement.textBg.setAttribute('x', bbox.x - 6);
    measurement.textBg.setAttribute('y', bbox.y - 4);
    measurement.textBg.setAttribute('width', bbox.width + 12);
    measurement.textBg.setAttribute('height', bbox.height + 8);

    // Update tooltip
    showTooltip(`${dims}<br>Position: ${Math.round(left)}, ${Math.round(top)} px`);
  }

  // Element highlight mode
  function highlightElement(e) {
    const target = document.elementFromPoint(e.clientX, e.clientY);

    if (target && target !== overlay && target !== tooltip &&
        !target.id?.startsWith('page-ruler') &&
        !target.classList?.contains('page-ruler-bar')) {

      if (state.hoveredElement !== target) {
        removeElementHighlight();
        state.hoveredElement = target;

        const rect = target.getBoundingClientRect();
        const highlight = document.createElement('div');
        highlight.id = 'page-ruler-element-highlight';
        highlight.style.cssText = `
          position: fixed;
          left: ${rect.left}px;
          top: ${rect.top}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          border: 2px solid #2ecc71;
          background: rgba(46, 204, 113, 0.1);
          pointer-events: none;
          z-index: 2147483645;
        `;
        document.body.appendChild(highlight);

        const dims = formatDimensions(rect.width, rect.height);
        showTooltip(`
          <strong>${target.tagName.toLowerCase()}</strong>
          ${target.id ? '#' + target.id : ''}
          ${target.className && typeof target.className === 'string' ? '.' + target.className.split(' ').join('.') : ''}
          <br>${dims}
          <br>Position: ${Math.round(rect.left)}, ${Math.round(rect.top)} px
        `);
      }
    }
  }

  // Remove element highlight
  function removeElementHighlight() {
    const existing = document.getElementById('page-ruler-element-highlight');
    if (existing) existing.remove();
    state.hoveredElement = null;
  }

  // Lock element measurement
  function lockElementMeasurement(e) {
    if (state.hoveredElement) {
      const rect = state.hoveredElement.getBoundingClientRect();
      const measurement = createMeasurementRect();

      const scrollX = window.scrollX;
      const scrollY = window.scrollY;

      updateMeasurementRect(
        measurement,
        rect.left + scrollX,
        rect.top + scrollY,
        rect.right + scrollX,
        rect.bottom + scrollY
      );

      state.measurements.push(measurement);
    }
  }

  // Create guide line
  function createGuide(type, e) {
    if (!state.active || state.mode !== 'guides') return;

    const guide = document.createElement('div');
    guide.className = `page-ruler-guide ${type}`;

    if (type === 'horizontal') {
      guide.style.top = e.clientY + 'px';
      guide.dataset.position = e.clientY;
    } else {
      guide.style.left = e.clientX + 'px';
      guide.dataset.position = e.clientX;
    }

    // Make guide draggable
    guide.addEventListener('mousedown', (ev) => {
      ev.stopPropagation();
      const moveGuide = (moveE) => {
        if (type === 'horizontal') {
          guide.style.top = moveE.clientY + 'px';
        } else {
          guide.style.left = moveE.clientX + 'px';
        }
      };
      const stopMove = () => {
        document.removeEventListener('mousemove', moveGuide);
        document.removeEventListener('mouseup', stopMove);
      };
      document.addEventListener('mousemove', moveGuide);
      document.addEventListener('mouseup', stopMove);
    });

    // Double click to remove
    guide.addEventListener('dblclick', () => {
      guide.remove();
      state.guides[type] = state.guides[type].filter(g => g !== guide);
    });

    document.body.appendChild(guide);
    state.guides[type].push(guide);
  }

  // Format dimensions based on unit
  function formatDimensions(width, height) {
    const w = convertUnit(width, 'width');
    const h = convertUnit(height, 'height');
    const unit = state.unit === 'percent' ? '%' : state.unit;
    return `${w} × ${h} ${unit}`;
  }

  // Convert pixel value to selected unit
  function convertUnit(value, dimension) {
    switch (state.unit) {
      case 'px':
        return Math.round(value);
      case 'rem':
        const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
        return (value / rootFontSize).toFixed(2);
      case 'percent':
        const viewport = dimension === 'width' ? window.innerWidth : window.innerHeight;
        return ((value / viewport) * 100).toFixed(2);
      case 'vw':
        return ((value / window.innerWidth) * 100).toFixed(2);
      case 'vh':
        return ((value / window.innerHeight) * 100).toFixed(2);
      default:
        return Math.round(value);
    }
  }

  // Show tooltip
  function showTooltip(content) {
    tooltip.innerHTML = content;
    tooltip.style.display = 'block';
  }

  // Hide tooltip
  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  // Toggle grid
  function toggleGrid(show, size = state.gridSize) {
    state.showGrid = show;
    state.gridSize = size;

    if (show) {
      gridOverlay.style.display = 'block';
      gridOverlay.style.backgroundSize = `${size}px ${size}px`;
      gridOverlay.style.backgroundImage = `
        linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
      `;
    } else {
      gridOverlay.style.display = 'none';
    }
  }

  // Cancel current measurement
  function cancelCurrentMeasurement() {
    if (currentMeasurement) {
      currentMeasurement.group.remove();
      currentMeasurement = null;
    }
    state.isDragging = false;
    hideTooltip();
  }

  // Clear all measurements and guides
  function clearAll() {
    state.measurements.forEach(m => m.group.remove());
    state.measurements = [];

    state.guides.horizontal.forEach(g => g.remove());
    state.guides.vertical.forEach(g => g.remove());
    state.guides = { horizontal: [], vertical: [] };

    removeElementHighlight();
    hideTooltip();
  }

  // Activate ruler
  function activate(settings = {}) {
    state.active = true;
    state.mode = settings.mode || 'measure';
    state.unit = settings.unit || 'px';
    state.color = settings.color || '#3498db';

    overlay.classList.add('active');
    rulerH.classList.add('active');
    rulerV.classList.add('active');

    if (settings.showGrid) {
      toggleGrid(true, settings.gridSize);
    }
  }

  // Deactivate ruler
  function deactivate() {
    state.active = false;
    overlay.classList.remove('active');
    rulerH.classList.remove('active');
    rulerV.classList.remove('active');

    removeElementHighlight();
    hideTooltip();
    toggleGrid(false);
  }

  // Set mode
  function setMode(mode) {
    state.mode = mode;
    removeElementHighlight();
    hideTooltip();
  }

  // Set unit
  function setUnit(unit) {
    state.unit = unit;
    // Re-render existing measurements
    state.measurements.forEach(m => {
      const rect = m.rect;
      const width = parseFloat(rect.getAttribute('width'));
      const height = parseFloat(rect.getAttribute('height'));
      const dims = formatDimensions(width, height);
      m.text.textContent = dims;
    });
  }

  // Set color
  function setColor(color) {
    state.color = color;
  }

  // Helper: hex to rgba
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Message listener
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'activate':
        activate(message.settings);
        break;
      case 'deactivate':
        deactivate();
        break;
      case 'setMode':
        setMode(message.mode);
        break;
      case 'setUnit':
        setUnit(message.unit);
        break;
      case 'setColor':
        setColor(message.color);
        break;
      case 'toggleGrid':
        toggleGrid(message.show, message.size);
        break;
      case 'clear':
        clearAll();
        break;
    }
    sendResponse({ success: true });
  });

  // Initialize
  init();
})();
