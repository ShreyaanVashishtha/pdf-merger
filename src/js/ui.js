/**
 * ui.js – DOM manipulation and rendering helpers
 *
 * Keeps all direct DOM interactions in one place, so other modules
 * stay framework-agnostic and easier to unit-test.
 *
 * Exports:
 *  - renderFileList      Re-renders the sortable file list
 *  - showMessage         Displays info / success / error banners
 *  - hideMessage         Hides the banner
 *  - setProgress         Updates the progress bar
 *  - showProgress        Shows the progress container
 *  - hideProgress        Hides the progress container
 *  - setMergeEnabled     Enable / disable the merge button
 *  - showPreview         Opens the preview modal for a File
 *  - hidePreview         Closes the preview modal
 *  - updateFileCount     Updates the badge count
 */

import { formatBytes } from './utils.js';

/* ── Cached DOM references ─────────────────────────────────── */
const fileListEl        = /** @type {HTMLUListElement}  */ (document.getElementById('fileList'));
const fileListSection   = /** @type {HTMLElement}       */ (document.getElementById('fileListSection'));
const fileCountEl       = /** @type {HTMLSpanElement}   */ (document.getElementById('fileCount'));
const messageBanner     = /** @type {HTMLDivElement}    */ (document.getElementById('messageBanner'));
const progressContainer = /** @type {HTMLDivElement}    */ (document.getElementById('progressContainer'));
const progressFill      = /** @type {HTMLDivElement}    */ (document.getElementById('progressFill'));
const progressLabel     = /** @type {HTMLSpanElement}   */ (document.getElementById('progressLabel'));
const progressPercent   = /** @type {HTMLSpanElement}   */ (document.getElementById('progressPercent'));
const progressBar       = /** @type {HTMLDivElement}    */ (document.querySelector('.progress-bar'));
const mergeBtn          = /** @type {HTMLButtonElement} */ (document.getElementById('mergeBtn'));
const previewModal      = /** @type {HTMLDivElement}    */ (document.getElementById('previewModal'));
const previewFrame      = /** @type {HTMLIFrameElement} */ (document.getElementById('previewFrame'));
const previewTitle      = /** @type {HTMLHeadingElement}*/ (document.getElementById('previewTitle'));

/* ── Rendering ─────────────────────────────────────────────── */

/**
 * Re-render the file list.
 *
 * @param {import('./fileManager.js').FileEntry[]} files
 * @param {{ onRemove: (id: string) => void, onPreview: (file: File) => void }} callbacks
 */
export function renderFileList(files, { onRemove, onPreview }) {
  // Show or hide the whole section
  fileListSection.classList.toggle('hidden', files.length === 0);

  // Update badge
  fileCountEl.textContent = String(files.length);

  // Clear list and re-render
  fileListEl.innerHTML = '';

  files.forEach((entry, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';
    li.dataset.id = entry.id;
    li.setAttribute('aria-label', `File ${index + 1}: ${entry.file.name}`);

    li.innerHTML = `
      <span class="drag-handle" aria-hidden="true" title="Drag to reorder">
        ${dragHandleIcon()}
      </span>
      <span class="file-icon" aria-hidden="true">${pdfIcon()}</span>
      <span class="file-info">
        <span class="file-name" title="${escapeHtml(entry.file.name)}">${escapeHtml(entry.file.name)}</span>
        <span class="file-meta">${formatBytes(entry.file.size)}</span>
      </span>
      <span class="file-item-actions">
        <button class="btn btn-preview" data-id="${entry.id}" aria-label="Preview ${escapeHtml(entry.file.name)}">
          Preview
        </button>
        <button class="btn btn-danger" data-id="${entry.id}" aria-label="Remove ${escapeHtml(entry.file.name)}">
          ${trashIcon()}
        </button>
      </span>
    `;

    // Attach event listeners
    li.querySelector('.btn-preview')?.addEventListener('click', () => onPreview(entry.file));
    li.querySelector('.btn-danger').addEventListener('click',  () => onRemove(entry.id));

    fileListEl.appendChild(li);
  });
}

/** Update the file count badge only (cheaper than full re-render). */
export function updateFileCount(count) {
  fileCountEl.textContent = String(count);
  fileListSection.classList.toggle('hidden', count === 0);
}

/* ── Messages ───────────────────────────────────────────────── */

/**
 * Display a banner message.
 * @param {string} text
 * @param {'error'|'success'|'info'} [type='info']
 * @param {number} [autoDismissMs=0] – If > 0, auto-hide after this many ms.
 */
export function showMessage(text, type = 'info', autoDismissMs = 0) {
  messageBanner.className = `message-banner ${type}`;
  messageBanner.textContent = text;
  messageBanner.classList.remove('hidden');

  if (autoDismissMs > 0) {
    setTimeout(() => hideMessage(), autoDismissMs);
  }
}

/** Hide the message banner. */
export function hideMessage() {
  messageBanner.classList.add('hidden');
  messageBanner.textContent = '';
  messageBanner.className = 'message-banner hidden';
}

/* ── Progress ───────────────────────────────────────────────── */

/**
 * Show the progress container.
 */
export function showProgress() {
  progressContainer.classList.remove('hidden');
}

/**
 * Hide the progress container and reset it.
 */
export function hideProgress() {
  progressContainer.classList.add('hidden');
  setProgress(0, '');
}

/**
 * Update progress bar.
 * @param {number} percent  0–100
 * @param {string} label
 */
export function setProgress(percent, label) {
  const clamped = Math.min(100, Math.max(0, percent));
  progressFill.style.width   = `${clamped}%`;
  progressLabel.textContent  = label;
  progressPercent.textContent = `${clamped}%`;
  progressBar?.setAttribute('aria-valuenow', String(clamped));
}

/* ── Merge button ───────────────────────────────────────────── */

/**
 * Enable or disable the merge button.
 * @param {boolean} enabled
 */
export function setMergeEnabled(enabled) {
  mergeBtn.disabled = !enabled;
}

/* ── Preview modal ──────────────────────────────────────────── */

/** @type {string|null} Active object URL so we can revoke it later. */
let activePreviewUrl = null;

/**
 * Open the preview modal for a given File.
 * @param {File} file
 */
export function showPreview(file) {
  // Revoke any previous object URL
  if (activePreviewUrl) {
    URL.revokeObjectURL(activePreviewUrl);
  }

  activePreviewUrl = URL.createObjectURL(file);
  previewFrame.src  = activePreviewUrl;
  previewTitle.textContent = file.name;
  previewModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

/** Close the preview modal. */
export function hidePreview() {
  previewModal.classList.add('hidden');
  document.body.style.overflow = '';

  // Give iframe a moment to unload before revoking
  setTimeout(() => {
    previewFrame.src = '';
    if (activePreviewUrl) {
      URL.revokeObjectURL(activePreviewUrl);
      activePreviewUrl = null;
    }
  }, 100);
}

/* ── SVG helpers (inline to avoid extra HTTP requests) ──────── */

function dragHandleIcon() {
  return `<svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="5.5" cy="4" r="1" fill="currentColor"/>
    <circle cx="5.5" cy="8" r="1" fill="currentColor"/>
    <circle cx="5.5" cy="12" r="1" fill="currentColor"/>
    <circle cx="10.5" cy="4" r="1" fill="currentColor"/>
    <circle cx="10.5" cy="8" r="1" fill="currentColor"/>
    <circle cx="10.5" cy="12" r="1" fill="currentColor"/>
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
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

/**
 * Escape HTML special characters to prevent XSS when inserting into innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
