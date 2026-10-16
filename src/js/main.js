/**
 * main.js – PDF Merger & Toolbox Application Entry Point
 *
 * Coordinates:
 *  - Tool switching (Merge, Split, Rotate)
 *  - FileManager & PDF operations
 *  - Visual Page Organizer & Thumbnail previews
 *  - Sortable drag-and-drop & accessibility controls
 *  - PWA Service Worker & Theme toggle
 */

import { createFileManager } from './fileManager.js';
import {
  mergePdfs,
  getPdfPageCount,
  splitPdf,
  rotatePdf,
} from './pdfTools.js';
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
  showResultModal,
  hideResultModal,
  openPageOrganizer,
  hidePageOrganizer,
} from './ui.js';
import { sanitiseFilename, downloadBlob } from './utils.js';
import { parsePageRange } from './pageRange.js';
import { renderPageThumbnail } from './thumbnailRenderer.js';

/* ── DOM References: Tabs & Global ──────────────────────────── */
const tabMerge       = /** @type {HTMLButtonElement} */ (document.getElementById('tabMerge'));
const tabSplit       = /** @type {HTMLButtonElement} */ (document.getElementById('tabSplit'));
const tabRotate      = /** @type {HTMLButtonElement} */ (document.getElementById('tabRotate'));
const panelMerge     = /** @type {HTMLDivElement}    */ (document.getElementById('panelMerge'));
const panelSplit     = /** @type {HTMLDivElement}    */ (document.getElementById('panelSplit'));
const panelRotate    = /** @type {HTMLDivElement}    */ (document.getElementById('panelRotate'));
const themeToggle    = /** @type {HTMLButtonElement} */ (document.getElementById('themeToggle'));
const offlineBadge   = /** @type {HTMLSpanElement}   */ (document.getElementById('offlineBadge'));

/* ── DOM References: Merge Tool ─────────────────────────────── */
const dropZone            = /** @type {HTMLDivElement}    */ (document.getElementById('dropZone'));
const fileInput           = /** @type {HTMLInputElement}  */ (document.getElementById('fileInput'));
const mergeBtn            = /** @type {HTMLButtonElement} */ (document.getElementById('mergeBtn'));
const clearAllBtn         = /** @type {HTMLButtonElement} */ (document.getElementById('clearAllBtn'));
const fileListEl          = /** @type {HTMLUListElement}  */ (document.getElementById('fileList'));
const outputFilenameInput = /** @type {HTMLInputElement}  */ (document.getElementById('outputFilename'));
const sortAzBtn           = /** @type {HTMLButtonElement} */ (document.getElementById('sortAzBtn'));
const sortZaBtn           = /** @type {HTMLButtonElement} */ (document.getElementById('sortZaBtn'));
const sortSizeBtn         = /** @type {HTMLButtonElement} */ (document.getElementById('sortSizeBtn'));
const reverseBtn          = /** @type {HTMLButtonElement} */ (document.getElementById('reverseBtn'));
const openAllOrganizerBtn = /** @type {HTMLButtonElement} */ (document.getElementById('openAllOrganizerBtn'));

/* ── DOM References: Modals ─────────────────────────────────── */
const closePreview    = /** @type {HTMLButtonElement} */ (document.getElementById('closePreview'));
const modalBackdrop   = /** @type {HTMLDivElement}    */ (document.getElementById('modalBackdrop'));
const closeResult     = /** @type {HTMLButtonElement} */ (document.getElementById('closeResult'));
const resultBackdrop  = /** @type {HTMLDivElement}    */ (document.getElementById('resultBackdrop'));
const closeOrganizer  = /** @type {HTMLButtonElement} */ (document.getElementById('closeOrganizer'));
const organizerBackdrop=/** @type {HTMLDivElement}    */ (document.getElementById('organizerBackdrop'));

