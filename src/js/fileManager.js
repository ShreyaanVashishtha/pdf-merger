/**
 * fileManager.js – Manages the in-memory list of selected PDF files and their settings.
 *
 * Responsibilities:
 *  - Maintain an ordered array of FileEntry objects
 *  - Validate files (type, size, duplicates)
 *  - Track per-file page count, selected page ranges, and rotation
 *  - Provide sorting (A-Z, size, reverse) and reordering (drag or up/down)
 *  - Compute aggregate statistics (total files, total pages, total size)
 *  - Emit events on any state change
 */

import { uid, formatBytes } from './utils.js?v=2.2.0';
import { parsePageRange } from './pageRange.js?v=2.2.0';

/** Maximum allowed file size in bytes (100 MB). */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * @typedef {Object} PageEntry
 * @property {number} originalIndex - 0-based index in the source PDF
 * @property {number} rotation - 0, 90, 180, 270
 * @property {boolean} excluded - whether the page is omitted
 */

/**
 * @typedef {Object} FileEntry
 * @property {string} id
 * @property {File} file
 * @property {number} pageCount - Total number of pages (0 if loading)
 * @property {string} pageRange - User's range string (e.g. "1-3, 5")
 * @property {number[]} parsedIndices - 0-based page indices to include
 * @property {string|null} rangeError - Any validation error on the range
 * @property {string} rangeSummary - Human-readable range summary
 * @property {number} rotation - Document-level rotation in degrees (0, 90, 180, 270)
 * @property {PageEntry[]|null} customPages - Page-level settings if visual organizer was used
 */

/**
 * Creates a FileManager instance.
 */
