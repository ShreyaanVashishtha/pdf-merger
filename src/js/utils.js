/**
 * utils.js – General-purpose utility functions
 *
 * Covers:
 *  - File size formatting
 *  - Safe file name sanitisation
 *  - Debounce helper
 *  - Unique-ID generation
 */

/**
 * Format a byte count into a human-readable string.
 * @param {number} bytes
 * @param {number} [decimals=1]
 * @returns {string}  e.g. "3.4 MB"
 */
export function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Sanitise a filename so it is safe to use as a download attribute value.
 * Replaces problematic characters and trims whitespace.
 * @param {string} name
 * @returns {string}
 */
export function sanitiseFilename(name) {
  return name
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_');
}

/**
 * Returns a simple pseudo-unique id string.
 * Sufficient for local DOM use; not a cryptographic UUID.
 * @returns {string}
 */
export function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Returns a debounced version of `fn` that delays invocation by `wait` ms.
 * @param {Function} fn
 * @param {number}   wait
 * @returns {Function}
 */
export function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