/* ── DOM References: Split Tool ─────────────────────────────── */
const splitDropZone       = /** @type {HTMLDivElement}    */ (document.getElementById('splitDropZone'));
const splitFileInput      = /** @type {HTMLInputElement}  */ (document.getElementById('splitFileInput'));
const splitConfigSection  = /** @type {HTMLElement}       */ (document.getElementById('splitConfigSection'));
const splitFileNameEl     = /** @type {HTMLDivElement}    */ (document.getElementById('splitFileName'));
const splitFileMetaEl     = /** @type {HTMLDivElement}    */ (document.getElementById('splitFileMeta'));
const splitChangeFileBtn  = /** @type {HTMLButtonElement} */ (document.getElementById('splitChangeFileBtn'));
const splitPageRangeInput = /** @type {HTMLInputElement}  */ (document.getElementById('splitPageRangeInput'));
const splitRangeFeedback  = /** @type {HTMLDivElement}    */ (document.getElementById('splitRangeFeedback'));
const splitIntervalInput  = /** @type {HTMLInputElement}  */ (document.getElementById('splitIntervalInput'));
const splitExecuteBtn     = /** @type {HTMLButtonElement} */ (document.getElementById('splitExecuteBtn'));
const splitResultsArea    = /** @type {HTMLDivElement}    */ (document.getElementById('splitResultsArea'));

/* ── DOM References: Rotate Tool ────────────────────────────── */
const rotateDropZone        = /** @type {HTMLDivElement}    */ (document.getElementById('rotateDropZone'));
const rotateFileInput       = /** @type {HTMLInputElement}  */ (document.getElementById('rotateFileInput'));
const rotateConfigSection   = /** @type {HTMLElement}       */ (document.getElementById('rotateConfigSection'));
const rotateFileNameEl      = /** @type {HTMLDivElement}    */ (document.getElementById('rotateFileName'));
const rotateFileMetaEl      = /** @type {HTMLDivElement}    */ (document.getElementById('rotateFileMeta'));
const rotateChangeFileBtn   = /** @type {HTMLButtonElement} */ (document.getElementById('rotateChangeFileBtn'));
const rotateAllCwBtn        = /** @type {HTMLButtonElement} */ (document.getElementById('rotateAllCwBtn'));
const rotateAllCcwBtn       = /** @type {HTMLButtonElement} */ (document.getElementById('rotateAllCcwBtn'));
const rotateAll180Btn       = /** @type {HTMLButtonElement} */ (document.getElementById('rotateAll180Btn'));
const rotateResetBtn        = /** @type {HTMLButtonElement} */ (document.getElementById('rotateResetBtn'));
const rotateThumbnailsGrid  = /** @type {HTMLDivElement}    */ (document.getElementById('rotateThumbnailsGrid'));
const rotateExecuteBtn      = /** @type {HTMLButtonElement} */ (document.getElementById('rotateExecuteBtn'));

/* ── State ──────────────────────────────────────────────────── */
const fileManager = createFileManager();
let sortableMergeList = null;
let isMerging = false;

// Split state
let splitTargetFile = null;
let splitTargetPageCount = 0;

// Rotate state
let rotateTargetFile = null;
let rotateTargetPageCount = 0;
let rotatePagesState = []; // [{ pageIndex, rotation }]

/* ── Initial render ─────────────────────────────────────────── */
renderFiles();
setMergeEnabled(false);

/* ── Tab Navigation ─────────────────────────────────────────── */
function setActiveTab(activeTab) {
  const tabs = [
    { btn: tabMerge, panel: panelMerge },
    { btn: tabSplit, panel: panelSplit },
    { btn: tabRotate, panel: panelRotate },
  ];

  tabs.forEach(({ btn, panel }) => {
    const isActive = btn === activeTab;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
    panel.classList.toggle('hidden', !isActive);
  });
  hideMessage();
}

tabMerge.addEventListener('click', () => setActiveTab(tabMerge));
tabSplit.addEventListener('click', () => setActiveTab(tabSplit));
tabRotate.addEventListener('click', () => setActiveTab(tabRotate));

/* ── File Manager Callbacks & Rendering ─────────────────────── */
function renderFiles() {
  const files = fileManager.getFiles();
  renderFileList(files, {
    onRemove: removeFile,
    onPreview: showPreview,
    onRangeChange: (id, range) => fileManager.setPageRange(id, range),
    onRotate: id => fileManager.rotateDocument(id),
    onOrganize: id => openOrganizerForFile(id),
    onMoveUp: id => fileManager.moveUp(id),
    onMoveDown: id => fileManager.moveDown(id),
  });

  const stats = fileManager.getTotalStats();
  setMergeEnabled(files.length >= 2 && !stats.hasErrors);
  initialiseSortable();
}

fileManager.onUpdate(() => {
  renderFiles();
});

