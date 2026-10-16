/**
 * ui.js – DOM manipulation and rendering helpers
 *
 * Keeps all direct DOM interactions in one place, so other modules
 * stay framework-agnostic and easier to unit-test.
 */

import { formatBytes } from './utils.js?v=2.2.0';
import { renderPageThumbnail } from './thumbnailRenderer.js?v=2.2.0';

/* ── Cached DOM references ─────────────────────────────────── */
const fileListEl          = /** @type {HTMLUListElement}  */ (document.getElementById('fileList'));
const fileListSection     = /** @type {HTMLElement}       */ (document.getElementById('fileListSection'));
const fileCountEl         = /** @type {HTMLSpanElement}   */ (document.getElementById('fileCount'));
const statsSummaryEl      = /** @type {HTMLDivElement}    */ (document.getElementById('statsSummary'));
const messageBanner       = /** @type {HTMLDivElement}    */ (document.getElementById('messageBanner'));
const progressContainer   = /** @type {HTMLDivElement}    */ (document.getElementById('progressContainer'));
const progressFill        = /** @type {HTMLDivElement}    */ (document.getElementById('progressFill'));
const progressLabel       = /** @type {HTMLSpanElement}   */ (document.getElementById('progressLabel'));
const progressPercent     = /** @type {HTMLSpanElement}   */ (document.getElementById('progressPercent'));
const mergeBtn            = /** @type {HTMLButtonElement} */ (document.getElementById('mergeBtn'));

// Preview modal
const previewModal        = /** @type {HTMLDivElement}    */ (document.getElementById('previewModal'));
const previewFrame        = /** @type {HTMLIFrameElement} */ (document.getElementById('previewFrame'));
const previewTitle        = /** @type {HTMLHeadingElement}*/ (document.getElementById('previewTitle'));

// Result modal
const resultModal         = /** @type {HTMLDivElement}    */ (document.getElementById('resultModal'));
const resultFrame         = /** @type {HTMLIFrameElement} */ (document.getElementById('resultFrame'));
const resultDetails       = /** @type {HTMLParagraphElement}*/(document.getElementById('resultDetails'));
const resultDownloadBtn   = /** @type {HTMLButtonElement} */ (document.getElementById('resultDownloadBtn'));
const resultOpenTabBtn    = /** @type {HTMLButtonElement} */ (document.getElementById('resultOpenTabBtn'));

// Visual Organizer modal
const organizerModal      = /** @type {HTMLDivElement}    */ (document.getElementById('organizerModal'));
const organizerTitle      = /** @type {HTMLHeadingElement}*/ (document.getElementById('organizerTitle'));
const organizerGrid       = /** @type {HTMLDivElement}    */ (document.getElementById('organizerGrid'));
const orgStatsSummary     = /** @type {HTMLDivElement}    */ (document.getElementById('orgStatsSummary'));
const orgSelectAllBtn     = /** @type {HTMLButtonElement} */ (document.getElementById('orgSelectAllBtn'));
const orgDeselectAllBtn   = /** @type {HTMLButtonElement} */ (document.getElementById('orgDeselectAllBtn'));
const orgRotateAllBtn     = /** @type {HTMLButtonElement} */ (document.getElementById('orgRotateAllBtn'));
const orgResetBtn         = /** @type {HTMLButtonElement} */ (document.getElementById('orgResetBtn'));
const orgCancelBtn        = /** @type {HTMLButtonElement} */ (document.getElementById('orgCancelBtn'));
const orgApplyBtn         = /** @type {HTMLButtonElement} */ (document.getElementById('orgApplyBtn'));

let activeSortableOrganizer = null;

/* ── Rendering File List ───────────────────────────────────── */

/**
 * Re-render the file list.
 *
 * @param {import('./fileManager.js').FileEntry[]} files
 * @param {Object} callbacks
 * @param {(id: string) => void} callbacks.onRemove
 * @param {(file: File) => void} callbacks.onPreview
 * @param {(id: string, range: string) => void} callbacks.onRangeChange
 * @param {(id: string) => void} callbacks.onRotate
 * @param {(id: string) => void} callbacks.onOrganize
 * @param {(id: string) => void} callbacks.onMoveUp
 * @param {(id: string) => void} callbacks.onMoveDown
 */
