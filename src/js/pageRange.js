/**
 * pageRange.js – Parses and validates human-entered page ranges (e.g. "1-3, 5, 8-10").
 */

/**
 * @typedef {Object} PageRangeResult
 * @property {number[]} indices - 0-based page indices in the requested order
 * @property {string|null} error - Error message if invalid, or null if valid
 * @property {string} summary - Human-readable summary (e.g. "4 pages: 1, 2, 3, 5")
 */

/**
 * Parses a page range string according to a document's total page count.
 * Supported formats:
 *   - "all" or empty string -> all pages (0 to totalPages - 1)
 *   - "1" -> single page
 *   - "1-3" -> range of pages 1, 2, 3
 *   - "1-3, 5, 8-10" -> combination
 *   - "3-end" or "3-" -> from page 3 to the last page
 *   - "-4" -> from page 1 to page 4
 *
 * @param {string} input - User-supplied string
 * @param {number} totalPages - Total number of pages in the PDF (1-based count)
 * @returns {PageRangeResult}
 */
export function parsePageRange(input, totalPages) {
  if (totalPages <= 0) {
    return { indices: [], error: 'Document has no pages', summary: '0 pages' };
  }

  const raw = (input || '').trim().toLowerCase();
  if (!raw || raw === 'all') {
    const all = Array.from({ length: totalPages }, (_, i) => i);
    return {
      indices: all,
      error: null,
      summary: `All ${totalPages} page${totalPages === 1 ? '' : 's'}`,
    };
  }

  const parts = raw.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    const all = Array.from({ length: totalPages }, (_, i) => i);
    return {
      indices: all,
      error: null,
      summary: `All ${totalPages} page${totalPages === 1 ? '' : 's'}`,
    };
  }

  const indices = [];
  const seen = new Set();

  for (const part of parts) {
    // Check for range: "start-end"
    if (part.includes('-')) {
      const rangeParts = part.split('-');
      if (rangeParts.length !== 2) {
        return {
          indices: [],
          error: `Invalid range format: "${part}"`,
          summary: 'Invalid range',
        };
      }

      let [startStr, endStr] = rangeParts.map(s => s.trim());
      let start = startStr === '' ? 1 : parseInt(startStr, 10);
      let end = (endStr === '' || endStr === 'end') ? totalPages : parseInt(endStr, 10);

      if (isNaN(start) || isNaN(end)) {
        return {
          indices: [],
          error: `Invalid numbers in range: "${part}"`,
          summary: 'Invalid range',
        };
      }

      if (start < 1) start = 1;
      if (end > totalPages) {
        return {
          indices: [],
          error: `Page ${end} exceeds total pages (${totalPages})`,
          summary: 'Out of range',
        };
      }

      if (start > end) {
        return {
          indices: [],
          error: `Range start (${start}) is greater than end (${end})`,
          summary: 'Invalid range',
        };
      }

      for (let p = start; p <= end; p++) {
        const idx = p - 1;
        if (!seen.has(idx)) {
          seen.add(idx);
          indices.push(idx);
        }
      }
    } else {
      // Single page
      const pageNum = parseInt(part, 10);
      if (isNaN(pageNum)) {
        return {
          indices: [],
          error: `Invalid page number: "${part}"`,
          summary: 'Invalid number',
        };
      }

      if (pageNum < 1 || pageNum > totalPages) {
        return {
          indices: [],
          error: `Page ${pageNum} is out of bounds (1–${totalPages})`,
          summary: 'Out of range',
        };
      }

      const idx = pageNum - 1;
      if (!seen.has(idx)) {
        seen.add(idx);
        indices.push(idx);
      }
    }
  }

  if (indices.length === 0) {
    return {
      indices: [],
      error: 'No valid pages selected',
      summary: '0 pages',
    };
  }

  const count = indices.length;
  const summary = count === totalPages
    ? `All ${count} page${count === 1 ? '' : 's'}`
    : `${count} page${count === 1 ? '' : 's'} (${indices.map(i => i + 1).join(', ')})`;

  return { indices, error: null, summary };
}