/* ── Drag and Drop for Merge Upload Zone ────────────────────── */
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
  handleIncomingFiles(e.dataTransfer?.files ?? []);
});

dropZone.addEventListener('click', e => {
  if (/** @type {HTMLElement} */(e.target).closest('label')) return;
  fileInput.click();
});

fileInput.addEventListener('change', () => {
  handleIncomingFiles(fileInput.files ?? []);
  fileInput.value = '';
});

async function handleIncomingFiles(incoming) {
  const { added, errors } = fileManager.addFiles(incoming);

  if (errors.length > 0) {
    showMessage(errors.join('\n'), 'error', 6000);
  } else {
    hideMessage();
  }

  // Asynchronously read page count for each newly added file
  for (const entry of added) {
    try {
      const count = await getPdfPageCount(entry.file);
      fileManager.setPageCount(entry.id, count);
    } catch (err) {
      console.warn(`[PDF Merger] Could not read page count for ${entry.file.name}:`, err);
      fileManager.setPageCount(entry.id, 1);
    }
  }
}

function removeFile(id) {
  fileManager.removeFile(id);
  if (fileManager.getFiles().length === 0) hideMessage();
}

clearAllBtn.addEventListener('click', () => {
  fileManager.clearAll();
  hideMessage();
});

/* ── Quick Sorting ──────────────────────────────────────────── */
sortAzBtn.addEventListener('click', () => fileManager.sortByName(true));
sortZaBtn.addEventListener('click', () => fileManager.sortByName(false));
sortSizeBtn.addEventListener('click', () => fileManager.sortBySize(true));
reverseBtn.addEventListener('click', () => fileManager.reverseOrder());

/* ── Sortable Drag-and-Drop ─────────────────────────────────── */
function initialiseSortable() {
  if (sortableMergeList) {
    sortableMergeList.destroy();
    sortableMergeList = null;
  }

  if (fileListEl.children.length === 0) return;

  if (typeof Sortable !== 'undefined') {
    sortableMergeList = Sortable.create(fileListEl, {
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
}

/* ── Visual Page Organizer: Single File & All Files ─────────── */
function openOrganizerForFile(fileId) {
  const entry = fileManager.getFiles().find(f => f.id === fileId);
  if (!entry || entry.pageCount === 0) return;

  // Prepare page representations
  const pages = [];
  for (let i = 0; i < entry.pageCount; i++) {
    let rotation = entry.rotation || 0;
    let excluded = false;

    if (entry.customPages) {
      const custom = entry.customPages.find(p => p.originalIndex === i);
      if (custom) {
        rotation = custom.rotation;
        excluded = custom.excluded;
      }
    } else if (entry.parsedIndices && entry.parsedIndices.length > 0) {
      excluded = !entry.parsedIndices.includes(i);
    }

    pages.push({
      key: `${entry.id}_p${i}`,
      file: entry.file,
      originalIndex: i,
      rotation,
      excluded,
      label: `Page ${i + 1}`,
    });
  }

  openPageOrganizer({
    title: `Organize Pages: ${entry.file.name}`,
    pages,
    onApply(updatedPages) {
      fileManager.setCustomPages(
        entry.id,
        updatedPages.map(p => ({
          originalIndex: p.originalIndex,
          rotation: p.rotation,
          excluded: p.excluded,
        }))
      );
    },
  });
}

openAllOrganizerBtn.addEventListener('click', () => {
  const files = fileManager.getFiles();
  if (files.length === 0) return;

  const allPages = [];
  files.forEach(entry => {
    const count = entry.pageCount || 1;
    for (let i = 0; i < count; i++) {
      let rotation = entry.rotation || 0;
      let excluded = false;

      if (entry.customPages) {
        const custom = entry.customPages.find(p => p.originalIndex === i);
        if (custom) {
          rotation = custom.rotation;
          excluded = custom.excluded;
        }
      } else if (entry.parsedIndices && entry.parsedIndices.length > 0) {
        excluded = !entry.parsedIndices.includes(i);
      }

      allPages.push({
        key: `${entry.id}_p${i}`,
        fileId: entry.id,
        file: entry.file,
        originalIndex: i,
        rotation,
        excluded,
        label: `${entry.file.name.slice(0, 14)} · P${i + 1}`,
      });
    }
  });

  openPageOrganizer({
    title: 'Visual Page Organizer: All Files',
    pages: allPages,
    onApply(updatedPages) {
      // Group back by fileId and update each file
      const byFile = new Map();
      updatedPages.forEach(p => {
        if (!byFile.has(p.fileId)) byFile.set(p.fileId, []);
        byFile.get(p.fileId).push(p);
      });

      byFile.forEach((pagesForFile, fileId) => {
        fileManager.setCustomPages(
          fileId,
          pagesForFile.map(p => ({
            originalIndex: p.originalIndex,
            rotation: p.rotation,
            excluded: p.excluded,
          }))
        );
      });
    },
  });
});

/* ── Merge & Download Action ────────────────────────────────── */
mergeBtn.addEventListener('click', async () => {
  if (isMerging) return;

  const files = fileManager.getFiles();
  if (files.length < 2) {
    showMessage('Please add at least two PDF files to merge.', 'error');
    return;
  }

  const rawFilename = outputFilenameInput.value.trim() || 'merged-document';
  const finalFilename = sanitiseFilename(`${rawFilename}.pdf`);

  isMerging = true;
  mergeBtn.disabled = true;
  hideMessage();
  showProgress();

  try {
    const pdfBytes = await mergePdfs(files, (percent, label) => {
      setProgress(percent, label);
    });

    const stats = fileManager.getTotalStats();
    const details = `Combined ${files.length} PDFs into ${stats.selectedPages} pages.`;

    // Automatically trigger download
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, finalFilename);

    // Also display result preview modal so user can view/inspect
    showResultModal(pdfBytes, finalFilename, details);

    showMessage(
      `✓ Merged ${files.length} PDFs successfully! Your download has started.`,
      'success',
      7000
    );
  } catch (err) {
    showMessage(`Merge failed: ${err.message}`, 'error');
    console.error('[PDF Merger] Merge error:', err);
  } finally {
    isMerging = false;
    renderFiles();
    hideProgress();
  }
});

/* ── Modal Close Listeners ──────────────────────────────────── */
closePreview.addEventListener('click', hidePreview);
modalBackdrop.addEventListener('click', hidePreview);

closeResult.addEventListener('click', hideResultModal);
resultBackdrop.addEventListener('click', hideResultModal);

closeOrganizer.addEventListener('click', hidePageOrganizer);
organizerBackdrop.addEventListener('click', hidePageOrganizer);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hidePreview();
    hideResultModal();
    hidePageOrganizer();
  }
});