export function renderFileList(files, callbacks) {
  // Show or hide the whole section
  fileListSection.classList.toggle('hidden', files.length === 0);

  // Update badge
  fileCountEl.textContent = String(files.length);

  // Update stats summary
  let totalSize = 0;
  let totalDocPages = 0;
  let selectedPages = 0;
  files.forEach(f => {
    totalSize += f.file.size;
    totalDocPages += f.pageCount;
    selectedPages += f.parsedIndices.length;
  });

  statsSummaryEl.textContent = `${files.length} file${files.length === 1 ? '' : 's'} · ${selectedPages} of ${totalDocPages || '?'} pages selected · ${formatBytes(totalSize)}`;

  // Clear list and re-render
  fileListEl.innerHTML = '';

  files.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';
    li.dataset.id = entry.id;
    li.setAttribute('aria-label', `File ${index + 1}: ${entry.file.name}`);

    const isFirst = index === 0;
    const isLast = index === files.length - 1;
    const isRotated = entry.rotation > 0;
    const hasError = !!entry.rangeError;

    li.innerHTML = `
      <span class="drag-handle" aria-hidden="true" title="Drag to reorder">
        ${dragHandleIcon()}
      </span>
      
      <div class="reorder-btns" aria-label="Move item">
        <button class="btn-move btn-move-up" data-id="${entry.id}" ${isFirst ? 'disabled' : ''} title="Move up" aria-label="Move ${escapeHtml(entry.file.name)} up">▲</button>
        <button class="btn-move btn-move-down" data-id="${entry.id}" ${isLast ? 'disabled' : ''} title="Move down" aria-label="Move ${escapeHtml(entry.file.name)} down">▼</button>
      </div>

      <span class="file-icon" aria-hidden="true">${pdfIcon()}</span>

      <div class="file-info">
        <div class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</div>
        <div class="file-meta-row">
          <span class="file-meta">${formatBytes(entry.file.size)}</span>
          <span class="page-badge">${entry.pageCount > 0 ? `${entry.pageCount} pages` : 'Loading…'}</span>
        </div>
      </div>

      <div class="file-range-control">
        <input
          type="text"
          class="page-range-input ${hasError ? 'input-error' : ''}"
          data-id="${entry.id}"
          placeholder="Pages (e.g. 1-3, 5 or all)"
          value="${escapeHtml(entry.pageRange)}"
          title="Specify pages or ranges to include"
          aria-label="Pages to include from ${escapeHtml(entry.file.name)}"
        />
        <span class="range-label ${hasError ? 'text-error' : ''}">
          ${hasError ? escapeHtml(entry.rangeError) : escapeHtml(entry.rangeSummary || 'All pages')}
        </span>
      </div>

      <div class="file-item-actions">
        <button class="btn btn-rotate-file ${isRotated ? 'is-rotated' : ''}" data-id="${entry.id}" title="Rotate document 90° clockwise" aria-label="Rotate ${escapeHtml(entry.file.name)}">
          <svg viewBox="0 0 24 24" fill="none" width="13" height="13" stroke="currentColor" stroke-width="2">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-1.19"/>
          </svg>
          ${isRotated ? `${entry.rotation}°` : 'Rotate'}
        </button>

        <button class="btn btn-organizer-file" data-id="${entry.id}" title="Visually organize individual pages" aria-label="Organize pages of ${escapeHtml(entry.file.name)}">
          Pages
        </button>

        <button class="btn btn-preview" data-id="${entry.id}" aria-label="Preview ${escapeHtml(entry.file.name)}">
          Preview
        </button>

        <button class="btn btn-danger" data-id="${entry.id}" aria-label="Remove ${escapeHtml(entry.file.name)}" title="Remove file">
          ${trashIcon()}
        </button>
      </div>
    `;

    // Attach event listeners
    li.querySelector('.btn-move-up')?.addEventListener('click', () => callbacks.onMoveUp(entry.id));
    li.querySelector('.btn-move-down')?.addEventListener('click', () => callbacks.onMoveDown(entry.id));

    const rangeInput = li.querySelector('.page-range-input');
    rangeInput?.addEventListener('input', e => {
      callbacks.onRangeChange(entry.id, /** @type {HTMLInputElement} */ (e.target).value);
    });

    li.querySelector('.btn-rotate-file')?.addEventListener('click', () => callbacks.onRotate(entry.id));
    li.querySelector('.btn-organizer-file')?.addEventListener('click', () => callbacks.onOrganize(entry.id));
    li.querySelector('.btn-preview')?.addEventListener('click', () => callbacks.onPreview(entry.file));
    li.querySelector('.btn-danger')?.addEventListener('click', () => callbacks.onRemove(entry.id));

    fileListEl.appendChild(li);
  });
}

/* ── Messages ───────────────────────────────────────────────── */

