/**
 * main.js – Application entry point
 *
 * Wires together:
 *  - FileManager  (file state)
 *  - UI helpers   (DOM rendering)
 *  - pdfMerger    (processing)
 *  - SortableJS   (drag-and-drop reordering)
 *  - Theme toggle (dark / light mode)
 */

import { createFileManager } from './fileManager.js';
import { mergePdfs }         from './pdfMerger.js';
import {
  renderFileList,
  showMessage,
  hideMessage,
  showProgress,
  hideProgress,
  setProgress,
  setMergeEnabled,
  showPreview,
  hidePreview,
} from './ui.js';
import { sanitiseFilename }  from './utils.js';

/* ── DOM references ─────────────────────────────────────────── */
const dropZone      = /** @type {HTMLDivElement}    */ (document.getElementById('dropZone'));
const fileInput     = /** @type {HTMLInputElement}  */ (document.getElementById('fileInput'));
const mergeBtn      = /** @type {HTMLButtonElement} */ (document.getElementById('mergeBtn'));
const clearAllBtn   = /** @type {HTMLButtonElement} */ (document.getElementById('clearAllBtn'));
const themeToggle   = /** @type {HTMLButtonElement} */ (document.getElementById('themeToggle'));
const fileListEl    = /** @type {HTMLUListElement}  */ (document.getElementById('fileList'));
const closePreview  = /** @type {HTMLButtonElement} */ (document.getElementById('closePreview'));
const modalBackdrop = /** @type {HTMLDivElement}    */ (document.getElementById('modalBackdrop'));

/* ── State ──────────────────────────────────────────────────── */
const fileManager = createFileManager();
let sortable = null;   // SortableJS instance
let isMerging = false; // Guard against concurrent merges

/* ── Initial render ─────────────────────────────────────────── */
renderFileList([], { onRemove: removeFile, onPreview: showPreview });
setMergeEnabled(false);

/* ── File list update handler ───────────────────────────────── */
fileManager.onUpdate(files => {
  renderFileList(files, { onRemove: removeFile, onPreview: showPreview });
  setMergeEnabled(files.length >= 2);

  // Re-initialise Sortable after every re-render so new DOM nodes are included
  initialiseSortable();
});

/* ── Drag-and-drop on the drop zone ────────────────────────── */
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  handleFiles(e.dataTransfer?.files ?? []);
});

// Allow keyboard activation of the drop zone
dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInput.click();
  }
});

dropZone.addEventListener('click', e => {
  // Don't trigger when clicking the label/button directly
  if (e.target !== dropZone && !dropZone.contains(/** @type {Node} */(e.target))) return;
  if (/** @type {HTMLElement} */(e.target).closest('label')) return;
  fileInput.click();
});

/* ── File input change ──────────────────────────────────────── */
fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files ?? []);
  // Reset input so the same file can be re-selected if removed
  fileInput.value = '';
});

/* ── Add files helper ───────────────────────────────────────── */
function handleFiles(incoming) {
  const { errors } = fileManager.addFiles(incoming);
  if (errors.length > 0) {
    showMessage(errors.join('\n'), 'error', 6000);
  } else {
    hideMessage();
  }
}

/* ── Remove file ────────────────────────────────────────────── */
function removeFile(id) {
  fileManager.removeFile(id);
  const files = fileManager.getFiles();
  if (files.length === 0) hideMessage();
}

/* ── Clear all ──────────────────────────────────────────────── */
clearAllBtn.addEventListener('click', () => {
  fileManager.clearAll();
  hideMessage();
});

/* ── Sortable (reordering) ──────────────────────────────────── */
function initialiseSortable() {
  if (sortable) {
    sortable.destroy();
    sortable = null;
  }

  if (fileListEl.children.length === 0) return;

  sortable = Sortable.create(fileListEl, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    onEnd(evt) {
      const { oldIndex, newIndex } = evt;
      if (oldIndex !== newIndex && oldIndex !== undefined && newIndex !== undefined) {
        fileManager.reorder(oldIndex, newIndex);
      }
    },
  });
}

/* ── Merge & Download ───────────────────────────────────────── */
mergeBtn.addEventListener('click', async () => {
  if (isMerging) return;

  const files = fileManager.getFiles();
  if (files.length < 2) {
    showMessage('Please add at least two PDF files to merge.', 'error');
    return;
  }

  isMerging = true;
  mergeBtn.disabled = true;
  hideMessage();
  showProgress();

  try {
    const pdfBytes = await mergePdfs(
      files.map(entry => entry.file),
      (percent, label) => setProgress(percent, label)
    );

    // Trigger download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = sanitiseFilename('merged.pdf');
    a.click();

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    showMessage(
      `✓ Merged ${files.length} PDFs successfully! Your download should start automatically.`,
      'success',
      6000
    );
  } catch (err) {
    showMessage(`Merge failed: ${err.message}`, 'error');
    console.error('[PDF Merger] Merge error:', err);
  } finally {
    isMerging = false;
    setMergeEnabled(fileManager.getFiles().length >= 2);
    hideProgress();
  }
});

/* ── Preview modal ──────────────────────────────────────────── */
closePreview.addEventListener('click',  hidePreview);
modalBackdrop.addEventListener('click', hidePreview);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') hidePreview();
});

/* ── Dark mode toggle ───────────────────────────────────────── */
const THEME_KEY = 'pdfMerger_theme';

function applyTheme(theme) {
  document.body.classList.toggle('dark-mode',  theme === 'dark');
  document.body.classList.toggle('light-mode', theme === 'light');
}

// Restore saved preference, or fall back to OS preference
const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) {
  applyTheme(savedTheme);
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  applyTheme('dark');
}

themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark-mode');
  const next   = isDark ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});