/* ── Split Tool Logic ───────────────────────────────────────── */
splitDropZone.addEventListener('dragover', e => {
  e.preventDefault();
  splitDropZone.classList.add('drag-over');
});

splitDropZone.addEventListener('dragleave', () => {
  splitDropZone.classList.remove('drag-over');
});

splitDropZone.addEventListener('drop', e => {
  e.preventDefault();
  splitDropZone.classList.remove('drag-over');
  const files = e.dataTransfer?.files;
  if (files && files[0]) loadSplitFile(files[0]);
});

splitDropZone.addEventListener('click', e => {
  if (/** @type {HTMLElement} */(e.target).closest('label')) return;
  splitFileInput.click();
});

splitFileInput.addEventListener('change', () => {
  if (splitFileInput.files && splitFileInput.files[0]) {
    loadSplitFile(splitFileInput.files[0]);
  }
  splitFileInput.value = '';
});

splitChangeFileBtn.addEventListener('click', () => {
  splitTargetFile = null;
  splitConfigSection.classList.add('hidden');
  splitDropZone.parentElement.classList.remove('hidden');
  splitResultsArea.innerHTML = '';
  splitResultsArea.classList.add('hidden');
});

async function loadSplitFile(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showMessage(`"${file.name}" is not a PDF file.`, 'error');
    return;
  }

  splitTargetFile = file;
  splitFileNameEl.textContent = file.name;
  splitFileMetaEl.textContent = 'Loading page count…';

  splitDropZone.parentElement.classList.add('hidden');
  splitConfigSection.classList.remove('hidden');
  splitResultsArea.innerHTML = '';
  splitResultsArea.classList.add('hidden');

  try {
    splitTargetPageCount = await getPdfPageCount(file);
    splitFileMetaEl.textContent = `${splitTargetPageCount} pages · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;
    updateSplitRangeFeedback();
  } catch (err) {
    splitFileMetaEl.textContent = `Could not read pages: ${err.message}`;
  }
}

function updateSplitRangeFeedback() {
  if (!splitTargetFile || splitTargetPageCount === 0) return;
  const input = splitPageRangeInput.value.trim();
  const parsed = parsePageRange(input, splitTargetPageCount);
  if (parsed.error) {
    splitRangeFeedback.textContent = parsed.error;
    splitRangeFeedback.className = 'range-feedback text-danger';
  } else {
    splitRangeFeedback.textContent = `✓ ${parsed.summary}`;
    splitRangeFeedback.className = 'range-feedback';
  }
}

splitPageRangeInput.addEventListener('input', updateSplitRangeFeedback);

splitExecuteBtn.addEventListener('click', async () => {
  if (!splitTargetFile) return;

  const modeRadio = /** @type {HTMLInputElement} */ (
    document.querySelector('input[name="splitMode"]:checked')
  );
  const mode = modeRadio ? modeRadio.value : 'extract';

  hideMessage();
  showProgress('split');
  splitExecuteBtn.disabled = true;

  try {
    const options = {
      pageRange: splitPageRangeInput.value.trim(),
      interval: parseInt(splitIntervalInput.value, 10) || 2,
    };

    const results = await splitPdf(splitTargetFile, mode, options, (percent, label) => {
      setProgress(percent, label, 'split');
    });

    splitResultsArea.innerHTML = '';
    splitResultsArea.classList.remove('hidden');

    results.forEach(res => {
      const blob = new Blob([res.bytes], { type: 'application/pdf' });
      const item = document.createElement('div');
      item.className = 'split-result-item';
      item.innerHTML = `
        <span class="file-name">${escapeHtml(res.name)}</span>
        <button class="btn btn-secondary btn-sm">Download</button>
      `;

      item.querySelector('button')?.addEventListener('click', () => {
        downloadBlob(blob, res.name);
      });

      splitResultsArea.appendChild(item);

      // Also trigger direct download for convenience
      downloadBlob(blob, res.name);
    });

    showMessage(`✓ Successfully created ${results.length} PDF file${results.length === 1 ? '' : 's'}!`, 'success', 6000);
  } catch (err) {
    showMessage(`Split failed: ${err.message}`, 'error');
    console.error('[PDF Split] Error:', err);
  } finally {
    splitExecuteBtn.disabled = false;
    hideProgress('split');
  }
});

/* ── Rotate Tool Logic ──────────────────────────────────────── */
rotateDropZone.addEventListener('dragover', e => {
  e.preventDefault();
  rotateDropZone.classList.add('drag-over');
});

rotateDropZone.addEventListener('dragleave', () => {
  rotateDropZone.classList.remove('drag-over');
});

rotateDropZone.addEventListener('drop', e => {
  e.preventDefault();
  rotateDropZone.classList.remove('drag-over');
  const files = e.dataTransfer?.files;
  if (files && files[0]) loadRotateFile(files[0]);
});

rotateDropZone.addEventListener('click', e => {
  if (/** @type {HTMLElement} */(e.target).closest('label')) return;
  rotateFileInput.click();
});

rotateFileInput.addEventListener('change', () => {
  if (rotateFileInput.files && rotateFileInput.files[0]) {
    loadRotateFile(rotateFileInput.files[0]);
  }
  rotateFileInput.value = '';
});

rotateChangeFileBtn.addEventListener('click', () => {
  rotateTargetFile = null;
  rotateConfigSection.classList.add('hidden');
  rotateDropZone.parentElement.classList.remove('hidden');
  rotateThumbnailsGrid.innerHTML = '';
});

async function loadRotateFile(file) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showMessage(`"${file.name}" is not a PDF file.`, 'error');
    return;
  }

  rotateTargetFile = file;
  rotateFileNameEl.textContent = file.name;
  rotateFileMetaEl.textContent = 'Loading page count…';

  rotateDropZone.parentElement.classList.add('hidden');
  rotateConfigSection.classList.remove('hidden');

  try {
    rotateTargetPageCount = await getPdfPageCount(file);
    rotateFileMetaEl.textContent = `${rotateTargetPageCount} pages · ${(file.size / (1024 * 1024)).toFixed(1)} MB`;

    // Initialize per-page rotation state
    rotatePagesState = Array.from({ length: rotateTargetPageCount }, (_, i) => ({
      pageIndex: i,
      rotation: 0,
    }));

    renderRotateGrid();
  } catch (err) {
    rotateFileMetaEl.textContent = `Could not read pages: ${err.message}`;
  }
}

function renderRotateGrid() {
  rotateThumbnailsGrid.innerHTML = '';

  rotatePagesState.forEach((page, i) => {
    const card = document.createElement('div');
    card.className = 'page-card';

    card.innerHTML = `
      <div class="page-card-header">
        <span class="page-card-title">Page ${i + 1}</span>
        ${page.rotation > 0 ? `<span class="page-angle-badge">${page.rotation}°</span>` : ''}
      </div>
      <div class="page-thumb-wrap">
        <img class="page-thumb-img" alt="Page ${i + 1}" style="transform: rotate(${page.rotation}deg);" />
      </div>
      <div class="page-card-actions">
        <button class="btn btn-secondary btn-xs btn-rot-cw" title="Rotate 90° clockwise">↻ +90°</button>
      </div>
    `;

    const img = card.querySelector('.page-thumb-img');
    renderPageThumbnail(rotateTargetFile, i, 0).then(dataUrl => {
      if (img) img.src = dataUrl;
    });

    card.querySelector('.btn-rot-cw')?.addEventListener('click', e => {
      e.stopPropagation();
      page.rotation = (page.rotation + 90) % 360;
      renderRotateGrid();
    });

    card.addEventListener('click', () => {
      page.rotation = (page.rotation + 90) % 360;
      renderRotateGrid();
    });

    rotateThumbnailsGrid.appendChild(card);
  });
}

rotateAllCwBtn.addEventListener('click', () => {
  rotatePagesState.forEach(p => (p.rotation = (p.rotation + 90) % 360));
  renderRotateGrid();
});

rotateAllCcwBtn.addEventListener('click', () => {
  rotatePagesState.forEach(p => (p.rotation = (p.rotation + 270) % 360));
  renderRotateGrid();
});

rotateAll180Btn.addEventListener('click', () => {
  rotatePagesState.forEach(p => (p.rotation = (p.rotation + 180) % 360));
  renderRotateGrid();
});

rotateResetBtn.addEventListener('click', () => {
  rotatePagesState.forEach(p => (p.rotation = 0));
  renderRotateGrid();
});

rotateExecuteBtn.addEventListener('click', async () => {
  if (!rotateTargetFile) return;

  hideMessage();
  showProgress('rotate');
  rotateExecuteBtn.disabled = true;

  try {
    const rotationMap = new Map();
    rotatePagesState.forEach(p => {
      if (p.rotation > 0) rotationMap.set(p.pageIndex, p.rotation);
    });

    const pdfBytes = await rotatePdf(rotateTargetFile, rotationMap, (percent, label) => {
      setProgress(percent, label, 'rotate');
    });

    const base = rotateTargetFile.name.replace(/\.pdf$/i, '');
    const outName = sanitiseFilename(`${base}_rotated.pdf`);
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    downloadBlob(blob, outName);

    showMessage(`✓ Rotated PDF saved as "${outName}"!`, 'success', 6000);
  } catch (err) {
    showMessage(`Rotation failed: ${err.message}`, 'error');
    console.error('[PDF Rotate] Error:', err);
  } finally {
    rotateExecuteBtn.disabled = false;
    hideProgress('rotate');
  }
});

/* ── Dark Mode Toggle ───────────────────────────────────────── */
const THEME_KEY = 'pdfMerger_theme';

function applyTheme(theme) {
  document.body.classList.toggle('dark-mode', theme === 'dark');
  document.body.classList.toggle('light-mode', theme === 'light');
}

const savedTheme = localStorage.getItem(THEME_KEY);
if (savedTheme) {
  applyTheme(savedTheme);
} else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  applyTheme('dark');
}

themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark-mode');
  const next = isDark ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

/* ── PWA Service Worker Registration ────────────────────────── */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then(reg => {
        console.log('[PWA] Service Worker registered:', reg.scope);
        if (offlineBadge) {
          offlineBadge.style.display = 'inline-flex';
        }
      })
      .catch(err => {
        console.warn('[PWA] Service Worker registration skipped:', err);
      });
  });
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