export function showMessage(text, type = 'info', autoDismissMs = 0) {
  messageBanner.className = `message-banner ${type}`;
  messageBanner.textContent = text;
  messageBanner.classList.remove('hidden');

  if (autoDismissMs > 0) {
    setTimeout(() => hideMessage(), autoDismissMs);
  }
}

export function hideMessage() {
  messageBanner.classList.add('hidden');
  messageBanner.textContent = '';
  messageBanner.className = 'message-banner hidden';
}

/* ── Progress ───────────────────────────────────────────────── */

export function showProgress(prefix = '') {
  const container = prefix ? document.getElementById(`${prefix}ProgressContainer`) : progressContainer;
  if (container) container.classList.remove('hidden');
}

export function hideProgress(prefix = '') {
  const container = prefix ? document.getElementById(`${prefix}ProgressContainer`) : progressContainer;
  if (container) container.classList.add('hidden');
  setProgress(0, '', prefix);
}

export function setProgress(percent, label, prefix = '') {
  const clamped = Math.min(100, Math.max(0, percent));
  const fill = prefix ? document.getElementById(`${prefix}ProgressFill`) : progressFill;
  const labelEl = prefix ? document.getElementById(`${prefix}ProgressLabel`) : progressLabel;
  const percentEl = prefix ? document.getElementById(`${prefix}ProgressPercent`) : progressPercent;

  if (fill) fill.style.width = `${clamped}%`;
  if (labelEl) labelEl.textContent = label;
  if (percentEl) percentEl.textContent = `${clamped}%`;
}

/* ── Merge Button ───────────────────────────────────────────── */

export function setMergeEnabled(enabled) {
  mergeBtn.disabled = !enabled;
}

/* ── Preview Modal ──────────────────────────────────────────── */

let activePreviewUrl = null;