export function createFileManager() {
  /** @type {FileEntry[]} */
  let files = [];

  /** @type {Array<(files: FileEntry[]) => void>} */
  const listeners = [];

  /** Notify all registered listeners with a clone of current files. */
  function notify() {
    const snapshot = files.map(f => ({ ...f, parsedIndices: [...f.parsedIndices] }));
    listeners.forEach(cb => cb(snapshot));
  }

  return {
    /** Returns a copy of the current ordered file list. */
    getFiles() {
      return files.map(f => ({ ...f, parsedIndices: [...f.parsedIndices] }));
    },

    /**
     * Attempt to add files. Returns added entries and any validation errors.
     * Duplicate files (same name + size) are skipped.
     *
     * @param {FileList|File[]} incoming
     * @returns {{ added: FileEntry[], errors: string[] }}
     */
    addFiles(incoming) {
      const added = [];
      const errors = [];

      Array.from(incoming).forEach(file => {
        // Type check
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
          errors.push(`"${file.name}" is not a PDF file and was skipped.`);
          return;
        }

        // Size check
        if (file.size > MAX_FILE_SIZE) {
          errors.push(
            `"${file.name}" exceeds the 100 MB limit (${formatBytes(file.size)}) and was skipped.`
          );
          return;
        }

        // Duplicate check (same name + size)
        const isDuplicate = files.some(
          entry => entry.file.name === file.name && entry.file.size === file.size
        );
        if (isDuplicate) {
          errors.push(`"${file.name}" is already in the list.`);
          return;
        }

        /** @type {FileEntry} */
        const entry = {
          id: uid(),
          file,
          pageCount: 0,
          pageRange: '',
          parsedIndices: [],
          rangeError: null,
          rangeSummary: 'Loading pages…',
          rotation: 0,
          customPages: null,
        };

        files.push(entry);
        added.push(entry);
      });

      if (added.length > 0) notify();
      return { added, errors };
    },

    /**
     * Updates the page count of a file once read from pdf-lib / pdfjs.
     * @param {string} id
     * @param {number} count
     */
    setPageCount(id, count) {
      const entry = files.find(f => f.id === id);
      if (!entry) return;

      entry.pageCount = count;
      const parsed = parsePageRange(entry.pageRange, count);
      entry.parsedIndices = parsed.indices;
      entry.rangeError = parsed.error;
      entry.rangeSummary = parsed.summary;
      notify();
    },

    /**
     * Update page range input for a file.
     * @param {string} id
     * @param {string} rangeStr
     */
    setPageRange(id, rangeStr) {
      const entry = files.find(f => f.id === id);
      if (!entry) return;

      entry.pageRange = rangeStr;
      if (entry.pageCount > 0) {
        const parsed = parsePageRange(rangeStr, entry.pageCount);
        entry.parsedIndices = parsed.indices;
        entry.rangeError = parsed.error;
        entry.rangeSummary = parsed.summary;
      }
      notify();
    },

    /**
     * Rotate document clockwise (+90 degrees).
     * @param {string} id
     */
    rotateDocument(id) {
      const entry = files.find(f => f.id === id);
      if (!entry) return;

      entry.rotation = (entry.rotation + 90) % 360;
      notify();
    },

    /**
     * Save custom page-level settings from Visual Page Organizer.
     * @param {string} id
     * @param {PageEntry[]} pages
     */
    setCustomPages(id, pages) {
      const entry = files.find(f => f.id === id);
      if (!entry) return;

      entry.customPages = pages;
      const included = pages.filter(p => !p.excluded).map(p => p.originalIndex);
      entry.parsedIndices = included;
      entry.rangeSummary = `${included.length} page${included.length === 1 ? '' : 's'} (customized)`;
      notify();
    },

    /**
     * Move an entry up one position.
     * @param {string} id
     */
    moveUp(id) {
      const idx = files.findIndex(f => f.id === id);
      if (idx > 0) {
        const [item] = files.splice(idx, 1);
        files.splice(idx - 1, 0, item);
        notify();
      }
    },

    /**
     * Move an entry down one position.
     * @param {string} id
     */
    moveDown(id) {
      const idx = files.findIndex(f => f.id === id);
      if (idx >= 0 && idx < files.length - 1) {
        const [item] = files.splice(idx, 1);
        files.splice(idx + 1, 0, item);
        notify();
      }
    },

    /**
     * Reorder by moving an entry from `fromIndex` to `toIndex`.
     * @param {number} fromIndex
     * @param {number} toIndex
     */
    reorder(fromIndex, toIndex) {
      if (fromIndex === toIndex) return;
      const [entry] = files.splice(fromIndex, 1);
      files.splice(toIndex, 0, entry);
      notify();
    },

    /**
     * Remove a file by its id.
     * @param {string} id
     */
    removeFile(id) {
      const before = files.length;
      files = files.filter(entry => entry.id !== id);
      if (files.length !== before) notify();
    },

    /** Remove all files. */
    clearAll() {
      if (files.length === 0) return;
      files = [];
      notify();
    },

    /** Sort files alphabetically by name. */
    sortByName(ascending = true) {
      files.sort((a, b) =>
        ascending
          ? a.file.name.localeCompare(b.file.name, undefined, { numeric: true, sensitivity: 'base' })
          : b.file.name.localeCompare(a.file.name, undefined, { numeric: true, sensitivity: 'base' })
      );
      notify();
    },

    /** Sort files by file size. */
    sortBySize(ascending = true) {
      files.sort((a, b) => (ascending ? a.file.size - b.file.size : b.file.size - a.file.size));
      notify();
    },

    /** Reverse current file order. */
    reverseOrder() {
      files.reverse();
      notify();
    },

    /** Calculate summary statistics across all files. */
    getTotalStats() {
      let totalFiles = files.length;
      let totalSize = 0;
      let totalDocPages = 0;
      let selectedPages = 0;
      let hasErrors = false;

      files.forEach(f => {
        totalSize += f.file.size;
        totalDocPages += f.pageCount;
        selectedPages += f.parsedIndices.length;
        if (f.rangeError) hasErrors = true;
      });

      return {
        totalFiles,
        totalSize,
        totalDocPages,
        selectedPages,
        hasErrors,
      };
    },

    /**
     * Register a listener that fires whenever the file list changes.
     * @param {(files: FileEntry[]) => void} callback
     */
    onUpdate(callback) {
      listeners.push(callback);
    },
  };
}
