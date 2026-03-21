/**
 * fileManager.js – Manages the in-memory list of selected PDF files.
 *
 * Responsibilities:
 *  - Maintain an ordered array of { id, file } entries
 *  - Validate files (type, size)
 *  - Emit events when the list changes so the UI can re-render
 *  - Provide helpers to add, remove, reorder, and clear files
 */

import { uid, formatBytes } from './utils.js';

/** Maximum allowed file size in bytes (100 MB). */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

/**
 * @typedef {{ id: string, file: File }} FileEntry
 */

/**
 * Creates a FileManager instance.
 *
 * @returns {{
 *   getFiles: () => FileEntry[],
 *   addFiles: (files: FileList|File[]) => { added: FileEntry[], errors: string[] },
 *   removeFile: (id: string) => void,
 *   reorder: (fromIndex: number, toIndex: number) => void,
 *   clearAll: () => void,
 *   onUpdate: (callback: (files: FileEntry[]) => void) => void,
 * }}
 */
export function createFileManager() {
  /** @type {FileEntry[]} */
  let files = [];

  /** @type {Array<(files: FileEntry[]) => void>} */
  const listeners = [];

  /** Notify all registered listeners with the current file list. */
  function notify() {
    const snapshot = [...files];
    listeners.forEach(cb => cb(snapshot));
  }

  return {
    /** Returns a copy of the current ordered file list. */
    getFiles() {
      return [...files];
    },

    /**
     * Attempt to add files. Returns added entries and any validation errors.
     * Duplicate files (same name + size) are silently skipped.
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

        const entry = { id: uid(), file };
        files.push(entry);
        added.push(entry);
      });

      if (added.length > 0) notify();
      return { added, errors };
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

    /** Remove all files. */
    clearAll() {
      if (files.length === 0) return;
      files = [];
      notify();
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