export function showPreview(file) {
  if (activePreviewUrl) {
    URL.revokeObjectURL(activePreviewUrl);
  }

  activePreviewUrl = URL.createObjectURL(file);
  previewFrame.src = activePreviewUrl;
  previewTitle.textContent = file.name;
  previewModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

export function hidePreview() {
  previewModal.classList.add('hidden');
  document.body.style.overflow = '';

  setTimeout(() => {
    previewFrame.src = '';
    if (activePreviewUrl) {
      URL.revokeObjectURL(activePreviewUrl);
      activePreviewUrl = null;
    }
  }, 100);
}

/* ── Merged Result Modal ────────────────────────────────────── */

let activeResultUrl = null;

/**
 * Show result modal with in-app preview of merged document.
 * @param {Uint8Array} pdfBytes
 * @param {string} filename
 * @param {string} detailsText
 */
export function showResultModal(pdfBytes, filename, detailsText) {
  if (activeResultUrl) {
    URL.revokeObjectURL(activeResultUrl);
  }

  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  activeResultUrl = URL.createObjectURL(blob);

  resultFrame.src = activeResultUrl;
  resultDetails.textContent = detailsText;
  resultModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Setup download button
  resultDownloadBtn.onclick = () => {
    const a = document.createElement('a');
    a.href = activeResultUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Setup open in new tab button
  resultOpenTabBtn.onclick = () => {
    window.open(activeResultUrl, '_blank');
  };
}

export function hideResultModal() {
  resultModal.classList.add('hidden');
  document.body.style.overflow = '';

  setTimeout(() => {
    resultFrame.src = '';
    if (activeResultUrl) {
      URL.revokeObjectURL(activeResultUrl);
      activeResultUrl = null;
    }
  }, 100);
}

/* ── Visual Page Organizer Modal ────────────────────────────── */

/**
 * Opens the Visual Page Organizer for a file entry or across all files.
 *
 * @param {Object} options
 * @param {string} options.title
 * @param {Array<{ key: string, file: File, originalIndex: number, rotation: number, excluded: boolean, label: string }>} options.pages
 * @param {(updatedPages: Array<{ key: string, file: File, originalIndex: number, rotation: number, excluded: boolean }>) => void} options.onApply
 */
export function openPageOrganizer({ title, pages, onApply }) {
  organizerTitle.textContent = title;
  organizerModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Make a working copy of pages
  let currentPages = pages.map(p => ({ ...p }));

  function updateOrganizerStats() {
    const included = currentPages.filter(p => !p.excluded).length;
    orgStatsSummary.textContent = `${included} of ${currentPages.length} pages selected`;
  }

  function renderGrid() {
    if (activeSortableOrganizer) {
      activeSortableOrganizer.destroy();
      activeSortableOrganizer = null;
    }

    organizerGrid.innerHTML = '';

    currentPages.forEach((page, index) => {
      const card = document.createElement('div');
      card.className = `page-card ${page.excluded ? 'excluded' : ''}`;
      card.dataset.index = String(index);

      card.innerHTML = `
        <div class="page-card-header">
          <span class="page-card-title">${escapeHtml(page.label || `Page ${page.originalIndex + 1}`)}</span>
          ${page.rotation > 0 ? `<span class="page-angle-badge">${page.rotation}°</span>` : ''}
        </div>
        <div class="page-thumb-wrap">
          <img class="page-thumb-img" alt="Page ${page.originalIndex + 1}" style="transform: rotate(${page.rotation}deg);" />
        </div>
        <div class="page-card-actions">
          <button class="btn btn-ghost btn-xs btn-org-rotate" title="Rotate 90° clockwise">↻ Rotate</button>
          <button class="btn btn-ghost btn-xs btn-org-toggle" title="${page.excluded ? 'Include page' : 'Exclude page'}">
            ${page.excluded ? 'Include' : 'Exclude'}
          </button>
        </div>
      `;

      // Async load thumbnail image
      const img = card.querySelector('.page-thumb-img');
      renderPageThumbnail(page.file, page.originalIndex, 0).then(dataUrl => {
        if (img) img.src = dataUrl;
      });

      // Rotate page button
      card.querySelector('.btn-org-rotate')?.addEventListener('click', e => {
        e.stopPropagation();
        page.rotation = (page.rotation + 90) % 360;
        renderGrid();
      });

      // Toggle include/exclude button
      card.querySelector('.btn-org-toggle')?.addEventListener('click', e => {
        e.stopPropagation();
        page.excluded = !page.excluded;
        renderGrid();
      });

      // Card click toggles include/exclude
      card.addEventListener('click', () => {
        page.excluded = !page.excluded;
        renderGrid();
      });

      organizerGrid.appendChild(card);
    });

    updateOrganizerStats();

    // Enable SortableJS on organizer grid
    if (typeof Sortable !== 'undefined') {
      activeSortableOrganizer = Sortable.create(organizerGrid, {
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd(evt) {
          const { oldIndex, newIndex } = evt;
          if (oldIndex !== newIndex && oldIndex !== undefined && newIndex !== undefined) {
            const [moved] = currentPages.splice(oldIndex, 1);
            currentPages.splice(newIndex, 0, moved);
            renderGrid();
          }
        },
      });
    }
  }

  renderGrid();

  // Toolbar handlers
  orgSelectAllBtn.onclick = () => {
    currentPages.forEach(p => (p.excluded = false));
    renderGrid();
  };

  orgDeselectAllBtn.onclick = () => {
    currentPages.forEach(p => (p.excluded = true));
    renderGrid();
  };

  orgRotateAllBtn.onclick = () => {
    currentPages.forEach(p => {
      p.rotation = (p.rotation + 90) % 360;
    });
    renderGrid();
  };

  orgResetBtn.onclick = () => {
    currentPages = pages.map(p => ({ ...p, rotation: 0, excluded: false }));
    renderGrid();
  };

  // Close handlers
  function closeOrganizer() {
    organizerModal.classList.add('hidden');
    document.body.style.overflow = '';
    if (activeSortableOrganizer) {
      activeSortableOrganizer.destroy();
      activeSortableOrganizer = null;
    }
  }

  orgCancelBtn.onclick = closeOrganizer;

  orgApplyBtn.onclick = () => {
    onApply(currentPages);
    closeOrganizer();
  };
}

export function hidePageOrganizer() {
  organizerModal.classList.add('hidden');
  document.body.style.overflow = '';
  if (activeSortableOrganizer) {
    activeSortableOrganizer.destroy();
    activeSortableOrganizer = null;
  }
}

/* ── SVG Icon Helpers ───────────────────────────────────────── */

function dragHandleIcon() {
  return `<svg width="14" height="14" viewBox="0 0 16 16" fill="none">
    <circle cx="5" cy="3" r="1.2" fill="currentColor"/>
    <circle cx="5" cy="8" r="1.2" fill="currentColor"/>
    <circle cx="5" cy="13" r="1.2" fill="currentColor"/>
    <circle cx="11" cy="3" r="1.2" fill="currentColor"/>
    <circle cx="11" cy="8" r="1.2" fill="currentColor"/>
    <circle cx="11" cy="13" r="1.2" fill="currentColor"/>
  </svg>`;
}

function pdfIcon() {
  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <rect x="4" y="2" width="12" height="16" rx="2" stroke="currentColor" stroke-width="2"/>
    <path d="M8 7h6M8 11h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M14 14v6m-2-2 2 2 2-2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function trashIcon() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
